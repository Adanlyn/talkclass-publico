using FluentValidation;
using TalkClass.Application.Feedbacks.Dtos;

namespace TalkClass.Application.Feedbacks.Validators;


public class CreateFeedbackValidator : AbstractValidator<CreateFeedbackDto>

{
    public CreateFeedbackValidator()
    {
        RuleFor(x => x.CategoriaId).NotEmpty();
        RuleFor(x => x.Respostas).NotEmpty();

        RuleForEach(x => x.Respostas).ChildRules(r =>
        {
            r.RuleFor(z => z.PerguntaId).NotEmpty();
            r.RuleFor(z => z.Tipo).IsInEnum();
        });
    }

      private class RespostaValidator : AbstractValidator<RespostaDto>
    {
        public RespostaValidator()
        {
            RuleFor(r => r.PerguntaId).NotEmpty();
            RuleFor(r => r.Tipo).IsInEnum();
        }
    }
}
