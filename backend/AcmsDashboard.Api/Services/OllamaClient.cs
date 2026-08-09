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
            options = new { temperature }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/generate")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new NlProviderException(
                "The local AI service (Ollama) timed out. Is 'ollama serve' running?", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new NlProviderException(
                "Could not reach Ollama. Confirm it's running on the configured URL.", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Ollama returned {Status}: {Body}", (int)response.StatusCode, body);

            throw new NlProviderException(response.StatusCode switch
            {
                System.Net.HttpStatusCode.NotFound =>
                    $"Ollama model '{model}' isn't pulled locally. Run: ollama pull {model}",
                _ => "The local AI service returned an error."
            });
        }

        return ExtractText(body);
    }

    private static string ExtractText(string json)
    {
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("response", out var responseEl))
            throw new NlProviderException("Ollama returned an unexpected response shape.");

        var result = responseEl.GetString()?.Trim() ?? "";

        if (string.IsNullOrEmpty(result))
            throw new NlProviderException("Ollama returned an empty response.");

        return result;
    }
}