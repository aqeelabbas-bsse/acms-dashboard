namespace AcmsDashboard.Api.Dtos;

public record VisitorRfidDto(
    string SmartCardNo,
    bool IsActive,
    bool IsBlocked,
    bool CheckedIn,
    DateTime? ActiveDate,
    DateTime? BlockedDate);

public record BlockCardRequest(string Reason);