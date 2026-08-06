// =============================================================================
// AcmsDashboard.Api/Validators/AdminValidators.cs
// Phase 14 — Admin Console.
//
// One validator per admin request DTO. Registered automatically if you already
// call AddValidatorsFromAssemblyContaining<...>() in Program.cs (Phase 4).
// If you registered validators individually, add these four lines:
//
//   builder.Services.AddScoped<IValidator<CreateUserRequest>, CreateUserValidator>();
//   builder.Services.AddScoped<IValidator<UpdateUserRequest>, UpdateUserValidator>();
//   builder.Services.AddScoped<IValidator<SetRoleRequest>, SetRoleValidator>();
//   builder.Services.AddScoped<IValidator<ResetPasswordRequest>, ResetPasswordValidator>();
// =============================================================================

using AcmsDashboard.Api.Dtos;
using FluentValidation;

namespace AcmsDashboard.Api.Validators;

/// <summary>
/// The four roles seeded in Phase 3. Kept here as the single source of truth so
/// the validators and the controller cannot drift apart.
/// </summary>
public static class AcmsRoles
{
    public const string Admin = "Admin";
    public const string Security = "Security";
    public const string Printer = "Printer";
    public const string Viewer = "Viewer";

    public static readonly string[] All = { Admin, Security, Printer, Viewer };

    public static bool IsValid(string? role) =>
        role is not null && All.Contains(role, StringComparer.Ordinal);
}

public class CreateUserValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username is required.")
            .MinimumLength(3).WithMessage("Username must be at least 3 characters.")
            .MaximumLength(50)
            // Identity's default AllowedUserNameCharacters rejects anything outside
            // this set with a confusing InvalidUserName error, so catch it here first.
            .Matches("^[a-zA-Z0-9._@+-]+$")
            .WithMessage("Username may only contain letters, digits, and . _ @ + -");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(250)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            // Matches opt.Password.RequiredLength = 8 from Phase 3's AddIdentityCore.
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .MaximumLength(128);

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Role is required.")
            .Must(AcmsRoles.IsValid)
            .WithMessage("Role must be one of: Admin, Security, Printer, Viewer.");
    }
}

public class UpdateUserValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserValidator()
    {
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(250)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}

public class SetRoleValidator : AbstractValidator<SetRoleRequest>
{
    public SetRoleValidator()
    {
        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(AcmsRoles.IsValid)
            .WithMessage("Role must be one of: Admin, Security, Printer, Viewer.");
    }
}

public class ResetPasswordValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("New password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .MaximumLength(128);
    }
}