using Microsoft.AspNetCore.Identity;

namespace AcmsDashboard.Api.Identity;

public class ApplicationUser : IdentityUser
{
    public string? FullName { get; set; }
    public string? Cnic { get; set; }
    public bool IsActive { get; set; } = true;
}