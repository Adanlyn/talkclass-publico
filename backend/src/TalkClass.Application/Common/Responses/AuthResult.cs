namespace TalkClass.Application.Common.Responses;

public record AuthResult(string Token, int ExpiresInSeconds);
