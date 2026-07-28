using AcmsDashboard.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Route("v1/employees")]
public class EmployeesController : ControllerBase
{
    private readonly AcmsDbContext _db;

    public EmployeesController(AcmsDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var employees = await _db.PersonalSmartCards
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Cnic,
                e.Name,
                e.Designation,
                IsActive = e.IsActiveFlag ?? false
            })
            .Take(5)
            .ToListAsync();

        return Ok(new { success = true, data = employees });
    }
}