namespace AcmsDashboard.Api.Dtos;

public record KpiSummaryDto(
    int TotalEmployees,
    int ActiveCards,
    int OnSiteNow,
    int PendingRequests);

public record FunnelPointDto(
    DateOnly Date,
    int Submitted,
    int Verified,
    int Printed,
    double ConversionRate,
    string? BottleneckStage);

/// <param name="Basis">
/// Plain-English statement of which population these totals describe. Rendered
/// under the funnel chart so the conversion figure is self-explanatory: the
/// numbers are a cohort of requests submitted inside the window, not a sum of
/// per-day stage events. See AnalyticsController.Funnel for why that matters.
/// </param>
public record FunnelTotalsDto(
    int Submitted,
    int Verified,
    int Printed,
    double OverallConversionRate,
    double? AvgProcessingHours,
    string? Basis = null);

public record TrafficPointDto(
    DateOnly Date,
    int EntryCount,
    int ExitCount,
    int? PeakHour);