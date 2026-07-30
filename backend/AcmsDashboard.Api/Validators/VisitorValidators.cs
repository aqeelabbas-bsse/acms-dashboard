using AcmsDashboard.Api.Dtos;
using FluentValidation;

namespace AcmsDashboard.Api.Validators;

public class RegisterVisitorValidator : AbstractValidator<RegisterVisitorRequest>
{
    public RegisterVisitorValidator()
    {
        RuleFor(x => x.Cnic).NotEmpty().Length(13, 15);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(250);
        RuleFor(x => x.CompanyName).MaximumLength(350);
        RuleFor(x => x.Email)
            .EmailAddress()
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}

public class BlockCardValidator : AbstractValidator<BlockCardRequest>
{
    public BlockCardValidator()
    {
        // FR-VIS-04: the remark is mandatory, not optional
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required when blocking a card")
            .MinimumLength(5).WithMessage("Reason must be at least 5 characters")
            .MaximumLength(1500);
    }
}