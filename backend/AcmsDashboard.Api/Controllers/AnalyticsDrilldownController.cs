using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AcmsDashboard.Api.Controllers;

/// <summary>
/// Backs the five drill-down requirements from the supervisor's notes:
/// active cards, blocked cards, pending-printing, pending-approval, and
/// today's checked-in visitors - each as KPI -> category breakdown ->
/// searchable grid (Reqs 1, 2, 4, 5, 6, 7).
///
/// Two generic endpoints rather than ten kind-specific ones: `kind` in the
/// route selects which table/predicate DrilldownQueryService uses, so adding
/// a sixth KPI later is a new case in that service, not a new controller.
/// </summary>
[ApiController]
[Authorize]
[Route("v1/analytics/drilldown")]
public class AnalyticsDrilldownController : ControllerBase
{
    private readonly DrilldownQueryService _svc;

    public AnalyticsDrilldownController(DrilldownQueryService svc) => _svc = svc;

    /// <summary>GET /v1/analytics/drilldown/{kind}/summary?dimension=cardCategory|opicode</summary>
    [HttpGet("{kind}/summary")]
    public async Task<IActionResult> Summary(
        string kind, [FromQuery] string? dimension, CancellationToken ct)
    {
        if (!TryParseKind(kind, out var k)) return UnknownKind(kind);
        var dim = ParseDimension(dimension);

        var summary = await _svc.SummaryAsync(k, dim, ct);
        return Ok(new { success = true, data = summary });
    }

    /// <summary>
    /// GET /v1/analytics/drilldown/{kind}/rows
    ///   ?category=&amp;dimension=&amp;search=&amp;page=&amp;limit=
    /// `category` is the breakdown bucket clicked in the histogram, or
    /// omitted/"all" for every row under this KPI.
    /// </summary>
    [HttpGet("{kind}/rows")]
    public async Task<IActionResult> Rows(
        string kind,
        [FromQuery] string? category,
        [FromQuery] string? dimension,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25,
        CancellationToken ct = default)
    {
        if (!TryParseKind(kind, out var k)) return UnknownKind(kind);
        var dim = ParseDimension(dimension);

        var (rows, total) = await _svc.RowsAsync(k, dim, category, search, page, limit, ct);

        return Ok(new
        {
            success = true,
            data = rows,
            meta = new { page, limit, total, category = category ?? "all" }
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
                      "active-cards, blocked-cards, pending-printing, pending-approval, visitors-today."
        }
    });
}