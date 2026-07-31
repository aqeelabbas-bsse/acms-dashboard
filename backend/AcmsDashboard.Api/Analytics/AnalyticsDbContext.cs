using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Analytics;

/// <summary>
/// Owns the three ETL summary tables. Separate from the scaffolded AcmsDbContext
/// so `dotnet ef dbcontext scaffold --force` can never destroy it.
/// Tables are created by T-SQL (Phase 6, Step 1) — this context uses no migrations.
/// </summary>
public class AnalyticsDbContext : DbContext
{
    public AnalyticsDbContext(DbContextOptions<AnalyticsDbContext> options) : base(options) { }

    public DbSet<DailyCardStat> DailyCardStats => Set<DailyCardStat>();
    public DbSet<VisitorTrafficDaily> VisitorTrafficDaily => Set<VisitorTrafficDaily>();
    public DbSet<CardFunnelStat> CardFunnelStats => Set<CardFunnelStat>();
}