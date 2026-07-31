namespace AcmsDashboard.Api.Dtos;

/// <summary>
/// The shape of every real-time event pushed to connected dashboards.
/// Kept deliberately generic so one client handler can render all event types.
/// </summary>
public record AuditEventDto(
    string Type,          // "CardVerified", "VisitorCheckedIn", "CardBlocked", ...
    string Description,   // human-readable, ready to display in the feed
    string? Actor,        // username who performed the action
    DateTime At,
    object? Payload);     // type-specific extra data (ids, card numbers, etc.)