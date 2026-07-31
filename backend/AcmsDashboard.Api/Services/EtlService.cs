using AcmsDashboard.Api.Analytics;
using AcmsDashboard.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Services;

public record EtlRunSummary(
    DateOnly From,
    DateOnly To,
    int DaysProcessed,
    int CardRequestsRead,
    int VisitsRead,
    TimeSpan Duration);

public class EtlService
{
    private readonly AcmsDbContext _db;
    private readonly AnalyticsDbContext _analytics;
    private readonly ILogger<EtlService> _logger;

    public EtlService(AcmsDbContext db, AnalyticsDbContext analytics, ILogger<EtlService> logger)
    {
        _db = db;
        _analytics = analytics;
        _logger = logger;
    }

    /// <summary>
    /// Aggregates raw transactional rows into the three summary tables.
    /// Backfills <paramref name="lookbackDays"/> so historical seeded data appears,
    /// not just today's activity.
    /// </summary>
    public async Task<EtlRunSummary> RunAsync(int lookbackDays = 90, CancellationToken ct = default)
    {
        var startedAt = DateTime.UtcNow;
        var toDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var fromDate = toDate.AddDays(-lookbackDays);
        var fromDateTime = fromDate.ToDateTime(TimeOnly.MinValue);

        _logger.LogInformation("ETL starting for {From} to {To}", fromDate, toDate);

        // ─────────────── EXTRACT ───────────────
        // Filter at the database (WHERE), then aggregate in memory. At ACMS's scale
        // (thousands of rows) this is fast and far more readable than pushing
        // GROUP BY through LINQ. If volume ever reaches millions, move grouping into SQL.
        var cardRequests = await _db.CardRequestProcesses
            .AsNoTracking()
            .Where(r => (r.ProcessDate  != null && r.ProcessDate  >= fromDateTime)
                     || (r.MarkedOn     != null && r.MarkedOn     >= fromDateTime)
                     || (r.PrintingDate != null && r.PrintingDate >= fromDateTime))
            .ToListAsync(ct);

        var visits = await _db.VisitorInfos
            .AsNoTracking()
            .Where(v => (v.EntryDate != null && v.EntryDate >= fromDateTime)
                     || (v.ExitDate  != null && v.ExitDate  >= fromDateTime))
            .ToListAsync(ct);

        _logger.LogInformation("ETL extracted {Cards} card requests, {Visits} visits",
            cardRequests.Count, visits.Count);

        // ─────────────── TRANSFORM ───────────────
        // Each metric is attributed to the date its *stage* happened on:
        // submitted -> ProcessDate, verified -> MarkedOn, printed -> PrintingDate.
        var submittedByDay = cardRequests
            .Where(r => r.ProcessDate.HasValue)
            .GroupBy(r => DateOnly.FromDateTime(r.ProcessDate!.Value))
            .ToDictionary(g => g.Key, g => g.Count());

        var verifiedByDay = cardRequests
            .Where(r => r.IsVerified == true && r.MarkedOn.HasValue)
            .GroupBy(r => DateOnly.FromDateTime(r.MarkedOn!.Value))
            .ToDictionary(g => g.Key, g => g.Count());

        var printedByDay = cardRequests
            .Where(r => r.IsPrinted == true && r.PrintingDate.HasValue)
            .GroupBy(r => DateOnly.FromDateTime(r.PrintingDate!.Value))
            .ToDictionary(g => g.Key, g => g.Count());

        // For cards printed on day X, the average wall-clock hours from submission
        // to printing. This is the funnel duration metric.
        var avgHoursByDay = cardRequests
            .Where(r => r.IsPrinted == true && r.PrintingDate.HasValue && r.ProcessDate.HasValue)
            .GroupBy(r => DateOnly.FromDateTime(r.PrintingDate!.Value))
            .ToDictionary(
                g => g.Key,
                g => g.Average(r => (r.PrintingDate!.Value - r.ProcessDate!.Value).TotalHours));

        var entriesByDay = visits
            .Where(v => v.EntryDate.HasValue)
            .GroupBy(v => DateOnly.FromDateTime(v.EntryDate!.Value))
            .ToDictionary(g => g.Key, g => g.Count());

        var exitsByDay = visits
            .Where(v => v.ExitDate.HasValue)
            .GroupBy(v => DateOnly.FromDateTime(v.ExitDate!.Value))
            .ToDictionary(g => g.Key, g => g.Count());

        // Peak hour = the hour (0-23) with most check-ins that day.
        // Ties break toward the earlier hour for determinism.
        var peakHourByDay = visits
            .Where(v => v.EntryDate.HasValue)
            .GroupBy(v => DateOnly.FromDateTime(v.EntryDate!.Value))
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(v => v.EntryDate!.Value.Hour)
                      .OrderByDescending(h => h.Count())
                      .ThenBy(h => h.Key)
                      .First().Key);

