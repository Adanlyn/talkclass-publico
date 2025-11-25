using TalkClass.Application.Autenticacao.Dtos;
using TalkClass.Application.Common.Responses;

namespace TalkClass.Application.Autenticacao.Commands;

public record RealizarLoginCommand(LoginRequestDto Request);
