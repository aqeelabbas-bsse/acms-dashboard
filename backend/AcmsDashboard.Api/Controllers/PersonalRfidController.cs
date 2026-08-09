using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

/// <summary>
/// dbo.PersonalRFID — EMPLOYEE card-to-personnel mapping.
///
/// Deliberately a separate controller from VisitorRfidController rather than a
/// mode flag on it. The two card populations have different lifecycles (a staff
/// card is issued after a CardRequestProcess approval and lives for years; a
/// visitor pass is issued at a gate and dies the same day), different roles
/// acting on them, and different columns. Merging them is what produced the
/// "personal and visitor cards are mixed up" problem in the first place.
/// </summary>
[ApiController]
[Authorize]
[Route("v1/personal-rfid")]
public class PersonalRfidController : ControllerBase
{
    private readonly AcmsDbContext _db;
    private readonly IValidator<BlockPersonalCardRequest> _blockValidator;
    private readonly IValidator<ReactivatePersonalCardRequest> _reactivateValidator;
    private readonly IAuditBroadcaster _audit;

    public PersonalRfidController(
        AcmsDbContext db,
        IValidator<BlockPersonalCardRequest> blockValidator,
        IValidator<ReactivatePersonalCardRequest> reactivateValidator,
        IAuditBroadcaster audit)
    {
        _db = db;
        _blockValidator = blockValidator;
        _reactivateValidator = reactivateValidator;
        _audit = audit;
    }