        // Every day with activity in ANY metric gets a summary row.
        var allDays = submittedByDay.Keys
            .Concat(verifiedByDay.Keys)
            .Concat(printedByDay.Keys)
            .Concat(entriesByDay.Keys)
            .Concat(exitsByDay.Keys)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        // ─────────────── LOAD (upsert) ───────────────
        // EF Core has no native UPSERT, so load existing rows once and decide
        // per-day whether to update or insert. Re-running the ETL is therefore
        // idempotent — it never creates duplicate rows.
        var existingCards   = await _analytics.DailyCardStats.ToDictionaryAsync(x => x.StatDate, ct);
        var existingTraffic = await _analytics.VisitorTrafficDaily.ToDictionaryAsync(x => x.StatDate, ct);
        var existingFunnel  = await _analytics.CardFunnelStats.ToDictionaryAsync(x => x.StatDate, ct);

        var now = DateTime.UtcNow;

        foreach (var day in allDays)
        {
            var submitted = submittedByDay.GetValueOrDefault(day);
            var verified  = verifiedByDay.GetValueOrDefault(day);
            var printed   = printedByDay.GetValueOrDefault(day);

            // --- DailyCardStats ---
            if (!existingCards.TryGetValue(day, out var cardRow))
            {
                cardRow = new DailyCardStat { StatDate = day };
                _analytics.DailyCardStats.Add(cardRow);
            }
            cardRow.Submitted = submitted;
            cardRow.Verified = verified;
            cardRow.Printed = printed;
            cardRow.AvgProcessingHours = avgHoursByDay.TryGetValue(day, out var avg)
                ? Math.Round(avg, 2)
                : null;
            cardRow.GeneratedAt = now;

            // --- VisitorTrafficDaily ---
            if (!existingTraffic.TryGetValue(day, out var trafficRow))
            {
                trafficRow = new VisitorTrafficDaily { StatDate = day };
                _analytics.VisitorTrafficDaily.Add(trafficRow);
            }
            trafficRow.EntryCount = entriesByDay.GetValueOrDefault(day);
            trafficRow.ExitCount = exitsByDay.GetValueOrDefault(day);
            trafficRow.PeakHour = peakHourByDay.TryGetValue(day, out var peak) ? peak : null;
            trafficRow.GateId = null; // no gate data in the current schema
            trafficRow.GeneratedAt = now;

            // --- CardFunnelStats ---
            if (!existingFunnel.TryGetValue(day, out var funnelRow))
            {
                funnelRow = new CardFunnelStat { StatDate = day };
                _analytics.CardFunnelStats.Add(funnelRow);
            }
            funnelRow.Submitted = submitted;
            funnelRow.Verified = verified;
            funnelRow.Printed = printed;
            funnelRow.ConversionRate = submitted > 0
                ? Math.Round(printed * 100.0 / submitted, 2)
                : 0;
            funnelRow.BottleneckStage = DeriveBottleneck(submitted, verified, printed);
            funnelRow.GeneratedAt = now;
        }

        await _analytics.SaveChangesAsync(ct);

        var summary = new EtlRunSummary(
            fromDate, toDate, allDays.Count,
            cardRequests.Count, visits.Count,
            DateTime.UtcNow - startedAt);

        _logger.LogInformation("ETL complete: {Days} days written in {Ms}ms",
            summary.DaysProcessed, summary.Duration.TotalMilliseconds);

        return summary;
    }

    /// <summary>Where the largest drop-off occurs in that day's funnel.</summary>
    private static string DeriveBottleneck(int submitted, int verified, int printed)
    {
        if (submitted == 0) return "NoActivity";

        var lostAtVerification = submitted - verified;
        var lostAtPrinting = verified - printed;

        if (lostAtVerification <= 0 && lostAtPrinting <= 0) return "None";
        return lostAtVerification >= lostAtPrinting ? "Verification" : "Printing";
    }
}