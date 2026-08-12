using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Authorize]
[Route("v1/agent")]
public class AgentController : ControllerBase
{
    private readonly AgentService _agent;
    private readonly ILogger<AgentController> _logger;

    public AgentController(AgentService agent, ILogger<AgentController> logger)
    {
        _agent = agent;
        _logger = logger;
    }

    [HttpPost("query")]
    [EnableRateLimiting("agent")]
    public async Task<IActionResult> Query([FromBody] AgentQueryRequest req)
    {
        var username = User.Identity?.Name;

        try
        {
            var answer = await _agent.AnswerAsync(req.Question, username, HttpContext.RequestAborted);

            if (!User.IsInRole("Admin"))
                answer = answer with { GeneratedSql = null };

            return Ok(new { success = true, data = answer });
        }
        catch (UnsafeQueryException ex)
        {
            // Two different situations used to share one error code, and the UI
            // told the user their question "would have required writing to the
            // database" in both. That was true for roughly none of them - most
            // refusals were the model formatting its reply badly. Separating the
            // codes lets the UI say something that is actually true.
            //
            // 422 for "I understood you, I could not turn it into a valid query".
            // 403 stays for a genuine security stop.
            if (ex.Retryable)
            {
                return StatusCode(422, new
                {
                    success = false,
                    error = new { code = "QUERY_NOT_UNDERSTOOD", message = ex.Message },
                });
            }

            _logger.LogWarning("Agent security refusal for {User}: {Reason}", username, ex.Message);

            return StatusCode(403, new
            {
                success = false,
                error = new { code = "UNSAFE_QUERY", message = ex.Message },
            });
        }
        catch (NlProviderException ex)
        {
            _logger.LogWarning(ex, "AI provider failure for user {User}", username);
            return StatusCode(503, new
            {
                success = false,
                error = new { code = "AI_UNAVAILABLE", message = ex.Message },
            });
        }
    }

    [HttpGet("suggestions")]
    public IActionResult Suggestions() => Ok(new
    {
        success = true,
        data = new[]
        {
            "How many employees are registered?",
            "How many visitors are currently on site?",
            "How many card requests are still waiting to be printed?",
            "Which staff RFID cards are blocked?",
            "How many visitors checked in this month?",
            "What is the card request conversion rate?",
        },
    });
}