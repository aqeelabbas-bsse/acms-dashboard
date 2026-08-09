using System.Text;
using System.Text.Json;

namespace AcmsDashboard.Api.Services;

public class GeminiClient : INlQueryClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<GeminiClient> _logger;

    public GeminiClient(HttpClient http, IConfiguration config, ILogger<GeminiClient> logger)
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
        var apiKey = _config["Gemini:ApiKey"]
            ?? throw new NlProviderException("Gemini:ApiKey is not configured.");

        var model = _config["Gemini:Model"] ?? "gemini-2.5-flash";
        var url = $"v1beta/models/{model}:generateContent";

        var payload = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
            generationConfig = new
            {
                temperature,
                maxOutputTokens = 1024
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        request.Headers.Add("x-goog-api-key", apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new NlProviderException("The AI service timed out. Please try again.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new NlProviderException("Could not reach the AI service. Check your connection.", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Gemini returned {Status}: {Body}", (int)response.StatusCode, body);

            throw new NlProviderException(response.StatusCode switch
            {
                System.Net.HttpStatusCode.TooManyRequests =>
                    "The AI service free-tier quota has been reached. Please try again later.",
                System.Net.HttpStatusCode.BadRequest =>
                    "The AI service rejected the request (check the model name in configuration).",
                System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.Unauthorized =>
                    "The AI service rejected the API key.",
                _ => "The AI service returned an error."
            });
        }

        return ExtractText(body);
    }

    private static string ExtractText(string json)
    {
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) ||
            candidates.GetArrayLength() == 0)
        {
            throw new NlProviderException("The AI service returned no answer (possibly blocked by its safety filters).");
        }

        var parts = candidates[0].GetProperty("content").GetProperty("parts");
        var sb = new StringBuilder();

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var text))
                sb.Append(text.GetString());
        }

        var result = sb.ToString().Trim();

        if (string.IsNullOrEmpty(result))
            throw new NlProviderException("The AI service returned an empty response.");

        return result;
    }
}