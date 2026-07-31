using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AcmsDashboard.Api.Services;

/// <summary>
/// Server-push only. Clients never invoke methods on this hub — they subscribe
/// to "AuditEvent" and "OccupancyChanged" and the server broadcasts to them.
/// </summary>
[Authorize]
public class AuditHub : Hub
{
    private readonly ILogger<AuditHub> _logger;

    public AuditHub(ILogger<AuditHub> logger) => _logger = logger;

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation(
            "SignalR client connected: {ConnectionId} (user: {User})",
            Context.ConnectionId,
            Context.User?.Identity?.Name ?? "anonymous");

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "SignalR client disconnected: {ConnectionId}",
            Context.ConnectionId);

        await base.OnDisconnectedAsync(exception);
    }
}