using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Models;
using AcmsDashboard.Api.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Authorize]
[Route("v1/visitors")]
public class VisitorsController : ControllerBase
{
    private readonly AcmsDbContext _db;
    private readonly IValidator<RegisterVisitorRequest> _registerValidator;
    private readonly IAuditBroadcaster _audit;

    public VisitorsController(
        AcmsDbContext db,
        IValidator<RegisterVisitorRequest> registerValidator,
        IAuditBroadcaster audit)
    {
        _db = db;
        _registerValidator = registerValidator;
        _audit = audit;
    }

    /// <summary>GET /v1/visitors?onSite=true</summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] bool? onSite,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25)
    {
        if (page < 1) page = 1;
        limit = Math.Clamp(limit, 1, 100);

        var query = _db.VisitorInfos.AsNoTracking().AsQueryable();

        if (onSite == true) query = query.Where(v => v.ExitDate == null);
        if (onSite == false) query = query.Where(v => v.ExitDate != null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(v =>
                (v.Name != null && v.Name.Contains(search)) ||
                v.Cnic.Contains(search) ||
                (v.CompanyName != null && v.CompanyName.Contains(search)));
        }

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(v => v.EntryDate)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(v => new VisitorListDto(
                v.Id, v.Cnic, v.Name, v.Designation, v.CompanyName, v.ContactNo,
                v.EntryDate, v.ExitDate, v.CardSerialNumber, v.ExitDate == null))
            .ToListAsync();

        return Ok(new { success = true, data = items, meta = new { page, limit, total } });
    }

    /// <summary>POST /v1/visitors — register / check in a visitor.</summary>
    [Authorize(Roles = "Security,Admin")]
    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterVisitorRequest req)
    {
        var validation = await _registerValidator.ValidateAsync(req);
        if (!validation.IsValid)
        {
            return BadRequest(new
            {
                success = false,
                error = new
                {
                    code = "VALIDATION_ERROR",
                    message = string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))
                }
            });
        }

        // A visitor already on-site cannot check in again.
        if (await _db.VisitorInfos.AnyAsync(v => v.Cnic == req.Cnic && v.ExitDate == null))
        {
            return Conflict(new
            {
                success = false,
                error = new { code = "CONFLICT", message = $"Visitor {req.Cnic} is already checked in" }
            });
        }

        var now = DateTime.UtcNow;

        var visitor = new VisitorInfo
        {
            Cnic = req.Cnic,
            Name = req.Name,
            Designation = req.Designation,
            CompanyName = req.CompanyName,
            ContactNo = req.ContactNo,
            Email = req.Email,
            CardSerialNumber = req.CardSerialNumber,
            CardStatus = req.CardSerialNumber != null,
            CardActivationDate = req.CardSerialNumber != null ? now : null,
            EntryDate = now,
            ExitDate = null,
            LoginId = User.Identity?.Name,
            Action = "CheckIn",
            LastAccessed = now
        };

        _db.VisitorInfos.Add(visitor);

        // Mark the physical RFID card as checked-in, if one was issued.
        if (!string.IsNullOrWhiteSpace(req.CardSerialNumber))
        {
            var card = await _db.VisitorsRfids
                .FirstOrDefaultAsync(c => c.SmartCardNo == req.CardSerialNumber);

            if (card is not null)
            {
                if (card.IsBlocked == true)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = new { code = "VALIDATION_ERROR", message = $"Card {req.CardSerialNumber} is blocked and cannot be issued" }
                    });
                }

                card.IsActive = true;
                card.CheckStatus = true;
                card.CheckDate = now;
                card.CheckOutDate = null;
            }
        }

        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "VisitorCheckedIn",
            $"{visitor.Name} ({visitor.CompanyName}) checked in",
            User.Identity?.Name,
            new { id = visitor.Id, cnic = visitor.Cnic, card = visitor.CardSerialNumber });

        await _audit.BroadcastOccupancyAsync();   // FR-RT-02: live occupancy counter

        return Ok(new
        {
            success = true,
            data = new { id = visitor.Id, cnic = visitor.Cnic, entryDate = visitor.EntryDate }
        });
    }

    /// <summary>PATCH /v1/visitors/{id}/checkout — record exit.</summary>
    [Authorize(Roles = "Security,Admin")]
    [HttpPatch("{id:long}/checkout")]
    public async Task<IActionResult> Checkout(long id)
    {
        var visitor = await _db.VisitorInfos.FirstOrDefaultAsync(v => v.Id == id);

        if (visitor is null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = $"Visitor {id} not found" } });

        if (visitor.ExitDate is not null)
            return Conflict(new { success = false, error = new { code = "CONFLICT", message = "Visitor has already checked out" } });

        var now = DateTime.UtcNow;

        visitor.ExitDate = now;
        visitor.CardDeactivationDate = now;
        visitor.CardStatus = false;
        visitor.Action = "CheckOut";
        visitor.LastAccessed = now;
        visitor.LoginId = User.Identity?.Name;

        if (!string.IsNullOrWhiteSpace(visitor.CardSerialNumber))
        {
            var card = await _db.VisitorsRfids
                .FirstOrDefaultAsync(c => c.SmartCardNo == visitor.CardSerialNumber);

            if (card is not null)
            {
                card.CheckStatus = false;
                card.CheckOutDate = now;
                card.IsActive = false;
            }
        }

        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "VisitorCheckedOut",
            $"{visitor.Name} checked out",
            User.Identity?.Name,
            new { id = visitor.Id, cnic = visitor.Cnic });

        await _audit.BroadcastOccupancyAsync();

        return Ok(new { success = true, data = new { id = visitor.Id, exitDate = visitor.ExitDate } });
    }
}