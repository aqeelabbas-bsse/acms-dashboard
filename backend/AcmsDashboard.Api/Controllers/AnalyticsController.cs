using AcmsDashboard.Api.Analytics;
using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Authorize]
[Route("v1/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly AcmsDbContext _db;
    private readonly AnalyticsDbContext _analytics;
    private readonly EtlService _etl;

    public AnalyticsController(AcmsDbContext db, AnalyticsDbContext analytics, EtlService etl)
    {
        _db = db;
        _analytics = analytics;
        _etl = etl;
    }

    /// <summary>
    /// GET /v1/analytics/summary — KPI cards.
    ///
    /// These are point-in-time counts ("on-site NOW", "pending NOW"), which a
    /// daily summary table structurally cannot answer, so they are queried
    /// live. FR-ANL-04's "no live aggregation" rule applies to the trend charts
    /// below, which do read exclusively from ETL output.
    ///
    /// Each predicate here is duplicated verbatim in DrilldownQueryService so
    /// that opening a KPI card shows exactly the rows that produced its number.
    /// If one changes, the other must change with it.
    /// </summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var totalEmployees  = await _db.PersonalSmartCards.CountAsync();
        var activeCards     = await _db.VisitorsRfids.CountAsync(c => c.IsActive == true && c.IsBlocked != true);
        var onSiteNow       = await _db.VisitorInfos.CountAsync(v => v.ExitDate == null);
        var pendingRequests = await _db.CardRequestProcesses.CountAsync(r => r.IsPrinted != true);

        return Ok(new
        {
            success = true,
            data = new KpiSummaryDto(totalEmployees, activeCards, onSiteNow, pendingRequests)
        });
    }

    /// <summary>
    /// GET /v1/analytics/funnel?from=&amp;to=
    ///
    /// ── Why the totals block no longer sums the daily ETL rows ────────────
    /// The ETL attributes each stage to the date that stage happened on:
    /// submitted -> ProcessDate, verified -> MarkedOn, printed -> PrintingDate.
    /// That is correct for the daily activity chart, but summing those columns
    /// over a window and dividing printed by submitted compares two different
    /// populations. A card submitted on 1 July and printed on 4 August
    /// contributes its "printed" to a 30-day window that never saw its
    /// "submitted" — which is exactly how this endpoint reported a 300%
    /// conversion rate (3 printed against 1 submitted in the same 30 days).
    ///
    /// The totals block is therefore a COHORT measure: take the requests
    /// SUBMITTED inside the window, then ask how far that same set got. Printed
    /// is a subset of verified, which is a subset of submitted, so the rate is
    /// bounded at 100% by construction rather than by clamping after the fact.
    ///
    /// `points` is unchanged — the daily bars are a genuine activity series and
    /// still come from ETL output only.
    /// </summary>
    [HttpGet("funnel")]
    public async Task<IActionResult> Funnel([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (start, end) = ResolveRange(from, to);

        var rows = await _analytics.CardFunnelStats
            .AsNoTracking()
            .Where(x => x.StatDate >= start && x.StatDate <= end)
            .OrderBy(x => x.StatDate)
            .ToListAsync();

        var points = rows.Select(r => new FunnelPointDto(
            r.StatDate, r.Submitted, r.Verified, r.Printed, r.ConversionRate, r.BottleneckStage));

        // ── cohort totals ──
        var startDt = start.ToDateTime(TimeOnly.MinValue);
        var endDt   = end.ToDateTime(TimeOnly.MaxValue);

        var cohort = await _db.CardRequestProcesses
            .AsNoTracking()
            .Where(r => r.ProcessDate != null && r.ProcessDate >= startDt && r.ProcessDate <= endDt)
            .Select(r => new { r.IsVerified, r.IsPrinted, r.ProcessDate, r.PrintingDate })
            .ToListAsync();

        var submitted = cohort.Count;

        // A printed card necessarily cleared verification, even where the
        // isVerified flag was never written back. Treating printing as implying
        // verification is what keeps the three bars monotonically decreasing
        // instead of showing a middle bar shorter than the last one.
        var verified = cohort.Count(r => r.IsVerified == true || r.IsPrinted == true);
        var printed  = cohort.Count(r => r.IsPrinted == true);

        var durations = cohort
            .Where(r => r.IsPrinted == true && r.PrintingDate != null && r.ProcessDate != null)
            .Select(r => (r.PrintingDate!.Value - r.ProcessDate!.Value).TotalHours)
            .ToList();

        var totals = new FunnelTotalsDto(
            submitted,
            verified,
            printed,
            submitted > 0 ? Math.Round(printed * 100.0 / submitted, 2) : 0,
            durations.Count > 0 ? Math.Round(durations.Average(), 2) : null,
            $"Requests submitted between {start:dd MMM yyyy} and {end:dd MMM yyyy}, "
            + "tracked to their current stage.");

        return Ok(new
        {
            success = true,
            data = new { points, totals },
            meta = new { from = start, to = end, cohortSize = submitted }
        });
    }

    /// <summary>GET /v1/analytics/traffic?from=&amp;to= — reads ETL output only.</summary>
    [HttpGet("traffic")]
    public async Task<IActionResult> Traffic([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (start, end) = ResolveRange(from, to);

        var points = await _analytics.VisitorTrafficDaily
            .AsNoTracking()
            .Where(x => x.StatDate >= start && x.StatDate <= end)
            .OrderBy(x => x.StatDate)
            .Select(x => new TrafficPointDto(x.StatDate, x.EntryCount, x.ExitCount, x.PeakHour))
            .ToListAsync();

        return Ok(new
        {
            success = true,
            data = points,
            meta = new
            {
                from = start,
                to = end,
                totalEntries = points.Sum(p => p.EntryCount),
                totalExits = points.Sum(p => p.ExitCount)
            }
        });
    }

    /// <summary>GET /v1/analytics/daily-cards — the raw DailyCardStats series.</summary>
    [HttpGet("daily-cards")]
    public async Task<IActionResult> DailyCards([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (start, end) = ResolveRange(from, to);

        var rows = await _analytics.DailyCardStats
            .AsNoTracking()
            .Where(x => x.StatDate >= start && x.StatDate <= end)
            .OrderBy(x => x.StatDate)
            .ToListAsync();

        return Ok(new { success = true, data = rows, meta = new { from = start, to = end, count = rows.Count } });
    }

    /// <summary>
    /// POST /v1/analytics/etl/run — Admin-only manual trigger.
    /// Exists so the pipeline can be tested and demoed without waiting for a tick.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("etl/run")]
    public async Task<IActionResult> RunEtl([FromQuery] int lookbackDays = 90)
    {
        lookbackDays = Math.Clamp(lookbackDays, 1, 3650);
        var result = await _etl.RunAsync(lookbackDays, HttpContext.RequestAborted);

        return Ok(new
        {
            success = true,
            data = new
            {
                from = result.From,
                to = result.To,
                daysProcessed = result.DaysProcessed,
                cardRequestsRead = result.CardRequestsRead,
                visitsRead = result.VisitsRead,
                durationMs = Math.Round(result.Duration.TotalMilliseconds, 1)
            }
        });
    }

    private static (DateOnly Start, DateOnly End) ResolveRange(DateOnly? from, DateOnly? to)
    {
        var end = to ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var start = from ?? end.AddDays(-30);
        return start > end ? (end, start) : (start, end);   // tolerate reversed inputs
    }
}