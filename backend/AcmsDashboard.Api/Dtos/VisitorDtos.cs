namespace AcmsDashboard.Api.Dtos;

public record VisitorListDto(
    long Id,
    string Cnic,
    string? Name,
    string? Designation,
    string? CompanyName,
    string? ContactNo,
    DateTime? EntryDate,
    DateTime? ExitDate,
    string? CardSerialNumber,
    bool IsOnSite);

public record RegisterVisitorRequest(
    string Cnic,
    string Name,
    string? Designation,
    string? CompanyName,
    string? ContactNo,
    string? Email,
    string? CardSerialNumber);