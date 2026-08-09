namespace AcmsDashboard.Api.Services;

/// <summary>
/// Tries Gemini first (higher quality, but quota-limited on the free tier).
/// On ANY failure - quota exhausted, auth error, timeout, network blip - falls
/// back to Ollama transparently. AgentService and the Angular UI never know a
/// fallback happened; the end user just gets an answer either way.
///
/// Failover is logged server-side only (Serilog), never surfaced in the API
/// response, per the "silent" requirement - a Security/Printer/Viewer user has
/// no reason to know or care which model answered their question.
/// </summary>
public class FailoverNlQueryClient : INlQueryClient
{
    private readonly GeminiClient _primary;
    private readonly OllamaClient _fallback;
    private readonly ILogger<FailoverNlQueryClient> _logger;

    public FailoverNlQueryClient(
        GeminiClient primary,
        OllamaClient fallback,
        ILogger<FailoverNlQueryClient> logger)
    {
        _primary = primary;
        _fallback = fallback;
        _logger = logger;
    }

    public async Task<string> GenerateAsync(
        string systemInstruction,
        string userPrompt,
        double temperature = 0,
        CancellationToken ct = default)
    {
        try
        {
            return await _primary.GenerateAsync(systemInstruction, userPrompt, temperature, ct);
        }
        catch (NlProviderException ex)
        {
            _logger.LogWarning(ex,
                "Gemini call failed, falling back to Ollama silently. Reason: {Reason}",
                ex.Message);

            try
            {
                return await _fallback.GenerateAsync(systemInstruction, userPrompt, temperature, ct);
            }
            catch (NlProviderException fallbackEx)
            {
                _logger.LogError(fallbackEx, "Ollama fallback also failed after Gemini failure.");
                throw new NlProviderException(
                    "The AI service is temporarily unavailable. Please try again shortly.",
                    fallbackEx);
            }
        }
    }
}