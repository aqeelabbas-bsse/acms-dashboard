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
    /// NOTE: these are point-in-time counts ("on-site NOW", "pending NOW"), which a
    /// daily summary table structurally cannot answer, so they are queried live.
    /// FR-ANL-04's "no live aggregation" rule applies to the trend charts below,
    /// which do read exclusively from ETL output.
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

    /// <summary>GET /v1/analytics/funnel?from=&amp;to= — reads ETL output only.</summary>
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

        var totalSubmitted = rows.Sum(r => r.Submitted);
        var totalVerified  = rows.Sum(r => r.Verified);
        var totalPrinted   = rows.Sum(r => r.Printed);

        var avgHours = await _analytics.DailyCardStats
            .AsNoTracking()
            .Where(x => x.StatDate >= start && x.StatDate <= end && x.AvgProcessingHours != null)
            .AverageAsync(x => (double?)x.AvgProcessingHours);

        var totals = new FunnelTotalsDto(
            totalSubmitted, totalVerified, totalPrinted,
            totalSubmitted > 0 ? Math.Round(totalPrinted * 100.0 / totalSubmitted, 2) : 0,
            avgHours.HasValue ? Math.Round(avgHours.Value, 2) : null);

        return Ok(new { success = true, data = new { points, totals }, meta = new { from = start, to = end } });
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