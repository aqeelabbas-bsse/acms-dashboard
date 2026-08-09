namespace AcmsDashboard.Api.Services;

/// <summary>
/// Thrown by any INlQueryClient implementation (Gemini, Ollama, ...) on
/// failure. Replaces the old GeminiException so AgentController and
/// AgentService only ever need one catch block, regardless of provider.
/// </summary>
public class NlProviderException : Exception
{
    public NlProviderException(string message, Exception? inner = null) : base(message, inner) { }
}