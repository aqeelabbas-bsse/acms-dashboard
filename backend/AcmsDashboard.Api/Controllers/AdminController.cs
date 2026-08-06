// =============================================================================
// AcmsDashboard.Api/Controllers/AdminController.cs
// =============================================================================

using System.Security.Claims;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Identity;   // ApplicationUser
using AcmsDashboard.Api.Services;   // AuditHub  <-- verify namespace
using AcmsDashboard.Api.Validators; // AcmsRoles
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Route("v1/admin")]
[Authorize(Roles = "Admin")]   // whole controller is Admin-only, per FR-AUTH-04
public class AdminController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly RoleManager<IdentityRole> _roles;
    private readonly IHubContext<AuditHub> _hub;
    private readonly ILogger<AdminController> _log;

    public AdminController(
        UserManager<ApplicationUser> users,
        RoleManager<IdentityRole> roles,
        IHubContext<AuditHub> hub,
        ILogger<AdminController> log)
    {
        _users = users;
        _roles = roles;
        _hub = hub;
        _log = log;
    }

    // =========================================================================
    // GET /v1/admin/roles
    // =========================================================================

    /// <summary>The four roles seeded in Phase 3, for the role dropdown.</summary>
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _roles.Roles
            .Select(r => r.Name!)
            .OrderBy(n => n)
            .ToListAsync();

        return Ok(new { success = true, data = roles });
    }

    // =========================================================================
    // GET /v1/admin/stats
    // =========================================================================

    /// <summary>Counts for the Admin Console KPI cards.</summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var all = await _users.Users.ToListAsync();

        var byRole = new Dictionary<string, int>();
        foreach (var role in AcmsRoles.All)
        {
            var inRole = await _users.GetUsersInRoleAsync(role);
            byRole[role] = inRole.Count;
        }

        var active = all.Count(u => u.IsActive);

        var dto = new AdminStatsDto(
            TotalUsers: all.Count,
            ActiveUsers: active,
            InactiveUsers: all.Count - active,
            ByRole: byRole);

        return Ok(new { success = true, data = dto });
    }

    // =========================================================================
    // GET /v1/admin/users
    // =========================================================================

    /// <summary>
    /// Paginated, searchable user list. Optional filters: role, status
    /// ("active" | "inactive").
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] string? status = null)
    {
        if (page < 1) page = 1;
        if (limit is < 1 or > 100) limit = 25;

        // Role filtering has to happen through the role store, not the user
        // query, because the join table isn't exposed on UserManager.Users.
        List<ApplicationUser> candidates;
        if (!string.IsNullOrWhiteSpace(role))
        {
            if (!AcmsRoles.IsValid(role))
                return BadRequest(Error("VALIDATION_ERROR", $"Unknown role '{role}'."));

            candidates = (await _users.GetUsersInRoleAsync(role)).ToList();
        }
        else
        {
            candidates = await _users.Users.ToListAsync();
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            candidates = candidates
                .Where(u =>
                    (u.UserName ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase) ||
                    (u.Email ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var wantActive = status.Equals("active", StringComparison.OrdinalIgnoreCase);
            candidates = candidates.Where(u => u.IsActive == wantActive).ToList();
        }

        var total = candidates.Count;

        var pageItems = candidates
            .OrderBy(u => u.UserName, StringComparer.OrdinalIgnoreCase)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToList();

        // One role lookup per row. At limit <= 100 that's fine; if the user
        // count ever grows past a few hundred, replace with a single join
        // against AspNetUserRoles instead.
        var data = new List<UserListDto>(pageItems.Count);
        foreach (var u in pageItems)
        {
            data.Add(new UserListDto(
                Id: u.Id,
                Username: u.UserName ?? "-",
                Email: u.Email,
                Role: await PrimaryRoleAsync(u),
                IsActive: u.IsActive));
        }

        return Ok(new { success = true, data, meta = new { page, limit, total } });
    }

    // =========================================================================
    // GET /v1/admin/users/{id}
    // =========================================================================

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        var user = await _users.FindByIdAsync(id);
        if (user is null)
            return NotFound(Error("NOT_FOUND", "User not found."));

        return Ok(new { success = true, data = await ToDetailAsync(user) });
    }

    // =========================================================================
    // POST /v1/admin/users
    // =========================================================================

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
    {
        if (await _users.FindByNameAsync(req.Username) is not null)
            return Conflict(Error("CONFLICT", $"Username '{req.Username}' is already taken."));

        if (!await _roles.RoleExistsAsync(req.Role))
            return BadRequest(Error("VALIDATION_ERROR", $"Role '{req.Role}' does not exist."));

        var user = new ApplicationUser
        {
            UserName = req.Username,
            Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim(),
            // Internal, admin-provisioned accounts - there is no email
            // confirmation flow, and building one would contradict the
            // "no self-signup" decision made in Phase 9.
            EmailConfirmed = true,
            LockoutEnabled = true
        };

        var created = await _users.CreateAsync(user, req.Password);
        if (!created.Succeeded)
            return BadRequest(IdentityError(created));

        var assigned = await _users.AddToRoleAsync(user, req.Role);
        if (!assigned.Succeeded)
        {
            // Don't leave a roleless orphan account behind.
            await _users.DeleteAsync(user);
            return BadRequest(IdentityError(assigned));
        }

        _log.LogInformation("Admin {Actor} created user {User} with role {Role}",
            CurrentUsername(), user.UserName, req.Role);

        await BroadcastAsync("UserCreated", user.UserName!, $"Role: {req.Role}");

        return CreatedAtAction(nameof(GetUser), new { id = user.Id },
            new { success = true, data = await ToDetailAsync(user) });
    }

    // =========================================================================
    // PATCH /v1/admin/users/{id}
    // =========================================================================

    [HttpPatch("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest req)
    {
        var user = await _users.FindByIdAsync(id);
        if (user is null)
            return NotFound(Error("NOT_FOUND", "User not found."));

        user.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();

        var result = await _users.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(IdentityError(result));

        return Ok(new { success = true, data = await ToDetailAsync(user) });
    }

    // =========================================================================
    // PATCH /v1/admin/users/{id}/role
    // =========================================================================

    [HttpPatch("users/{id}/role")]
    public async Task<IActionResult> SetRole(string id, [FromBody] SetRoleRequest req)
    {
        var user = await _users.FindByIdAsync(id);
        if (user is null)
            return NotFound(Error("NOT_FOUND", "User not found."));

        if (!await _roles.RoleExistsAsync(req.Role))
            return BadRequest(Error("VALIDATION_ERROR", $"Role '{req.Role}' does not exist."));

        // --- Self-protection rules -------------------------------------------
        // Without these, an Admin can lock every Admin out of the system with
        // two clicks and the only recovery is a manual SQL update.

        if (await IsSelfAsync(user))
            return Conflict(Error("CONFLICT",
                "You cannot change your own role. Ask another Admin to do it."));

        var current = await PrimaryRoleAsync(user);
        if (current == AcmsRoles.Admin && req.Role != AcmsRoles.Admin && await IsLastAdminAsync(user))
            return Conflict(Error("CONFLICT",
                "This is the only Admin account. Promote another user to Admin first."));

        // ---------------------------------------------------------------------

        var existing = await _users.GetRolesAsync(user);
        if (existing.Count > 0)
        {
            var removed = await _users.RemoveFromRolesAsync(user, existing);
            if (!removed.Succeeded) return BadRequest(IdentityError(removed));
        }

        var added = await _users.AddToRoleAsync(user, req.Role);
        if (!added.Succeeded) return BadRequest(IdentityError(added));

        _log.LogInformation("Admin {Actor} changed {User} role {Old} -> {New}",
            CurrentUsername(), user.UserName, current, req.Role);

        await BroadcastAsync("UserRoleChanged", user.UserName!, $"{current} -> {req.Role}");

        return Ok(new { success = true, data = await ToDetailAsync(user) });
    }

    // =========================================================================
    // PATCH /v1/admin/users/{id}/status
    // =========================================================================

    /// <summary>
    /// Activate / deactivate. Deactivation is a soft flag rather than a delete,
    /// so the account's history and any FK references survive - the same
    /// soft-delete reasoning as IsActiveFlag on PersonalSmartCard.
    ///
    /// Writes directly to ApplicationUser.IsActive, the exact field
    /// AuthController.Login checks. This is what actually blocks (or restores)
    /// the ability to sign in - see AuthController.cs's compatibility note.
    /// </summary>
    [HttpPatch("users/{id}/status")]
    public async Task<IActionResult> SetStatus(string id, [FromBody] SetStatusRequest req)
    {
        var user = await _users.FindByIdAsync(id);
        if (user is null)
            return NotFound(Error("NOT_FOUND", "User not found."));

        if (!req.IsActive)
        {
            if (await IsSelfAsync(user))
                return Conflict(Error("CONFLICT", "You cannot deactivate your own account."));

            if (await PrimaryRoleAsync(user) == AcmsRoles.Admin && await IsLastAdminAsync(user))
                return Conflict(Error("CONFLICT",
                    "This is the only active Admin account and cannot be deactivated."));
        }

        user.IsActive = req.IsActive;

        var result = await _users.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(IdentityError(result));

        _log.LogInformation("Admin {Actor} set {User} active={Active}",
            CurrentUsername(), user.UserName, req.IsActive);

        await BroadcastAsync(req.IsActive ? "UserActivated" : "UserDeactivated", user.UserName!, null);

        return Ok(new { success = true, data = await ToDetailAsync(user) });
    }

    // =========================================================================
    // POST /v1/admin/users/{id}/reset-password
    // =========================================================================

    /// <summary>
    /// Admin-initiated password reset. Uses a generated reset token rather than
    /// writing a hash directly, so Identity's own validators and security stamp
    /// update still run - which invalidates the user's existing sessions.
    /// </summary>
    [HttpPost("users/{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, [FromBody] ResetPasswordRequest req)
    {
        var user = await _users.FindByIdAsync(id);
        if (user is null)
            return NotFound(Error("NOT_FOUND", "User not found."));

        var token = await _users.GeneratePasswordResetTokenAsync(user);
        var result = await _users.ResetPasswordAsync(user, token, req.NewPassword);

        if (!result.Succeeded)
            return BadRequest(IdentityError(result));

        _log.LogWarning("Admin {Actor} reset the password for {User}",
            CurrentUsername(), user.UserName);

        // Deliberately NOT broadcast to the audit feed - a password reset event
        // visible to every connected client is an unnecessary disclosure.

        return Ok(new { success = true, data = new { message = "Password updated." } });
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private async Task<string> PrimaryRoleAsync(ApplicationUser user)
    {
        var roles = await _users.GetRolesAsync(user);
        return roles.FirstOrDefault() ?? "-";
    }

    private async Task<UserDetailDto> ToDetailAsync(ApplicationUser user) => new(
        Id: user.Id,
        Username: user.UserName ?? "-",
        Email: user.Email,
        Role: await PrimaryRoleAsync(user),
        IsActive: user.IsActive,
        LockoutEnabled: user.LockoutEnabled,
        LockoutEnd: user.LockoutEnd,
        AccessFailedCount: user.AccessFailedCount);

    private async Task<bool> IsLastAdminAsync(ApplicationUser candidate)
    {
        var admins = await _users.GetUsersInRoleAsync(AcmsRoles.Admin);

        // "Last admin" means: no OTHER admin who is currently active.
        return !admins.Any(a => a.Id != candidate.Id && a.IsActive);
    }

    /// <summary>
    /// Resolves the caller. The claim key depends on how TokenService built the
    /// JWT in Phase 3, so this tries the three realistic candidates rather than
    /// relying on UserManager.GetUserAsync(User), which only reads
    /// NameIdentifier and silently returns null if you used "sub".
    /// </summary>
    private async Task<ApplicationUser?> CurrentUserAsync()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier)
                 ?? User.FindFirstValue("sub");

        if (!string.IsNullOrEmpty(id))
        {
            var byId = await _users.FindByIdAsync(id);
            if (byId is not null) return byId;

            // Some token layouts put the username in the NameIdentifier slot.
            var byName = await _users.FindByNameAsync(id);
            if (byName is not null) return byName;
        }

        var name = User.Identity?.Name
                   ?? User.FindFirstValue(ClaimTypes.Name)
                   ?? User.FindFirstValue("unique_name");

        return string.IsNullOrEmpty(name) ? null : await _users.FindByNameAsync(name);
    }

    private async Task<bool> IsSelfAsync(ApplicationUser target)
    {
        var me = await CurrentUserAsync();
        return me is not null && me.Id == target.Id;
    }

    private string CurrentUsername() =>
        User.Identity?.Name
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? "unknown";

    #region BROADCAST
    // If your Phase 5 code funnels everything through AuditBroadcaster, inject
    // that instead of IHubContext<AuditHub> and replace the body of this method
    // with your broadcaster call. The event name "AuditEvent" and the payload
    // shape below match the Phase 5 contract the Angular audit feed listens for.
    private async Task BroadcastAsync(string type, string subject, string? detail)
    {
        try
        {
            await _hub.Clients.All.SendAsync("AuditEvent", new
            {
                type,
                subject,
                detail,
                at = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            // A failed broadcast must never fail the write that already
            // succeeded - the user really was created, so return 201.
            _log.LogWarning(ex, "Audit broadcast failed for {Type}", type);
        }
    }
    #endregion

    private static object Error(string code, string message) =>
        new { success = false, error = new { code, message } };

    private static object IdentityError(IdentityResult result) =>
        new
        {
            success = false,
            error = new
            {
                code = "VALIDATION_ERROR",
                message = string.Join(" ", result.Errors.Select(e => e.Description))
            }
        };
}