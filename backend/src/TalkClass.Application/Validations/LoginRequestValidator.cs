using FluentValidation;
using TalkClass.Application.Autenticacao.Dtos;
using TalkClass.Domain.ValueObjects;

namespace TalkClass.Application.Validations;

public class LoginRequestValidator : AbstractValidator<LoginRequestDto>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Cpf)
            .NotEmpty().WithMessage("CPF é obrigatório")
            .Must(Cpf.IsValid).WithMessage("CPF inválido");

        RuleFor(x => x.Senha)
            .NotEmpty().WithMessage("Senha é obrigatória")
            .MinimumLength(6).WithMessage("Senha deve ter ao menos 6 caracteres");
    }
}
