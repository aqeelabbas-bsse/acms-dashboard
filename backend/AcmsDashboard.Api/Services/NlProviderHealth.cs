using System.Collections.Concurrent;

namespace AcmsDashboard.Api.Services;

/// <summary>
/// A small circuit breaker in front of the cloud provider.
///
/// ── The problem this solves ──────────────────────────────────────────────
/// Answering one question makes TWO model calls: generate the SQL, then
/// summarise the results. Without a breaker, each of those independently
/// tries Gemini first and waits out its full timeout before falling back.
/// With the laptop offline that is two dead 30-second waits per question on
/// top of the Ollama work, which is what produced the "network error" the
/// user saw — the browser gave up long before the server did.
///
/// Once Gemini has failed for a reason that will still be true a second
/// later — no network, quota gone, key rejected — this parks it so every
/// subsequent call goes straight to Ollama. The very first question after
/// going offline still pays one timeout; nothing after it does.
///
/// Registered as a singleton on purpose: the whole point is that state
/// outlives the request that discovered it.
/// </summary>
public class NlProviderHealth
{

    public const string Gemini = "gemini";
    private readonly ILogger<NlProviderHealth> _logger;
    private readonly ConcurrentDictionary<string, DateTimeOffset> _parkedUntil = new();

    public NlProviderHealth(ILogger<NlProviderHealth> logger) => _logger = logger;

    /// <summary>Offline is usually transient — recheck soon so a reconnected
    /// laptop goes back to the better model without a restart.</summary>
    private static readonly TimeSpan NetworkCooldown = TimeSpan.FromSeconds(90);

    /// <summary>The free tier's daily cap does not reset in minutes. Backing
    /// off hard here is what keeps the demo responsive after the 25th question
    /// rather than adding a pointless timeout to every one that follows.</summary>
    private static readonly TimeSpan QuotaCooldown = TimeSpan.FromMinutes(20);

    /// <summary>A rejected key will not fix itself, but never rechecking would
    /// mean a restart is required after correcting configuration.</summary>
    private static readonly TimeSpan AuthCooldown = TimeSpan.FromMinutes(10);

    public bool IsParked(string provider) =>
        _parkedUntil.TryGetValue(provider, out var until) && DateTimeOffset.UtcNow < until;

    public TimeSpan? ParkedFor(string provider) =>
        _parkedUntil.TryGetValue(provider, out var until) && DateTimeOffset.UtcNow < until
            ? until - DateTimeOffset.UtcNow
            : null;

    /// <summary>
    /// Records a failure. Returns true if the provider was parked as a result.
    ///
    /// BadRequest and EmptyResponse deliberately do NOT park: those depend on
    /// the specific prompt, so the next question may well succeed and parking
    /// would needlessly downgrade every later answer.
    /// </summary>
    public bool Report(string provider, NlFailureKind kind)
    {
        var cooldown = kind switch
        {
            NlFailureKind.Unreachable => NetworkCooldown,
            NlFailureKind.Timeout => NetworkCooldown,
            NlFailureKind.Quota => QuotaCooldown,
            NlFailureKind.Auth => AuthCooldown,
            NlFailureKind.NotConfigured => AuthCooldown,
            _ => TimeSpan.Zero,
        };

        if (cooldown == TimeSpan.Zero) return false;

        _parkedUntil[provider] = DateTimeOffset.UtcNow + cooldown;

        _logger.LogWarning(
            "NL provider {Provider} parked for {Seconds}s after {Kind}. " +
            "Subsequent questions will use the fallback without retrying it.",
            provider, (int)cooldown.TotalSeconds, kind);

        return true;
    }

    /// <summary>Clears the park after a successful call.</summary>
    public void ReportSuccess(string provider)
    {
        if (_parkedUntil.TryRemove(provider, out _))
            _logger.LogInformation("NL provider {Provider} is reachable again.", provider);
    }
}