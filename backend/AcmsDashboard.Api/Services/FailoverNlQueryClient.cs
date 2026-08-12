using System.Diagnostics;

namespace AcmsDashboard.Api.Services;

/// <summary>
/// Tries Gemini first (better answers, but quota-limited on the free tier) and
/// falls back to Ollama on any failure — quota exhausted, key rejected, timed
/// out, or no network at all.
///
/// The failover stays silent to the caller: AgentService and the Angular UI are
/// never told which model answered. A Security or Printer user has no reason to
/// know or care. It IS logged server-side, so the behaviour is auditable.
///
/// ── What changed, and why the offline case used to fail ──────────────────
/// Answering one question makes two model calls (generate SQL, then summarise).
/// Previously each of those tried Gemini and waited out its full 30-second
/// timeout before reaching Ollama, so an offline laptop spent up to a minute
/// on dead cloud calls per question, on top of Ollama's own work — and a cold
/// llama3.1:8b load can exceed its budget by itself. The browser gave up first
/// and reported a network error, even though nothing was actually broken.
///
/// NlProviderHealth now records that Gemini is unreachable the first time it
/// fails, and every call for the next 90 seconds goes straight to Ollama. Only
/// the first question after going offline pays the penalty.
/// </summary>
public class FailoverNlQueryClient : INlQueryClient
{
    private const string Primary = NlProviderHealth.Gemini;

    private readonly GeminiClient _primary;
    private readonly OllamaClient _fallback;
    private readonly NlProviderHealth _health;
    private readonly ILogger<FailoverNlQueryClient> _logger;

    public FailoverNlQueryClient(
        GeminiClient primary,
        OllamaClient fallback,
        NlProviderHealth health,
        ILogger<FailoverNlQueryClient> logger)
    {
        _primary = primary;
        _fallback = fallback;
        _health = health;
        _logger = logger;
    }

    public async Task<string> GenerateAsync(
        string systemInstruction,
        string userPrompt,
        double temperature = 0,
        CancellationToken ct = default)
    {
        if (_health.IsParked(Primary))
        {
            var remaining = _health.ParkedFor(Primary);
            _logger.LogDebug(
                "Skipping Gemini, parked for another {Seconds}s. Using local model.",
                (int)(remaining?.TotalSeconds ?? 0));

            return await FallbackAsync(systemInstruction, userPrompt, temperature, ct);
        }

        try
        {
            var sw = Stopwatch.StartNew();
            var result = await _primary.GenerateAsync(systemInstruction, userPrompt, temperature, ct);
            _health.ReportSuccess(Primary);
            _logger.LogDebug("Gemini answered in {Ms}ms.", sw.ElapsedMilliseconds);
            return result;
        }
        catch (NlProviderException ex)
        {
            _health.Report(Primary, ex.Kind);

            _logger.LogWarning(
                "Gemini failed ({Kind}: {Reason}). Falling back to the local model.",
                ex.Kind, ex.Message);

            return await FallbackAsync(systemInstruction, userPrompt, temperature, ct);
        }
    }

    private async Task<string> FallbackAsync(
        string systemInstruction, string userPrompt, double temperature, CancellationToken ct)
    {
        try
        {
            var sw = Stopwatch.StartNew();
            var result = await _fallback.GenerateAsync(systemInstruction, userPrompt, temperature, ct);
            _logger.LogInformation("Local model answered in {Ms}ms.", sw.ElapsedMilliseconds);
            return result;
        }
        catch (NlProviderException ex)
        {
            _logger.LogError(ex, "Local model failed as well. No provider available.");

            // Both providers are down, so the message has to be actionable
            // rather than a generic "try again" — the fix is almost always
            // either starting Ollama or reconnecting.
            throw new NlProviderException(
                "The assistant is unavailable. The online service could not be reached "
                + "and the local model did not respond — check that Ollama is running "
                + "(ollama serve), then try again.",
                ex,
                ex.Kind);
        }
    }
}