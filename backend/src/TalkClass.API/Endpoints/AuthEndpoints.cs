using FluentValidation;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using TalkClass.API.Dtos;
using TalkClass.Application.Autenticacao.Commands;
using TalkClass.Application.Autenticacao.Dtos;
using TalkClass.Application.Autenticacao.Handlers;
using TalkClass.Application.Autenticacao.Responses;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Application.Common.Responses;
using TalkClass.Domain.Entities;
using TalkClass.Domain.ValueObjects;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Endpoints;

public static class AuthEndpoints
{
    private const int PasswordResetExpirationMinutes = 5;

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth");

        g.MapPost("/login",
            async Task<Results<Ok<LoginResponseDto>, UnauthorizedHttpResult, BadRequest<string>>>
            (LoginRequestDto dto, IValidator<LoginRequestDto> validator, RealizarLoginHandler handler, CancellationToken ct) =>
            {
                var val = await validator.ValidateAsync(dto, ct);
                if (!val.IsValid)
                    return TypedResults.BadRequest(string.Join("; ", val.Errors.Select(e => e.ErrorMessage)));

                var attempt = await handler.Handle(new RealizarLoginCommand(dto), ct);
                if (!attempt.IsSuccess)
                {
                    return attempt.FailureReason switch
                    {
                        LoginFailureReason.Inactive => TypedResults.BadRequest("Seu usuário foi desativado. Procure um administrador."),
                        _ => TypedResults.Unauthorized()
                    };
                }

                var result = attempt.AuthResult!;
                return TypedResults.Ok(new LoginResponseDto(result.Token, result.ExpiresInSeconds));
            });

        g.MapPost("/forgot-password",
            async Task<Results<Ok<ForgotPasswordResponse>, BadRequest<string>>>
            (ForgotPasswordRequest dto, AppDbContext db, IEmailSender emailSender, CancellationToken ct) =>
            {
                if (!Cpf.TryParse(dto.Cpf, out var cpf))
                    return TypedResults.BadRequest("CPF inválido.");

                string? emailMask = null;

                var admin = await db.Administradores
                    .Where(a => a.Cpf == cpf)
                    .SingleOrDefaultAsync(ct);

                if (admin is not null && !admin.IsActive)
                    return TypedResults.BadRequest("Conta desativada. Procure um administrador.");

                if (admin is not null && !string.IsNullOrWhiteSpace(admin.Email))
                {
                    emailMask = MaskEmail(admin.Email);

                    var now = DateTime.UtcNow;

                    var existingTokens = await db.PasswordResetTokens
                        .Where(t => t.AdministradorId == admin.Id && t.UsedAt == null)
                        .ToListAsync(ct);

                    foreach (var t in existingTokens)
                        t.UsedAt = now;

                    var plainToken = GenerateResetToken();
                    var resetToken = new PasswordResetToken
                    {
                        AdministradorId = admin.Id,
                        TokenHash = ComputeTokenHash(plainToken),
                        CreatedAt = now,
                        ExpiresAt = now.AddMinutes(PasswordResetExpirationMinutes)
                    };

                    db.PasswordResetTokens.Add(resetToken);
                    await db.SaveChangesAsync(ct);

                    var body = BuildResetEmailBody(admin.Nome, plainToken);
                    await emailSender.SendAsync(admin.Email!, "Redefinição de senha", body, ct);
                }

                var expiresIn = PasswordResetExpirationMinutes * 60;
                return TypedResults.Ok(new ForgotPasswordResponse(emailMask, expiresIn));
            });

