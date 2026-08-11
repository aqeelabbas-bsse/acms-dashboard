using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AcmsDashboard.Api.Controllers;

/// <summary>
/// Backs every drillable number on the dashboard: the five tiles from the
/// supervisor's first list, plus the four headline KPI cards added after the
/// second review. Each is KPI -> category breakdown -> searchable grid.
///
/// Two generic endpoints rather than eighteen kind-specific ones: `kind` in
/// the route selects which table and predicate DrilldownQueryService uses, so
/// a tenth metric is a new case in that service, not a new controller and not
/// new Angular markup.
/// </summary>
[ApiController]
[Authorize]
[Route("v1/analytics/drilldown")]
public class AnalyticsDrilldownController : ControllerBase
{
    private readonly DrilldownQueryService _svc;

    public AnalyticsDrilldownController(DrilldownQueryService svc) => _svc = svc;

    /// <summary>
    /// GET /v1/analytics/drilldown/{kind}/summary?dimension=cardCategory|opicode
    ///
    /// Returns the total, the histogram buckets, the grid's column schema, the
    /// available filters, and the SQL predicate that produced the total.
    /// </summary>
    [HttpGet("{kind}/summary")]
    public async Task<IActionResult> Summary(
        string kind, [FromQuery] string? dimension, CancellationToken ct)
    {
        if (!TryParseKind(kind, out var k)) return UnknownKind(kind);

        var summary = await _svc.SummaryAsync(k, ParseDimension(dimension), ct);
        return Ok(new { success = true, data = summary });
    }

    /// <summary>
    /// GET /v1/analytics/drilldown/{kind}/rows
    ///     ?category=&amp;dimension=&amp;q=&amp;field=&amp;from=&amp;to=&amp;status=
    ///     &amp;sort=&amp;dir=&amp;page=&amp;limit=
    ///
    /// `q` searches every searchable column by default; `field` narrows it to a
    /// single column key from the summary's `columns`. `search` is still
    /// accepted as an alias for `q` so any older client keeps working.
    /// </summary>
    [HttpGet("{kind}/rows")]
    public async Task<IActionResult> Rows(
        string kind,
        [FromQuery] string? category,
        [FromQuery] string? dimension,
        [FromQuery] string? q,
        [FromQuery] string? search,
        [FromQuery] string? field,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? status,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25,
        CancellationToken ct = default)
    {
        if (!TryParseKind(kind, out var k)) return UnknownKind(kind);

        var query = new DrilldownQuery(
            Category: category,
            Search: string.IsNullOrWhiteSpace(q) ? search : q,
            Field: field,
            From: from,
            To: to,
            Status: status,
            Sort: sort,
            Dir: dir,
            Page: page,
            Limit: limit);

        var (rows, total, unfiltered) =
            await _svc.RowsAsync(k, ParseDimension(dimension), query, ct);

        return Ok(new
        {
            success = true,
            data = rows,
            meta = new
            {
                page,
                limit,
                total,
                // How many rows exist under this KPI before any grid filter is
                // applied. The UI shows "12 of 34 matching" from these two, which
                // is what makes a filtered count self-explanatory rather than
                // looking like the KPI tile has changed its mind.
                unfiltered,
                category = category ?? "all",
                status = status ?? "all"
            }
        });
    }

    private static bool TryParseKind(string kind, out DrilldownKind result)
    {
        // Route uses kebab-case ("pending-printing"); the enum is PascalCase.
        var normalised = kind.Replace("-", "", StringComparison.Ordinal);
        return Enum.TryParse(normalised, ignoreCase: true, out result);
    }

    private static DrilldownDimension ParseDimension(string? raw) =>
        string.Equals(raw, "opicode", StringComparison.OrdinalIgnoreCase)
            ? DrilldownDimension.Opicode
            : DrilldownDimension.CardCategory;

    private IActionResult UnknownKind(string kind) => NotFound(new
    {
        success = false,
        error = new
        {
            code = "NOT_FOUND",
            message = $"Unknown drill-down kind '{kind}'. Expected one of: " +
                      "active-cards, blocked-cards, pending-printing, pending-approval, " +
                      "visitors-today, total-employees, active-visitor-cards, " +
                      "visitors-on-site, pending-requests."
        }
    });
}