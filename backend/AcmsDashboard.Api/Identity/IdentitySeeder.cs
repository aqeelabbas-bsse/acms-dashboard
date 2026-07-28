using Microsoft.AspNetCore.Identity;

namespace AcmsDashboard.Api.Identity;

public static class IdentitySeeder
{
    private static readonly string[] Roles = { "Admin", "Security", "Printer", "Viewer" };

    public static async Task SeedAsync(IServiceProvider services, ILogger logger)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
                logger.LogInformation("Seeded role {Role}", role);
            }
        }

        await EnsureUserAsync(userManager, logger, "admin", "admin@nastp.gov.pk", "Admin@12345", "Muhammad Aqeel Abbas", "3520112345671", "Admin");
        await EnsureUserAsync(userManager, logger, "security1", "security1@nastp.gov.pk", "Security@12345", "Hassan Raza", "3520512345675", "Security");
        await EnsureUserAsync(userManager, logger, "printer1", "printer1@nastp.gov.pk", "Printer@12345", "Bilal Ahmed", "3520312345673", "Printer");
        await EnsureUserAsync(userManager, logger, "viewer1", "viewer1@nastp.gov.pk", "Viewer@12345", "Ayesha Khan", "3520212345672", "Viewer");
    }

    private static async Task EnsureUserAsync(UserManager<ApplicationUser> userManager, ILogger logger,
        string username, string email, string password, string fullName, string cnic, string role)
    {
        if (await userManager.FindByNameAsync(username) is not null) return;

        var user = new ApplicationUser { UserName = username, Email = email, EmailConfirmed = true, FullName = fullName, Cnic = cnic, IsActive = true };
        var result = await userManager.CreateAsync(user, password);

        if (!result.Succeeded)
        {
            logger.LogError("Failed to seed {Username}: {Errors}", username, string.Join("; ", result.Errors.Select(e => e.Description)));
            return;
        }

        await userManager.AddToRoleAsync(user, role);
        logger.LogInformation("Seeded user {Username} with role {Role}", username, role);
    }
}