        g.MapPost("/verify-reset-token",
            async Task<Results<Ok<VerifyResetTokenResponse>, BadRequest<string>>>
            (VerifyResetTokenRequest dto, AppDbContext db, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(dto.Token))
                    return TypedResults.BadRequest("Token é obrigatório.");

                var tokenHash = ComputeTokenHash(dto.Token);
                var now = DateTime.UtcNow;

                var resetToken = await db.PasswordResetTokens
                    .Include(t => t.Administrador)
                    .Where(t => t.TokenHash == tokenHash)
                    .SingleOrDefaultAsync(ct);

                if (resetToken is null || resetToken.Administrador is null)
                    return TypedResults.BadRequest("Token inválido.");

                if (resetToken.UsedAt is not null || resetToken.ExpiresAt <= now)
                    return TypedResults.BadRequest("Token expirado ou já utilizado.");

                if (!resetToken.Administrador.IsActive)
                    return TypedResults.BadRequest("Conta desativada.");

                var remainingSeconds = (int)Math.Max(0, Math.Ceiling((resetToken.ExpiresAt - now).TotalSeconds));
                return TypedResults.Ok(new VerifyResetTokenResponse(remainingSeconds));
            });

        g.MapPost("/reset-password",
            async Task<Results<NoContent, BadRequest<string>>>
            (ResetPasswordRequest dto, AppDbContext db, IPasswordHasher hasher, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(dto.Token))
                    return TypedResults.BadRequest("Token é obrigatório.");

                if (string.IsNullOrWhiteSpace(dto.NovaSenha) || dto.NovaSenha.Trim().Length < 6)
                    return TypedResults.BadRequest("Nova senha deve ter ao menos 6 caracteres.");

                var tokenHash = ComputeTokenHash(dto.Token);

                var resetToken = await db.PasswordResetTokens
                    .Include(t => t.Administrador)
                    .Where(t => t.TokenHash == tokenHash)
                    .SingleOrDefaultAsync(ct);

                if (resetToken is null || resetToken.Administrador is null)
                    return TypedResults.BadRequest("Token inválido.");

                var now = DateTime.UtcNow;
                if (resetToken.UsedAt is not null || resetToken.ExpiresAt <= now)
                    return TypedResults.BadRequest("Token expirado ou já utilizado.");

                var admin = resetToken.Administrador;
                if (!admin.IsActive)
                    return TypedResults.BadRequest("Conta desativada.");

                admin.SenhaHash = hasher.Hash(dto.NovaSenha.Trim());
                admin.MustChangePassword = false;
                resetToken.UsedAt = now;

                var otherTokens = await db.PasswordResetTokens
                    .Where(t => t.AdministradorId == admin.Id && t.UsedAt == null && t.Id != resetToken.Id)
                    .ToListAsync(ct);

                foreach (var t in otherTokens)
                    t.UsedAt = now;

                await db.SaveChangesAsync(ct);
                return TypedResults.NoContent();
            });

        g.MapPost("/change-password",
            async Task<Results<NoContent, BadRequest<string>, UnauthorizedHttpResult>>
            (ChangePasswordRequest dto, ClaimsPrincipal user, AppDbContext db, IPasswordHasher hasher, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(dto.NovaSenha) || dto.NovaSenha.Trim().Length < 6)
                    return TypedResults.BadRequest("Nova senha deve ter ao menos 6 caracteres.");

                if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var adminId))
                    return TypedResults.Unauthorized();

                var admin = await db.Administradores
                    .FirstOrDefaultAsync(a => a.Id == adminId && a.IsActive, ct);

                if (admin is null) return TypedResults.Unauthorized();

                if (!hasher.Verify(dto.SenhaAtual ?? string.Empty, admin.SenhaHash))
                    return TypedResults.BadRequest("Senha atual incorreta.");

                admin.SenhaHash = hasher.Hash(dto.NovaSenha.Trim());
                admin.MustChangePassword = false;

                await db.SaveChangesAsync(ct);
                return TypedResults.NoContent();
            }).RequireAuthorization();

        return app;
    }

    private static string? MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var parts = email.Split('@', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2) return email;

        var local = parts[0];
        var domain = parts[1];

        if (local.Length <= 2)
            return $"{local[0]}***@{domain}";

        var visibleStart = local.Substring(0, 2);
        var visibleEnd = local[^1];
        var mask = new string('*', Math.Max(1, local.Length - 3));
        return $"{visibleStart}{mask}{visibleEnd}@{domain}";
    }

    private static string GenerateResetToken(int length = 6)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var chars = new char[length];
        Span<byte> buffer = stackalloc byte[length];
        RandomNumberGenerator.Fill(buffer);

        for (var i = 0; i < length; i++)
        {
            chars[i] = alphabet[buffer[i] % alphabet.Length];
        }

        return new string(chars);
    }

    private static string ComputeTokenHash(string token)
    {
        var normalized = token.Trim();
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static string BuildResetEmailBody(string nome, string token)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Ola {nome},");
        sb.AppendLine();
        sb.AppendLine("Recebemos um pedido para redefinir a sua senha no TalkClass.");
        sb.AppendLine("Use o codigo abaixo para concluir o processo (valido por 5 minutos):");
        sb.AppendLine();
        sb.AppendLine($"Token: {token}");
        sb.AppendLine();
        sb.AppendLine("Se voce nao solicitou, ignore este e-mail.");
        sb.AppendLine();
        sb.AppendLine("Equipe TalkClass");
        return sb.ToString();
    }
}

public record ChangePasswordRequest(string SenhaAtual, string NovaSenha);
public record ForgotPasswordRequest(string Cpf);
public record ForgotPasswordResponse(string? EmailMask, int ExpiresInSeconds);
public record VerifyResetTokenRequest(string Token);
public record VerifyResetTokenResponse(int RemainingSeconds);
public record ResetPasswordRequest(string Token, string NovaSenha);
