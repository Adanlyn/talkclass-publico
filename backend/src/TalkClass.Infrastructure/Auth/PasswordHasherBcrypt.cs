using TalkClass.Application.Common.Interfaces;

namespace TalkClass.Infrastructure.Auth;

public class PasswordHasherBcrypt : IPasswordHasher
{
    public string Hash(string plain) => BCrypt.Net.BCrypt.HashPassword(plain);
    public bool Verify(string plain, string hash) => BCrypt.Net.BCrypt.Verify(plain, hash);
}
