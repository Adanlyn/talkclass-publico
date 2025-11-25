namespace TalkClass.Application.Common.Interfaces;

public interface IPasswordHasher
{
    string Hash(string plain);
    bool Verify(string plain, string hash);
}
