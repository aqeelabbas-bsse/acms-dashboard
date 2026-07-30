using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Authorize]
[Route("v1/visitor-rfid")]
public class VisitorRfidController : ControllerBase
{
    private readonly AcmsDbContext _db;
    private readonly IValidator<BlockCardRequest> _blockValidator;

    public VisitorRfidController(AcmsDbContext db, IValidator<BlockCardRequest> blockValidator)
    {
        _db = db;
        _blockValidator = blockValidator;
    }

    /// <summary>GET /v1/visitor-rfid — card status list.</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] bool? blocked)
    {
        var query = _db.VisitorsRfids.AsNoTracking().AsQueryable();

        if (blocked.HasValue)
            query = query.Where(c => c.IsBlocked == blocked.Value);

        var cards = await query
            .OrderBy(c => c.SmartCardNo)
            .Select(c => new VisitorRfidDto(
                c.SmartCardNo,
                c.IsActive ?? false,
                c.IsBlocked ?? false,
                c.CheckStatus ?? false,
                c.ActiveDate,
                c.BlockedDate))
            .ToListAsync();

        return Ok(new { success = true, data = cards, meta = new { count = cards.Count } });
    }

    /// <summary>PATCH /v1/visitor-rfid/{card}/block — mandatory reason (FR-VIS-04).</summary>
    [Authorize(Roles = "Security,Admin")]
    [HttpPatch("{card}/block")]
    public async Task<IActionResult> Block(string card, [FromBody] BlockCardRequest req)
    {
        var validation = await _blockValidator.ValidateAsync(req);
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

        var rfid = await _db.VisitorsRfids.FirstOrDefaultAsync(c => c.SmartCardNo == card);

        if (rfid is null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = $"Card {card} not found" } });

        if (rfid.IsBlocked == true)
            return Conflict(new { success = false, error = new { code = "CONFLICT", message = "Card is already blocked" } });

        var now = DateTime.UtcNow;

        rfid.IsBlocked = true;
        rfid.IsActive = false;
        rfid.CheckStatus = false;
        rfid.BlockedDate = now;

        // VisitorsRFID has no Remarks column — the mandatory reason is stored on
        // PersonalVisitorRFID instead. (Schema gap; logged for the supervisor.)
        var personal = await _db.PersonalVisitorRfids
            .Where(p => p.SmartCardNo == card)
            .OrderByDescending(p => p.ActivationDate)
            .FirstOrDefaultAsync();

        if (personal is not null)
        {
            personal.IsActive = false;
            personal.IsDeactive = true;
            personal.DeactiveDate = now;
            personal.Remarks = $"BLOCKED by {User.Identity?.Name} on {now:yyyy-MM-dd HH:mm} UTC — {req.Reason}";
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            data = new { smartCardNo = card, isBlocked = true, blockedDate = now, reason = req.Reason }
        });
    }
}