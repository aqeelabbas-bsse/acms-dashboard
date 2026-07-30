using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Models;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;


[ApiController]
[Authorize]
[Route("v1/employees")]
public class EmployeesController : ControllerBase
{
    private readonly AcmsDbContext _db;
    private readonly IValidator<CreateEmployeeRequest> _createValidator;

    public EmployeesController(AcmsDbContext db, IValidator<CreateEmployeeRequest> createValidator)
    {
        _db = db;
        _createValidator = createValidator;
    }

    /// <summary>GET /v1/employees — paginated, searchable list. All roles.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25)
    {
        if (page < 1) page = 1;
        limit = Math.Clamp(limit, 1, 100); // stop a caller requesting 1,000,000 rows

        var query = _db.PersonalSmartCards.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(e =>
                (e.Name != null && e.Name.Contains(search)) ||
                e.Cnic.Contains(search) ||
                (e.Designation != null && e.Designation.Contains(search)));
        }

        if (isActive.HasValue)
            query = query.Where(e => e.IsActiveFlag == isActive.Value);

        var total = await query.CountAsync();

        var items = await query
            .OrderBy(e => e.Name)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(e => new EmployeeListDto(e.Cnic, e.Name, e.Designation, e.IsActiveFlag ?? false))
            .ToListAsync();

        return Ok(new { success = true, data = items, meta = new { page, limit, total } });
    }

    /// <summary>GET /v1/employees/{cnic} — single profile.</summary>
    [HttpGet("{cnic}")]
    public async Task<IActionResult> GetOne(string cnic)
    {
        var employee = await _db.PersonalSmartCards
            .AsNoTracking()
            .Where(e => e.Cnic == cnic)
            .Select(e => new EmployeeDetailDto(
                e.Cnic, e.Name, e.FatherName, e.Designation, e.Rank,
                e.Email, e.ContactNo, e.CompanyName,
                e.ExpiryDate, e.Dob, e.IsActiveFlag ?? false))
            .FirstOrDefaultAsync();

        if (employee is null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = $"Employee {cnic} not found" } });

        return Ok(new { success = true, data = employee });
    }

    /// <summary>POST /v1/employees — Admin only.</summary>
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest req)
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

        if (await _db.PersonalSmartCards.AnyAsync(e => e.Cnic == req.Cnic))
        {
            return Conflict(new
            {
                success = false,
                error = new { code = "CONFLICT", message = $"CNIC {req.Cnic} is already registered" }
            });
        }

        var entity = new PersonalSmartCard
        {
            Cnic = req.Cnic,
            Name = req.Name,
            FatherName = req.FatherName,
            Designation = req.Designation,
            Email = req.Email,
            ContactNo = req.ContactNo,
            ExpiryDate = req.ExpiryDate,
            IsActiveFlag = true,
            EditDate = DateTime.UtcNow,
            EditByUserId = User.Identity?.Name
        };

        _db.PersonalSmartCards.Add(entity);
        await _db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetOne),
            new { cnic = entity.Cnic },
            new { success = true, data = new EmployeeListDto(entity.Cnic, entity.Name, entity.Designation, true) });
    }

    /// <summary>PATCH /v1/employees/{cnic} — Admin only. Partial update.</summary>
    [Authorize(Roles = "Admin")]
    [HttpPatch("{cnic}")]
    public async Task<IActionResult> Update(string cnic, [FromBody] UpdateEmployeeRequest req)
    {
        var entity = await _db.PersonalSmartCards.FirstOrDefaultAsync(e => e.Cnic == cnic);

        if (entity is null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = $"Employee {cnic} not found" } });

        // PATCH semantics: only overwrite fields the caller actually sent.
        if (req.Name is not null) entity.Name = req.Name;
        if (req.Designation is not null) entity.Designation = req.Designation;
        if (req.Email is not null) entity.Email = req.Email;
        if (req.ContactNo is not null) entity.ContactNo = req.ContactNo;
        if (req.ExpiryDate is not null) entity.ExpiryDate = req.ExpiryDate;
        if (req.IsActive is not null) entity.IsActiveFlag = req.IsActive;

        entity.EditDate = DateTime.UtcNow;
        entity.EditByUserId = User.Identity?.Name;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            data = new EmployeeListDto(entity.Cnic, entity.Name, entity.Designation, entity.IsActiveFlag ?? false)
        });
    }
}