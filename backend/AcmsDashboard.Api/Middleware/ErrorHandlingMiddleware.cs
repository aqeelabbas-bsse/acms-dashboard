namespace AcmsDashboard.Api.Middleware;

/// <summary>
/// Catches any unhandled exception from downstream middleware/controllers and
/// converts it into the standard { success, error } envelope defined in the
/// API Specification, instead of leaking a raw stack-trace page.
/// </summary>
public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ErrorHandlingMiddleware(
        RequestDelegate next,
        ILogger<ErrorHandlingMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception for {Method} {Path}",
                ctx.Request.Method, ctx.Request.Path);

            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/json";

            await ctx.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new
                {
                    code = "INTERNAL_ERROR",
                    // In production, never expose ex.Message — EF exceptions can
                    // contain table names, column names, even connection details.
                    message = _env.IsDevelopment()
                        ? ex.Message
                        : "An unexpected error occurred."
                }
            });
        }
    }
}