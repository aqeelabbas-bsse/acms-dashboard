using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace AcmsDashboard.Api.Services;

public class OllamaClient : INlQueryClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<OllamaClient> _logger;

    public OllamaClient(HttpClient http, IConfiguration config, ILogger<OllamaClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<string> GenerateAsync(
        string systemInstruction,
        string userPrompt,
        double temperature = 0,
        CancellationToken ct = default)
    {
        var model = _config["Ollama:Model"] ?? "llama3.1:8b";

        var payload = new
        {
            model,
            system = systemInstruction,
            prompt = userPrompt,
            stream = false,
            // keep_alive is the single most important setting for the offline
            // path. llama3.1:8b is roughly 4.9 GB; loading it from disk can take
            // longer than the whole request budget on a laptop. Ollama's default
            // is to unload after 5 minutes idle, so during a demo the model was
            // being evicted and reloaded between questions — which is what made
            // "the first one after a pause" feel broken. Holding it resident for
            // 30 minutes costs RAM and nothing else.
            keep_alive = _config["Ollama:KeepAlive"] ?? "30m",
            options = new
            {
                temperature,
                // A SQL statement is short. Capping the prediction stops the
                // model rambling past the query and burning the timeout budget
                // on prose the validator is only going to strip anyway.
                num_predict = _config.GetValue<int?>("Ollama:MaxTokens") ?? 512,
            },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/generate")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new NlProviderException(
                "The local model timed out. If this is the first question after starting "
                + "the server, the model was still loading — try once more.",
                ex, NlFailureKind.Timeout);
        }
        catch (HttpRequestException ex)
        {
            var offline = ex.InnerException is SocketException
                       || ex.HttpRequestError is HttpRequestError.ConnectionError
                                              or HttpRequestError.NameResolutionError;

            throw new NlProviderException(
                offline
                    ? "Ollama is not running. Start it with: ollama serve"
                    : "Could not reach Ollama on the configured URL.",
                ex,
                offline ? NlFailureKind.Unreachable : NlFailureKind.Unknown);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Ollama returned {Status}: {Body}", (int)response.StatusCode, body);

            var (message, kind) = response.StatusCode switch
            {
                HttpStatusCode.NotFound =>
                    ($"The local model '{model}' is not installed. Run: ollama pull {model}",
                     NlFailureKind.NotConfigured),
                _ =>
                    ("The local model returned an error.", NlFailureKind.Unknown),
            };

            throw new NlProviderException(message, null, kind);
        }

        return ExtractText(body);
    }

    private static string ExtractText(string json)
    {
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("response", out var responseEl))
        {
            throw new NlProviderException(
                "Ollama returned an unexpected response shape.", null, NlFailureKind.EmptyResponse);
        }

        var result = responseEl.GetString()?.Trim() ?? "";

        if (string.IsNullOrEmpty(result))
        {
            throw new NlProviderException(
                "Ollama returned an empty response.", null, NlFailureKind.EmptyResponse);
        }

        return result;
    }
}