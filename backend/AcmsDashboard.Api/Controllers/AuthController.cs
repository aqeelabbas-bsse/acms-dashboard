using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Identity;
using AcmsDashboard.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AcmsDashboard.Api.Controllers;

[ApiController]
[Route("v1/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly TokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(UserManager<ApplicationUser> userManager, TokenService tokenService, ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _userManager.FindByNameAsync(req.Username);

        if (user is null || !await _userManager.CheckPasswordAsync(user, req.Password))
        {
            _logger.LogWarning("Failed login attempt for {Username}", req.Username);
            return Unauthorized(new { success = false, error = new { code = "UNAUTHORIZED", message = "Invalid credentials" } });
        }

        if (!user.IsActive)
            return Unauthorized(new { success = false, error = new { code = "UNAUTHORIZED", message = "Account is deactivated" } });

        var roles = await _userManager.GetRolesAsync(user);
        var (token, expiresIn) = _tokenService.GenerateJwt(user, roles);

        return Ok(new { success = true, data = new LoginResponseDto(token, roles.FirstOrDefault(), expiresIn) });
    }
}