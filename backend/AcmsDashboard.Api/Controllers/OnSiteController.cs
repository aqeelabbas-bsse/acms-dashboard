using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Authorize]
[Route("v1/onsite")]
public class OnSiteController : ControllerBase
{
    private readonly AcmsDbContext _db;

    public OnSiteController(AcmsDbContext db) => _db = db;

    /// <summary>GET /v1/onsite — everyone currently inside (ExitDate IS NULL).</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var onSite = await _db.VisitorInfos
            .AsNoTracking()
            .Where(v => v.ExitDate == null)
            .OrderBy(v => v.EntryDate)
            .Select(v => new VisitorListDto(
                v.Id, v.Cnic, v.Name, v.Designation, v.CompanyName, v.ContactNo,
                v.EntryDate, v.ExitDate, v.CardSerialNumber, true))
            .ToListAsync();

        return Ok(new { success = true, data = onSite, meta = new { count = onSite.Count } });
    }
}