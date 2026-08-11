namespace AcmsDashboard.Api.Dtos;

/// <summary>
/// Every drillable metric in the dashboard, mapped to a stable kebab-case
/// route segment (route "pending-printing" -> enum PendingPrinting).
///
/// The first five come from the supervisor's original handwritten list and
/// render as the coloured tile strip. The last four were added after the
/// second review: the four headline KPI cards at the top of the dashboard are
/// now drillable too, so every number on the screen can be opened and traced
/// back to the rows that produced it.
/// </summary>
public enum DrilldownKind
{
    // --- tile strip (supervisor's list 1) ---
    ActiveCards,        // Registered staff cards, active   -> category-wise
    BlockedCards,       // Deactivated staff cards          -> reason-wise
    PendingPrinting,    // Verified, awaiting printing      -> age-wise
    PendingApproval,    // Submitted, awaiting verification -> age-wise
    VisitorsToday,      // Checked in today                 -> company-wise

    // --- headline KPI cards (supervisor's list 2) ---
    TotalEmployees,     // KPI 1 -> category-wise
    ActiveVisitorCards, // KPI 2 -> holder-state-wise
    VisitorsOnSite,     // KPI 3 -> card-link-state-wise
    PendingRequests,    // KPI 4 -> stage-wise
}

/// <summary>Which coded field to group by. Only meaningful for the card kinds.</summary>
public enum DrilldownDimension { CardCategory, Opicode }

public record BreakdownItemDto(string Code, string Label, int Count);

/// <summary>
/// Describes one grid column. The frontend builds its table head, its
/// "search in..." dropdown and its sort controls entirely from this list, so
/// adding a column to a drill-down is a backend-only change — there is no
/// per-kind markup on the Angular side at all.
/// </summary>
/// <param name="Type">
/// text = plain | mono = tabular/identifier (CNIC, card no.) |
/// date = formatted date | status = rendered as a status badge
/// </param>
public record DrilldownColumnDto(
    string Key,
    string Label,
    string Type = "text",
    bool Searchable = true,
    bool Sortable = true);

public record FilterOptionDto(string Value, string Label);

/// <param name="Type">select | dateRange</param>
public record DrilldownFilterDto(
    string Key,
    string Label,
    string Type,
    IReadOnlyList<FilterOptionDto>? Options = null);

/// <summary>
/// Summary payload. Beyond the counts it carries the metric's <b>Definition</b>
/// — the exact predicate, in SQL, that produced <b>Total</b>.
///
/// That field exists because of a specific review finding: the dashboard said
/// 2 blocked staff cards while SSMS said 3, and there was no way to tell from
/// the UI which filter the dashboard had applied. Publishing the predicate
/// next to the number makes every figure on the screen independently checkable
/// against the database by copying one line into SSMS.
/// </summary>
public record DrilldownSummaryDto(
    DrilldownKind Kind,
    int Total,
    IReadOnlyList<BreakdownItemDto> Breakdown,
    bool SupportsDimensionToggle,
    string BreakdownLabel,
    string Definition,
    string SourceTable,
    IReadOnlyList<DrilldownColumnDto> Columns,
    IReadOnlyList<DrilldownFilterDto> Filters,
    string? Reconciliation = null);

/// <summary>
/// One grid row. Cells are keyed by <see cref="DrilldownColumnDto.Key"/> so a
/// single Angular table component renders all nine kinds.
/// </summary>
public record DrilldownRowDto(
    string Id,
    string? CategoryCode,
    DateTime? Date,
    IReadOnlyDictionary<string, string?> Cells,
    string? StatusTone);

/// <summary>
/// Everything the grid can filter and sort by. Bundled into one record so the
/// controller signature stays readable and the service has a single parameter
/// to thread through.
/// </summary>
/// <param name="Search">Free text.</param>
/// <param name="Field">
/// Restricts <paramref name="Search"/> to one column key. Null/empty searches
/// every searchable column — this is what fixes "it only filters by name or
/// CNIC".
/// </param>
/// <param name="From">Inclusive lower bound on the row's primary date.</param>
/// <param name="To">Inclusive upper bound (end of day is applied server-side).</param>
/// <param name="Status">Value from the kind's status filter options.</param>
public record DrilldownQuery(
    string? Category = null,
    string? Search = null,
    string? Field = null,
    DateTime? From = null,
    DateTime? To = null,
    string? Status = null,
    string? Sort = null,
    string? Dir = null,
    int Page = 1,
    int Limit = 25);