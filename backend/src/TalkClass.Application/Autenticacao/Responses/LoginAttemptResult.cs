using TalkClass.Application.Common.Responses;

namespace TalkClass.Application.Autenticacao.Responses;

public enum LoginFailureReason
{
    None = 0,
    InvalidCredentials = 1,
    Inactive = 2
}

public record LoginAttemptResult(AuthResult? AuthResult, LoginFailureReason FailureReason)
{
    public bool IsSuccess => AuthResult is not null;

    public static LoginAttemptResult Success(AuthResult result) =>
        new(result, LoginFailureReason.None);

    public static LoginAttemptResult InvalidCredentials() =>
        new(null, LoginFailureReason.InvalidCredentials);

    public static LoginAttemptResult Inactive() =>
        new(null, LoginFailureReason.Inactive);
}
