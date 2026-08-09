namespace AcmsDashboard.Api.Services;

/// <summary>
/// Provider-agnostic contract for the NL agent's SQL-generation and
/// answer-summarisation calls. GeminiClient and OllamaClient both implement
/// this so AgentService never needs to know which LLM is actually answering.
/// </summary>
public interface INlQueryClient
{
    Task<string> GenerateAsync(
        string systemInstruction,
        string userPrompt,
        double temperature = 0,
        CancellationToken ct = default);
}