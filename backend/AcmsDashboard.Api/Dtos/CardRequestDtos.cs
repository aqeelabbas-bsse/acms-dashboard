namespace AcmsDashboard.Api.Dtos;

public record CardRequestListDto(
    int Crid,
    string? Cnic,
    string? EmployeeName,
    bool IsVerified,
    bool IsPrinted,
    string Status,
    DateTime? ProcessDate,
    DateTime? MarkedOn,
    DateTime? PrintingDate,
    string? PrintBy,
    string? Remarks);

public record CreateCardRequestRequest(
    string Cnic,
    string? Remarks);