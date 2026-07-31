using AcmsDashboard.Api.Services;
using Quartz;

namespace AcmsDashboard.Api.Jobs;

/// <summary>
/// Quartz job wrapper around EtlService. [DisallowConcurrentExecution] prevents
/// two overlapping runs from racing each other on the same summary rows.
/// </summary>
[DisallowConcurrentExecution]
public class DailyStatsJob : IJob
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DailyStatsJob> _logger;

    public DailyStatsJob(IServiceScopeFactory scopeFactory, ILogger<DailyStatsJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        // EtlService and both DbContexts are SCOPED (per HTTP request). A Quartz job
        // runs outside any request, so we must create a scope manually — otherwise
        // resolving a scoped service from the root provider throws at runtime.
        using var scope = _scopeFactory.CreateScope();
        var etl = scope.ServiceProvider.GetRequiredService<EtlService>();

        try
        {
            var result = await etl.RunAsync(ct: context.CancellationToken);
            _logger.LogInformation("Scheduled ETL wrote {Days} days of summary data", result.DaysProcessed);
        }
        catch (Exception ex)
        {
            // Never let an ETL failure crash the host — log and wait for the next tick.
            _logger.LogError(ex, "Scheduled ETL run failed");
        }
    }
}