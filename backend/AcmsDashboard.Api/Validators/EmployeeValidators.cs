using AcmsDashboard.Api.Dtos;
using FluentValidation;

namespace AcmsDashboard.Api.Validators;

public class CreateEmployeeValidator : AbstractValidator<CreateEmployeeRequest>
{
    public CreateEmployeeValidator()
    {
        RuleFor(x => x.Cnic)
            .NotEmpty().WithMessage("CNIC is required")
            .Length(13, 15).WithMessage("CNIC must be 13-15 characters")
            .Matches(@"^\d+$").WithMessage("CNIC must contain digits only");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(150);

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Email must be a valid address")
            .MaximumLength(250)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.ContactNo).MaximumLength(50);
        RuleFor(x => x.Designation).MaximumLength(50);
    }
}