using TalkClass.Domain.Entities;

namespace TalkClass.Application.Common.Interfaces;

public interface IJwtTokenService
{
    (string token, DateTime expiresAtUtc) CreateToken(Administrador admin);
}
