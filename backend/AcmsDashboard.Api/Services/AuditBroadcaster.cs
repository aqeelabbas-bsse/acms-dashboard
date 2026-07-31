using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Services;

public interface IAuditBroadcaster
{
    Task BroadcastAsync(string type, string description, string? actor, object? payload = null);
    Task BroadcastOccupancyAsync();
}

public class AuditBroadcaster : IAuditBroadcaster
{
    private readonly IHubContext<AuditHub> _hub;
    private readonly AcmsDbContext _db;
    private readonly ILogger<AuditBroadcaster> _logger;

    public AuditBroadcaster(
        IHubContext<AuditHub> hub,
        AcmsDbContext db,
        ILogger<AuditBroadcaster> logger)
    {
        _hub = hub;
        _db = db;
        _logger = logger;
    }

    public async Task BroadcastAsync(string type, string description, string? actor, object? payload = null)
    {
        var evt = new AuditEventDto(type, description, actor, DateTime.UtcNow, payload);

        try
        {
            await _hub.Clients.All.SendAsync("AuditEvent", evt);
            _logger.LogInformation("Broadcast {Type}: {Description}", type, description);
        }
        catch (Exception ex)
        {
            // Critical design decision: a broadcast failure must NEVER fail the
            // HTTP request that triggered it. The card was still verified; only
            // the live notification was lost. Log it and move on.
            _logger.LogError(ex, "Failed to broadcast audit event {Type}", type);
        }
    }

    public async Task BroadcastOccupancyAsync()
    {
        try
        {
            var count = await _db.VisitorInfos.CountAsync(v => v.ExitDate == null);
            await _hub.Clients.All.SendAsync("OccupancyChanged", new
            {
                onSiteNow = count,
                at = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast occupancy update");
        }
    }
}