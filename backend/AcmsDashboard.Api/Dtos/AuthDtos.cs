namespace AcmsDashboard.Api.Dtos;

public record LoginRequest(string Username, string Password);
public record LoginResponseDto(string Token, string? Role, int ExpiresIn);