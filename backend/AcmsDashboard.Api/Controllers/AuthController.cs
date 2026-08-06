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

        // Password is checked BEFORE the IsActive check, deliberately. If IsActive
        // were checked first, a caller could learn which usernames are deactivated
        // without knowing any password. Checking the password first means a wrong
        // password always returns the same generic UNAUTHORIZED, and
        // ACCOUNT_DISABLED is only ever shown to someone who already proved they
        // hold the credentials.
        if (user is null || !await _userManager.CheckPasswordAsync(user, req.Password))
        {
            _logger.LogWarning("Failed login attempt for {Username}", req.Username);
            return Unauthorized(new
            {
                success = false,
                error = new { code = "UNAUTHORIZED", message = "Invalid credentials" }
            });
        }

        // Phase 14: honours Admin Console deactivation. AdminController.SetStatus
        // must write to this SAME IsActive field for deactivation to actually take
        // effect - see the compatibility note at the bottom of this file.
        if (!user.IsActive)
        {
            _logger.LogWarning("Login attempt for deactivated account {Username}", req.Username);
            return Unauthorized(new
            {
                success = false,
                error = new
                {
                    code = "ACCOUNT_DISABLED",
                    message = "This account has been deactivated. Contact an administrator."
                }
            });
        }

        var roles = await _userManager.GetRolesAsync(user);
        var (token, expiresIn) = _tokenService.GenerateJwt(user, roles);

        return Ok(new
        {
            success = true,
            data = new LoginResponseDto(token, roles.FirstOrDefault(), expiresIn)
        });
    }
}
