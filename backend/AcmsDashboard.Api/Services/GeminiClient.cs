using System.Net;
using System.Net.Sockets;
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
        var apiKey = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new NlProviderException(
                "Gemini:ApiKey is not configured.", null, NlFailureKind.NotConfigured);
        }

        var model = _config["Gemini:Model"] ?? "gemini-2.5-flash";
        var url = $"v1beta/models/{model}:generateContent";

        var payload = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
            generationConfig = new
            {
                temperature,
                // Compound UNION-style questions have truncated mid-statement at
                // lower ceilings, producing invalid SQL rather than a clean
                // failure. Sized generously for that reason.
                maxOutputTokens = 2048,
            },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };

        request.Headers.Add("x-goog-api-key", apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new NlProviderException(
                "The AI service timed out.", ex, NlFailureKind.Timeout);
        }
        catch (HttpRequestException ex)
        {
            // Distinguishing "offline" from "server said no" matters: only the
            // former should park the provider. A DNS or socket failure arrives
            // wrapped inside HttpRequestException, so the inner exception is
            // where the answer actually is.
            var offline = ex.InnerException is SocketException
                       || ex.HttpRequestError is HttpRequestError.NameResolutionError
                                              or HttpRequestError.ConnectionError
                                              or HttpRequestError.SecureConnectionError;

            throw new NlProviderException(
                offline
                    ? "The AI service is unreachable (no network)."
                    : "Could not reach the AI service.",
                ex,
                offline ? NlFailureKind.Unreachable : NlFailureKind.Unknown);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Gemini returned {Status}: {Body}", (int)response.StatusCode, body);

            var (message, kind) = response.StatusCode switch
            {
                HttpStatusCode.TooManyRequests =>
                    ("The AI service quota has been reached.", NlFailureKind.Quota),
                HttpStatusCode.BadRequest =>
                    ("The AI service rejected the request (check the model name in configuration).",
                     NlFailureKind.BadRequest),
                HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized =>
                    ("The AI service rejected the API key.", NlFailureKind.Auth),
                HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout =>
                    ("The AI service is temporarily unavailable.", NlFailureKind.Timeout),
                _ =>
                    ("The AI service returned an error.", NlFailureKind.Unknown),
            };

            throw new NlProviderException(message, null, kind);
        }

        return ExtractText(body);
    }

    private static string ExtractText(string json)
    {
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) ||
            candidates.GetArrayLength() == 0)
        {
            throw new NlProviderException(
                "The AI service returned no answer (possibly blocked by its safety filters).",
                null, NlFailureKind.EmptyResponse);
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
        {
            throw new NlProviderException(
                "The AI service returned an empty response.", null, NlFailureKind.EmptyResponse);
        }

        return result;
    }
}