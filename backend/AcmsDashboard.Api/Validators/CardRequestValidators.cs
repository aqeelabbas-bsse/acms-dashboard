using AcmsDashboard.Api.Dtos;
using FluentValidation;

namespace AcmsDashboard.Api.Validators;

public class CreateCardRequestValidator : AbstractValidator<CreateCardRequestRequest>
{
    public CreateCardRequestValidator()
    {
        RuleFor(x => x.Cnic)
            .NotEmpty().WithMessage("CNIC is required")
            .Length(13, 15);

        RuleFor(x => x.Remarks).MaximumLength(500);
    }
}