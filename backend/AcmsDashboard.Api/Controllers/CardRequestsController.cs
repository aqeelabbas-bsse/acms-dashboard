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
[Route("v1/card-requests")]
public class CardRequestsController : ControllerBase
{
    private readonly AcmsDbContext _db;
    private readonly IValidator<CreateCardRequestRequest> _createValidator;
    private readonly IAuditBroadcaster _audit;

    public CardRequestsController(
        AcmsDbContext db,
        IValidator<CreateCardRequestRequest> createValidator,
        IAuditBroadcaster audit)
    {
        _db = db;
        _createValidator = createValidator;
        _audit = audit;
    }

    /// <summary>GET /v1/card-requests?status=submitted|verified|printed</summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25)
    {
        if (page < 1) page = 1;
        limit = Math.Clamp(limit, 1, 100);

        // No declared FK between these tables (see Database Design Document, Sec. 4),
        // so the relationship is expressed as an explicit LEFT JOIN on CNIC.
        var query =
            from cr in _db.CardRequestProcesses.AsNoTracking()
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on cr.Cnic equals emp.Cnic into empGroup
            from emp in empGroup.DefaultIfEmpty()
            select new { cr, EmployeeName = emp != null ? emp.Name : null };

        query = status?.ToLowerInvariant() switch
        {
            "submitted" => query.Where(x => x.cr.IsVerified != true),
            "verified"  => query.Where(x => x.cr.IsVerified == true && x.cr.IsPrinted != true),
            "printed"   => query.Where(x => x.cr.IsPrinted == true),
            _           => query
        };

        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(x => x.cr.ProcessDate)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var items = rows.Select(x => new CardRequestListDto(
            x.cr.Crid,
            x.cr.Cnic,
            x.EmployeeName,
            x.cr.IsVerified ?? false,
            x.cr.IsPrinted ?? false,
            DeriveStatus(x.cr.IsVerified, x.cr.IsPrinted),
            x.cr.ProcessDate,
            x.cr.MarkedOn,
            x.cr.PrintingDate,
            x.cr.PrintBy,
            x.cr.Remarks));

        return Ok(new { success = true, data = items, meta = new { page, limit, total } });
    }

    /// <summary>POST /v1/card-requests — submit a new request.</summary>
    [Authorize(Roles = "Admin,Security")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCardRequestRequest req)
    {
        var validation = await _createValidator.ValidateAsync(req);
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

        // Enforce in code what the schema doesn't enforce as an FK.
        if (!await _db.PersonalSmartCards.AnyAsync(e => e.Cnic == req.Cnic))
        {
            return NotFound(new
            {
                success = false,
                error = new { code = "NOT_FOUND", message = $"No employee found with CNIC {req.Cnic}" }
            });
        }

        var entity = new CardRequestProcess
        {
            Cnic = req.Cnic,
            Remarks = req.Remarks,
            ProcessDate = DateTime.UtcNow,
            IsVerified = false,
            IsForward = false,
            IsPrinted = false
        };

        _db.CardRequestProcesses.Add(entity);
        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "CardRequestSubmitted",
            $"New card request submitted for CNIC {entity.Cnic}",
            User.Identity?.Name,
            new { crid = entity.Crid, cnic = entity.Cnic });

        return Ok(new { success = true, data = new { crid = entity.Crid, status = "submitted" } });
    }

    /// <summary>PATCH /v1/card-requests/{id}/verify — Security or Admin only.</summary>
    [Authorize(Roles = "Security,Admin")]
    [HttpPatch("{id:int}/verify")]
    public async Task<IActionResult> Verify(int id)
    {
        var request = await _db.CardRequestProcesses.FirstOrDefaultAsync(r => r.Crid == id);

        if (request is null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = $"Card request {id} not found" } });

        if (request.IsVerified == true)
            return Conflict(new { success = false, error = new { code = "CONFLICT", message = "This request is already verified" } });

        request.IsVerified = true;
        request.IsForward = true;
        request.MarkedOn = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "CardVerified",
            $"Card request #{request.Crid} verified",
            User.Identity?.Name,
            new { crid = request.Crid, cnic = request.Cnic });

        return Ok(new { success = true, data = new { crid = request.Crid, status = "verified", verifiedAt = request.MarkedOn } });
    }

    /// <summary>PATCH /v1/card-requests/{id}/print — Printer or Admin, and only if already verified.</summary>
    [Authorize(Roles = "Printer,Admin")]
    [HttpPatch("{id:int}/print")]
    public async Task<IActionResult> Print(int id)
    {
        var request = await _db.CardRequestProcesses.FirstOrDefaultAsync(r => r.Crid == id);

        if (request is null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = $"Card request {id} not found" } });

        // The workflow rule from the SRS: printing cannot skip verification.
        if (request.IsVerified != true)
        {
            return BadRequest(new
            {
                success = false,
                error = new { code = "VALIDATION_ERROR", message = "Request must be verified before it can be printed" }
            });
        }

        if (request.IsPrinted == true)
            return Conflict(new { success = false, error = new { code = "CONFLICT", message = "This request is already printed" } });

        request.IsPrinted = true;
        request.PrintingDate = DateTime.UtcNow;
        request.PrintBy = User.Identity?.Name;

        await _db.SaveChangesAsync();

        await _audit.BroadcastAsync(
            "CardPrinted",
            $"Card request #{request.Crid} printed",
            User.Identity?.Name,
            new { crid = request.Crid, cnic = request.Cnic });

        return Ok(new { success = true, data = new { crid = request.Crid, status = "printed", printedAt = request.PrintingDate } });
    }

    private static string DeriveStatus(bool? isVerified, bool? isPrinted)
    {
        if (isPrinted == true) return "printed";
        if (isVerified == true) return "verified";
        return "submitted";
    }
}