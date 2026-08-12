using System.Text;
using System.Text.Json;

namespace AcmsDashboard.Api.Services;

/// <summary>
/// Loads the local model into memory shortly after the API starts, so the first
/// real question does not pay for it.
///
/// llama3.1:8b is roughly 4.9 GB. Reading that off disk takes tens of seconds on
/// a laptop, and it happens on the FIRST generate call — which, in the offline
/// case, is a call a user is sitting and waiting on. That cold load is what
/// pushed the first offline question past the request timeout and produced the
/// "network error" the user reported. Paying it at startup, in the background,
/// moves the cost somewhere nobody is watching.
///
/// Deliberately best-effort and completely silent on failure: Ollama being
/// absent is a perfectly normal development state (the cloud provider handles
/// everything while there is a network), and the API must start regardless.
/// Nothing here can prevent or delay startup.
/// </summary>
public class OllamaWarmupService : BackgroundService
{
    private readonly IHttpClientFactory _factory;
    private readonly IConfiguration _config;
    private readonly ILogger<OllamaWarmupService> _logger;

    public OllamaWarmupService(
        IHttpClientFactory factory,
        IConfiguration config,
        ILogger<OllamaWarmupService> logger)
    {
        _factory = factory;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_config.GetValue("Ollama:WarmOnStartup", true))
            return;

        // Let the API finish binding and serving before competing for disk and
        // CPU with a multi-gigabyte model load.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var model = _config["Ollama:Model"] ?? "llama3.1:8b";

        try
        {
            // AddHttpClient<OllamaClient> registers a named client under the
            // type name, so the base address and timeout configured in
            // Program.cs are reused here rather than duplicated.
            var http = _factory.CreateClient(nameof(OllamaClient));

            // An empty prompt asks Ollama to load the model and stop. It is the
            // documented way to warm a model without generating anything.
            var payload = new
            {
                model,
                prompt = "",
                stream = false,
                keep_alive = _config["Ollama:KeepAlive"] ?? "30m",
            };

            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await http.PostAsync("api/generate", content, stoppingToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "Local model '{Model}' warmed and held in memory. The offline "
                    + "fallback is ready.", model);
            }
            else
            {
                _logger.LogInformation(
                    "Local model warm-up skipped: Ollama replied {Status}. The offline "
                    + "fallback will still work, but the first question will be slower.",
                    (int)response.StatusCode);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down mid-warm-up. Not a problem.
        }
        catch (Exception ex)
        {
            _logger.LogInformation(
                "Local model warm-up skipped ({Reason}). This is expected when Ollama "
                + "is not running; the online provider is unaffected.", ex.Message);
        }
    }
}