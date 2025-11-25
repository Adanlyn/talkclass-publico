using Microsoft.EntityFrameworkCore;
using TalkClass.Application.Autenticacao.Commands;
using TalkClass.Application.Autenticacao.Responses;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Application.Common.Responses;
using TalkClass.Domain.ValueObjects;

namespace TalkClass.Application.Autenticacao.Handlers;

public class RealizarLoginHandler
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public RealizarLoginHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    public async Task<LoginAttemptResult> Handle(RealizarLoginCommand command, CancellationToken ct = default)
    {
        var req = command.Request;
        var targetCpf = new Cpf(req.Cpf);

        var admin = await _db.Administradores
            .AsNoTracking()
            .Where(a => a.Cpf == targetCpf)
            .SingleOrDefaultAsync(ct);

        if (admin is null)
            return LoginAttemptResult.InvalidCredentials();

        if (!admin.IsActive)
            return LoginAttemptResult.Inactive();

        if (!_hasher.Verify(req.Senha, admin.SenhaHash))
            return LoginAttemptResult.InvalidCredentials();

        var (token, exp) = _jwt.CreateToken(admin);
        var expiresIn = (int)Math.Max(1, (exp - DateTime.UtcNow).TotalSeconds);
        return LoginAttemptResult.Success(new AuthResult(token, expiresIn));
    }
}
