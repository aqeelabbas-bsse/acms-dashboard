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

    /// <summary>POST /v1/agent/query - ask a natural-language question.</summary>
    [HttpPost("query")]
    [EnableRateLimiting("agent")]
    public async Task<IActionResult> Query([FromBody] AgentQueryRequest req)
    {
        var username = User.Identity?.Name;

        try
        {
            var answer = await _agent.AnswerAsync(req.Question, username, HttpContext.RequestAborted);
            return Ok(new { success = true, data = answer });
        }
        catch (UnsafeQueryException ex)
        {
            return StatusCode(403, new
            {
                success = false,
                error = new { code = "UNSAFE_QUERY", message = ex.Message }
            });
        }
        catch (GeminiException ex)
        {
            _logger.LogWarning(ex, "Gemini failure for user {User}", username);
            return StatusCode(503, new
            {
                success = false,
                error = new { code = "AI_UNAVAILABLE", message = ex.Message }
            });
        }
    }

    /// <summary>GET /v1/agent/suggestions - chips shown on first open (Phase 13 UI).</summary>
    [HttpGet("suggestions")]
    public IActionResult Suggestions() => Ok(new
    {
        success = true,
        data = new[]
        {
            "How many employees are registered?",
            "How many visitors are currently on site?",
            "How many card requests are still waiting to be printed?",
            "Which RFID cards are blocked?",
            "How many visitors checked in this month?",
            "What is the card request conversion rate?"
        }
    });
}