    /// <summary>
    /// GET /v1/personal-rfid — paginated staff card list.
    /// Filters: ?status=active|blocked|inactive, ?search=, ?page=, ?limit=
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25)
    {
        if (page < 1) page = 1;
        limit = Math.Clamp(limit, 1, 200);

        var query = _db.PersonalRfids.AsNoTracking().AsQueryable();

        query = status?.ToLowerInvariant() switch
        {
            // "Blocked" is derived, not stored: a card is blocked when it has
            // been deactivated AND its Remarks carry the block marker. A plain
            // deactivation (card handed back on resignation) is NOT a block, and
            // conflating the two would inflate the blocked-cards KPI.
            "blocked"  => query.Where(c => c.IsDeactive == true
                                        && c.Remarks != null
                                        && c.Remarks.Contains(BlockReasons.Marker)),
            "active"   => query.Where(c => c.IsActive == true),
            "inactive" => query.Where(c => c.IsActive != true
                                        && (c.Remarks == null
                                            || !c.Remarks.Contains(BlockReasons.Marker))),
            _ => query
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(c =>
                (c.Cnic != null && c.Cnic.Contains(s)) ||
                (c.SmartCardNo != null && c.SmartCardNo.Contains(s)));
        }

        var total = await query.CountAsync();

        // Join to PersonalSmartCard for the holder's name/designation. There is
        // no declared FK, so this is an explicit join on CNIC by convention —
        // left-joined so a card whose holder profile is missing still appears in
        // the grid rather than silently disappearing.
        var rows = await query
            .OrderByDescending(c => c.ActivationDate)
            .ThenBy(c => c.RegId)
            .Skip((page - 1) * limit)
            .Take(limit)
            .GroupJoin(
                _db.PersonalSmartCards.AsNoTracking(),
                card => card.Cnic,
                emp => emp.Cnic,
                (card, emps) => new { card, emps })
            .SelectMany(
                x => x.emps.DefaultIfEmpty(),
                (x, emp) => new { x.card, emp })
            .ToListAsync();

        var data = rows.Select(r => new PersonalRfidDto(
            r.card.RegId,
            r.card.Cnic,
            r.emp != null ? r.emp.Name : null,
            r.emp != null ? r.emp.Designation : null,
            r.card.SmartCardNo,
            r.card.IsActive ?? false,
            r.card.IsDeactive ?? false,
            IsBlocked(r.card.Remarks, r.card.IsDeactive),
            IsBlocked(r.card.Remarks, r.card.IsDeactive)
                ? BlockReasons.Parse(r.card.Remarks)
                : null,
            r.card.FullAccess ?? 0,
            r.card.ActivationDate,
            r.card.DeactiveDate,
            r.card.ActionDate,
            r.card.CardStatus,
            r.card.ExportStatus)).ToList();

        return Ok(new
        {
            success = true,
            data,
            meta = new { page, limit, total }
        });
    }

    /// <summary>GET /v1/personal-rfid/block-reasons — vocabulary for the UI dropdown.</summary>
    [HttpGet("block-reasons")]
    public IActionResult BlockReasonList() => Ok(new
    {
        success = true,
        data = BlockReasons.All
            .Select(code => new { code, label = BlockReasons.Labels[code] })
            .ToList()
    });

    /// <summary>PATCH /v1/personal-rfid/{regId}/block — categorised, mandatory reason.</summary>
    [Authorize(Roles = "Security,Admin")]
    [HttpPatch("{regId:int}/block")]
    public async Task<IActionResult> Block(int regId, [FromBody] BlockPersonalCardRequest req)
    {
        var validation = await _blockValidator.ValidateAsync(req);
        if (!validation.IsValid) return ValidationFailed(validation);

        var card = await _db.PersonalRfids.FirstOrDefaultAsync(c => c.RegId == regId);
        if (card is null) return NotFoundCard(regId);

        if (IsBlocked(card.Remarks, card.IsDeactive))
        {
            return Conflict(new
            {
                success = false,
                error = new { code = "CONFLICT", message = "Card is already blocked" }
            });
        }

        var now = DateTime.UtcNow;

        card.IsActive = false;
        card.IsDeactive = true;
        card.DeactiveDate = now;
        card.ActionDate = now;
        card.Remarks = BlockReasons.Compose(req.Category, req.Reason, User.Identity?.Name);

        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "PersonalCardBlocked",
            $"Staff card {card.SmartCardNo ?? regId.ToString()} blocked — {BlockReasons.Labels[req.Category]}",
            User.Identity?.Name,
            new { regId, smartCardNo = card.SmartCardNo, category = req.Category, reason = req.Reason });

        return Ok(new
        {
            success = true,
            data = new
            {
                regId,
                smartCardNo = card.SmartCardNo,
                isBlocked = true,
                blockReason = req.Category,
                deactiveDate = now
            }
        });
    }

    /// <summary>PATCH /v1/personal-rfid/{regId}/reactivate — undo a block.</summary>
    [Authorize(Roles = "Security,Admin")]
    [HttpPatch("{regId:int}/reactivate")]
    public async Task<IActionResult> Reactivate(int regId, [FromBody] ReactivatePersonalCardRequest req)
    {
        var validation = await _reactivateValidator.ValidateAsync(req);
        if (!validation.IsValid) return ValidationFailed(validation);

        var card = await _db.PersonalRfids.FirstOrDefaultAsync(c => c.RegId == regId);
        if (card is null) return NotFoundCard(regId);

        if (card.IsActive == true)
        {
            return Conflict(new
            {
                success = false,
                error = new { code = "CONFLICT", message = "Card is already active" }
            });
        }

        var now = DateTime.UtcNow;

        card.IsActive = true;
        card.IsDeactive = false;
        card.ReactivateDate = now;
        card.ActionDate = now;

        // The block marker is cleared so the card leaves the blocked bucket, but
        // the previous remark is preserved as history rather than overwritten —
        // losing why a card was ever blocked would defeat the audit trail.
        card.Remarks = $"REACTIVATED {now:yyyy-MM-dd HH:mm} UTC by {User.Identity?.Name ?? "system"} — "
                     + $"{req.Reason} | previously: {card.Remarks?.Replace(BlockReasons.Marker, "(was ") ?? "n/a"}";

        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "PersonalCardReactivated",
            $"Staff card {card.SmartCardNo ?? regId.ToString()} reactivated",
            User.Identity?.Name,
            new { regId, smartCardNo = card.SmartCardNo, reason = req.Reason });

        return Ok(new
        {
            success = true,
            data = new { regId, smartCardNo = card.SmartCardNo, isBlocked = false, reactivateDate = now }
        });
    }

    /* ---------------------------------------------------------------- helpers */

    private static bool IsBlocked(string? remarks, bool? isDeactive) =>
        isDeactive == true
        && remarks is not null
        && remarks.Contains(BlockReasons.Marker, StringComparison.Ordinal);

    private IActionResult ValidationFailed(FluentValidation.Results.ValidationResult v) =>
        BadRequest(new
        {
            success = false,
            error = new
            {
                code = "VALIDATION_ERROR",
                message = string.Join("; ", v.Errors.Select(e => e.ErrorMessage))
            }
        });

    private IActionResult NotFoundCard(int regId) =>
        NotFound(new
        {
            success = false,
            error = new { code = "NOT_FOUND", message = $"Personal RFID registration {regId} not found" }
        });
}