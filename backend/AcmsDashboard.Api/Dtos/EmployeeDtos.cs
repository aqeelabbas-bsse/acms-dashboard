namespace AcmsDashboard.Api.Dtos;

public record EmployeeListDto(
    string Cnic,
    string? Name,
    string? Designation,
    bool IsActive);

public record EmployeeDetailDto(
    string Cnic,
    string? Name,
    string? FatherName,
    string? Designation,
    string? Rank,
    string? Email,
    string? ContactNo,
    string? CompanyName,
    DateTime? ExpiryDate,
    DateTime? Dob,
    bool IsActive);

public record CreateEmployeeRequest(
    string Cnic,
    string Name,
    string? FatherName,
    string? Designation,
    string? Email,
    string? ContactNo,
    DateTime? ExpiryDate);

public record UpdateEmployeeRequest(
    string? Name,
    string? Designation,
    string? Email,
    string? ContactNo,
    DateTime? ExpiryDate,
    bool? IsActive);