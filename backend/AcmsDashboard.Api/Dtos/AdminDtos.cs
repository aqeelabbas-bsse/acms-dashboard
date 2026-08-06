// =============================================================================
// AcmsDashboard.Api/Dtos/AdminDtos.cs
// Phase 14 — Admin Console.
//
// All request/response shapes for /v1/admin/*. Records, not classes, per the
// Coding Standards section of the Detailed Implementation Plan (Sec. 31).
//
// NOTE: No DTO here ever exposes PasswordHash, SecurityStamp, ConcurrencyStamp
// or any other Identity internal. Same field-redaction discipline as
// EmployeeListDto in Phase 4 — enforced at the DTO boundary, not by trusting
// the serializer.
// =============================================================================

namespace AcmsDashboard.Api.Dtos;

/// <summary>Row shape for the admin user table.</summary>
public record UserListDto(
    string Id,
    string Username,
    string? Email,
    string Role,
    bool IsActive);

/// <summary>Single-user detail, used by the edit modal.</summary>
public record UserDetailDto(
    string Id,
    string Username,
    string? Email,
    string Role,
    bool IsActive,
    bool LockoutEnabled,
    DateTimeOffset? LockoutEnd,
    int AccessFailedCount);

/// <summary>Counts for the Admin Console KPI cards.</summary>
public record AdminStatsDto(
    int TotalUsers,
    int ActiveUsers,
    int InactiveUsers,
    Dictionary<string, int> ByRole);

// --- Requests ---------------------------------------------------------------

public record CreateUserRequest(
    string Username,
    string? Email,
    string Password,
    string Role);

public record UpdateUserRequest(
    string? Email);

public record SetRoleRequest(
    string Role);

public record SetStatusRequest(
    bool IsActive);

public record ResetPasswordRequest(
    string NewPassword);