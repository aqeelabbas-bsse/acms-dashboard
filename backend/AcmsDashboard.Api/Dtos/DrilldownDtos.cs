namespace AcmsDashboard.Api.Dtos;

/// <summary>
/// The five KPIs from the supervisor's requirements list, mapped to a stable
/// route segment. Keeping them in one enum (rather than five near-identical
/// controllers) is what lets summary/rows be two endpoints instead of ten.
/// </summary>
public enum DrilldownKind
{
    ActiveCards,      // Req 1: Registered cards total Active -> category-wise
    BlockedCards,      // Req 2: Blocked cards -> reason-wise
    PendingPrinting,   // Req 4: Cards pending in printing
    PendingApproval,   // Req 5: Cards pending in approval
    VisitorsToday,     // Req 6: Checked-in visitors today -> department-wise
}

/// <summary>Which coded field to group by. Only meaningful for card kinds.</summary>
public enum DrilldownDimension { CardCategory, Opicode }

public record BreakdownItemDto(string Code, string Label, int Count);

public record DrilldownSummaryDto(
    DrilldownKind Kind,
    int Total,
    IReadOnlyList<BreakdownItemDto> Breakdown,
    /// <summary>True only for ActiveCards - the only kind with a dimension toggle.</summary>
    bool SupportsDimensionToggle);

/// <summary>
/// One row in the searchable grid (Req 7). Deliberately generic across all
/// five kinds rather than five different row shapes, so the frontend has one
/// grid component instead of five.
/// </summary>
public record DrilldownRowDto(
    string Id,
    string Primary,       // holder / visitor name
    string? Secondary,     // CNIC or card number - shown as a mono subtitle
    string? CategoryLabel, // the breakdown bucket this row falls into
    string? StatusLabel,
    string? StatusTone,    // 'success' | 'danger' | 'warn' | 'info' | 'neutral'
    DateTime? Date,
    string? Note);