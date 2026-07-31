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

public record FunnelTotalsDto(
    int Submitted,
    int Verified,
    int Printed,
    double OverallConversionRate,
    double? AvgProcessingHours);

public record TrafficPointDto(
    DateOnly Date,
    int EntryCount,
    int ExitCount,
    int? PeakHour);