using AcmsDashboard.Api.Dtos;
using FluentValidation;

namespace AcmsDashboard.Api.Validators;

public class BlockPersonalCardValidator : AbstractValidator<BlockPersonalCardRequest>
{
    public BlockPersonalCardValidator()
    {
        // Mirrors FR-VIS-04's mandatory-remark rule, applied to staff cards.
        // The category is what makes the "blocked cards, reason-wise" drill-down
        // possible at all, so it is required and must come from the fixed list —
        // free-typed categories would fragment the chart into one-row buckets.
        RuleFor(x => x.Category)
            .NotEmpty().WithMessage("A block category is required")
            .Must(BlockReasons.IsValid)
            .WithMessage($"Category must be one of: {string.Join(", ", BlockReasons.All)}");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required when blocking a card")
            .MinimumLength(5).WithMessage("Reason must be at least 5 characters")
            .MaximumLength(1000);
    }
}

public class ReactivatePersonalCardValidator : AbstractValidator<ReactivatePersonalCardRequest>
{
    public ReactivatePersonalCardValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required when reactivating a card")
            .MinimumLength(5).WithMessage("Reason must be at least 5 characters")
            .MaximumLength(1000);
    }
}