using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace AcmsDashboard.Api.Identity;

/// <summary>
/// Used ONLY by design-time EF tools (`dotnet ef migrations`, `dotnet ef database update`).
/// Builds its own minimal configuration — independent of Program.cs — so that
/// design-time commands don't fail if something else in Program.cs (like the
/// Jwt:Secret check) throws before the DbContext would normally be registered.
/// Never used at actual app runtime; Program.cs's AddDbContext handles that.
/// </summary>
public class AppIdentityDbContextFactory : IDesignTimeDbContextFactory<AppIdentityDbContext>
{
    public AppIdentityDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets<Program>(optional: true) // reads the same user-secrets store
            .Build();

        var connectionString = config.GetConnectionString("AcmsDb")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:AcmsDb not found. Run: dotnet user-secrets set \"ConnectionStrings:AcmsDb\" \"...\"");

        var optionsBuilder = new DbContextOptionsBuilder<AppIdentityDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new AppIdentityDbContext(optionsBuilder.Options);
    }
}