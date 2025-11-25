using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TalkClass.Domain.Entities;
using TalkClass.Domain.Security;
using TalkClass.Infrastructure.Persistence;
using TalkClass.API.Services;

namespace TalkClass.API.Endpoints;

public record SaveAlertRuleRequest(string Nome, Guid? CategoriaId, decimal NotaMinima, int PeriodoDias, bool EnviarEmail, bool Ativa);
public record ToggleAlertRuleStatusRequest(bool Ativa);
public record SaveAlertEmailConfigRequest(List<Guid> AdminRecipients, string? ExtraEmails, string? SendMode, string? CriticalKeywords);

public static class AlertsEndpoints
{
    public static IEndpointRouteBuilder MapAlertEndpoints(this IEndpointRouteBuilder app)
    {
        var rulesGroup = app.MapGroup("/api/alert-rules")
            .RequireAuthorization()
            .WithTags("Alerts");

        rulesGroup.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var rules = await db.AlertRules
                .AsNoTracking()
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    id = r.Id,
                    nome = r.Nome,
                    categoriaId = r.CategoriaId,
                    notaMinima = r.NotaMinima,
                    periodoDias = r.PeriodoDias,
                    enviarEmail = r.EnviarEmail,
                    ativa = r.Ativa,
                    createdAt = r.CreatedAt,
                    updatedAt = r.UpdatedAt
                })
                .ToListAsync(ct);

            return Results.Ok(rules);
        });

        rulesGroup.MapPost("", async (SaveAlertRuleRequest dto, AppDbContext db, CancellationToken ct) =>
        {
            var validation = ValidateRule(dto);
            if (validation is not null) return validation;

            if (dto.CategoriaId.HasValue)
            {
                var exists = await db.Categorias
                    .AnyAsync(c => c.Id == dto.CategoriaId && c.Ativa, ct);
                if (!exists) return Results.BadRequest("Categoria não encontrada ou inativa.");
            }

            var entity = new AlertRule
            {
                Id = Guid.NewGuid(),
                Nome = dto.Nome.Trim(),
                CategoriaId = dto.CategoriaId,
                NotaMinima = dto.NotaMinima,
                PeriodoDias = dto.PeriodoDias,
                EnviarEmail = dto.EnviarEmail,
                Ativa = dto.Ativa,
                CreatedAt = DateTime.UtcNow
            };

            db.AlertRules.Add(entity);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/api/alert-rules/{entity.Id}", new
            {
                id = entity.Id,
                nome = entity.Nome,
                categoriaId = entity.CategoriaId,
                notaMinima = entity.NotaMinima,
                periodoDias = entity.PeriodoDias,
                enviarEmail = entity.EnviarEmail,
                ativa = entity.Ativa,
                createdAt = entity.CreatedAt,
                updatedAt = entity.UpdatedAt
            });
        });

        rulesGroup.MapPut("/{id:guid}", async (Guid id, SaveAlertRuleRequest dto, AppDbContext db, CancellationToken ct) =>
        {
            var validation = ValidateRule(dto);
            if (validation is not null) return validation;

            var rule = await db.AlertRules.FirstOrDefaultAsync(r => r.Id == id, ct);
            if (rule is null) return Results.NotFound();

            if (dto.CategoriaId.HasValue)
            {
                var exists = await db.Categorias
                    .AnyAsync(c => c.Id == dto.CategoriaId && c.Ativa, ct);
                if (!exists) return Results.BadRequest("Categoria não encontrada ou inativa.");
            }

            rule.Nome = dto.Nome.Trim();
            rule.CategoriaId = dto.CategoriaId;
            rule.NotaMinima = dto.NotaMinima;
            rule.PeriodoDias = dto.PeriodoDias;
            rule.EnviarEmail = dto.EnviarEmail;
            rule.Ativa = dto.Ativa;
            rule.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            return Results.Ok(new
            {
                id = rule.Id,
                nome = rule.Nome,
                categoriaId = rule.CategoriaId,
                notaMinima = rule.NotaMinima,
                periodoDias = rule.PeriodoDias,
                enviarEmail = rule.EnviarEmail,
                ativa = rule.Ativa,
                createdAt = rule.CreatedAt,
                updatedAt = rule.UpdatedAt
            });
        });

        rulesGroup.MapPatch("/{id:guid}/status", async (Guid id, ToggleAlertRuleStatusRequest dto, AppDbContext db, CancellationToken ct) =>
        {
            var rule = await db.AlertRules.FirstOrDefaultAsync(r => r.Id == id, ct);
            if (rule is null) return Results.NotFound();

            rule.Ativa = dto.Ativa;
            rule.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        var emailGroup = app.MapGroup("/api/alert-email-config")
            .RequireAuthorization()
            .WithTags("Alerts");

        emailGroup.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var cfg = await EnsureEmailConfig(db, ct);
            return Results.Ok(new
            {
                adminRecipients = cfg.AdminRecipientIds.Select(x => x.ToString()).ToList(),
                extraEmails = cfg.ExtraEmails,
                sendMode = NormalizeSendMode(cfg.SendMode),
                criticalKeywords = cfg.CriticalKeywords
            });
        });

        emailGroup.MapPut("", [Authorize(Roles = AdminRoles.Master)] async (
            SaveAlertEmailConfigRequest dto,
            AppDbContext db,
            CancellationToken ct) =>
        {
            var cfg = await EnsureEmailConfig(db, ct);

            var sendMode = NormalizeSendMode(dto.SendMode);

            var normalizedRecipients = (dto.AdminRecipients ?? new List<Guid>())
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (normalizedRecipients.Count > 0)
            {
                var existingIds = await db.Administradores
                    .Where(a => normalizedRecipients.Contains(a.Id) && a.IsActive)
                    .Select(a => a.Id)
                    .ToListAsync(ct);

                var missing = normalizedRecipients.Except(existingIds).ToList();
                if (missing.Count > 0)
                    return Results.BadRequest("Alguns administradores informados não existem ou estão inativos.");

                cfg.AdminRecipientIds = existingIds;
            }
            else
            {
                cfg.AdminRecipientIds = new List<Guid>();
            }

            cfg.ExtraEmails = (dto.ExtraEmails ?? string.Empty).Trim();
            cfg.SendMode = sendMode;
            cfg.CriticalKeywords = (dto.CriticalKeywords ?? string.Empty).Trim();
            cfg.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);

            return Results.Ok(new
            {
                adminRecipients = cfg.AdminRecipientIds.Select(x => x.ToString()).ToList(),
                extraEmails = cfg.ExtraEmails,
                sendMode = cfg.SendMode,
                criticalKeywords = cfg.CriticalKeywords
            });
        });

        rulesGroup.MapPost("/run", [Authorize(Roles = AdminRoles.Master)] async (
            AlertsProcessor processor,
            AlertNotificationsRecorder notificationsRecorder,
            CancellationToken ct) =>
        {
            var result = await processor.RunAsync(ct, forceSend: true);
            await notificationsRecorder.RecordAsync(result, ct);
            return Results.Ok(result);
        });

        return app;
    }

    private static IResult? ValidateRule(SaveAlertRuleRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            return Results.BadRequest("Nome é obrigatório.");
        if (dto.NotaMinima <= 0 || dto.NotaMinima > 5)
            return Results.BadRequest("A nota mínima deve estar entre 0 e 5.");
        if (dto.PeriodoDias < 1)
            return Results.BadRequest("O período em dias deve ser maior ou igual a 1.");

        return null;
    }

    private static string NormalizeSendMode(string? mode) =>
        string.Equals(mode, "daily", StringComparison.OrdinalIgnoreCase)
            ? "daily"
            : "immediate";

    private static async Task<AlertEmailConfig> EnsureEmailConfig(AppDbContext db, CancellationToken ct)
    {
        var cfg = await db.AlertEmailConfigs.FirstOrDefaultAsync(ct);
        if (cfg is not null) return cfg;

        cfg = new AlertEmailConfig
        {
            Id = Guid.NewGuid(),
            AdminRecipientIds = new List<Guid>(),
            ExtraEmails = string.Empty,
            SendMode = "immediate",
            CriticalKeywords = string.Empty,
            UpdatedAt = DateTime.UtcNow
        };
        db.AlertEmailConfigs.Add(cfg);
        await db.SaveChangesAsync(ct);
        return cfg;
    }
}
