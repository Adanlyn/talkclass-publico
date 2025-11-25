using System;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Domain.Entities;
using TalkClass.Domain.Security;
using TalkClass.Domain.ValueObjects;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Endpoints;

public record AdminUserListQuery(string? search = null, string? role = null, bool? active = null, int page = 1, int pageSize = 20);
public record CreateAdminUserRequest(string Nome, string Cpf, string Senha, string Role, string? Email = null, bool? IsActive = null);
public record UpdateAdminUserRequest(string Nome, string Cpf, string Role, bool IsActive, string? Email = null, string? NovaSenha = null);
public record UpdateAdminUserStatusRequest(bool IsActive);
public record AdminUserSummary(Guid Id, string Nome, string? Email, string Cpf, string Role, bool IsActive, DateTime CreatedAt);

public static class AdminUsersEndpoints
{
    public static IEndpointRouteBuilder MapAdminUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin-users")
                       .RequireAuthorization()
                       .WithTags("AdminUsers");

        group.MapGet("", async ([AsParameters] AdminUserListQuery qp, AppDbContext db, CancellationToken ct) =>
        {
            var query = db.Administradores.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(qp.search))
            {
                var term = qp.search.Trim();
                var digits = new string(term.Where(char.IsDigit).ToArray());

                if (string.IsNullOrEmpty(digits))
                {
                    query = query.Where(a =>
                        EF.Functions.ILike(a.Nome, $"%{term}%") ||
                        (a.Email != null && EF.Functions.ILike(a.Email, $"%{term}%")));
                }
                else
                {
                    query = query.Where(a =>
                        EF.Functions.ILike(a.Nome, $"%{term}%") ||
                        (a.Email != null && EF.Functions.ILike(a.Email, $"%{term}%")) ||
                        EF.Functions.Like(a.Cpf.Value, $"%{digits}%"));
                }
            }

            if (!string.IsNullOrWhiteSpace(qp.role) && AdminRoles.IsValid(qp.role))
            {
                var role = AdminRoles.Normalize(qp.role);
                query = query.Where(a => a.Roles == role);
            }

            if (qp.active.HasValue)
            {
                query = query.Where(a => a.IsActive == qp.active.Value);
            }

            var page = Math.Max(1, qp.page);
            var pageSize = Math.Clamp(qp.pageSize, 1, 100);

            var total = await query.CountAsync(ct);
            var rawItems = await query
                .OrderBy(a => a.Nome)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AdminUserSummary(
                    a.Id,
                    a.Nome,
                    a.Email,
                    a.Cpf.Value,
                    a.Roles,
                    a.IsActive,
                    a.CreatedAt))
                .ToListAsync(ct);

            var items = rawItems
                .Select(x => new
                {
                    id = x.Id,
                    nome = x.Nome,
                    email = x.Email,
                    cpf = x.Cpf,
                    role = AdminRoles.Normalize(x.Role),
                    isActive = x.IsActive,
                    createdAt = x.CreatedAt,
                })
                .ToList();

            return Results.Ok(new { total, page, pageSize, items });
        });

        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Administradores.AsNoTracking()
                .Where(a => a.Id == id)
                .Select(a => new AdminUserSummary(
                    a.Id,
                    a.Nome,
                    a.Email,
                    a.Cpf.Value,
                    a.Roles,
                    a.IsActive,
                    a.CreatedAt))
                .SingleOrDefaultAsync(ct);

            if (user is null) return Results.NotFound();

            return Results.Ok(new
            {
                id = user.Id,
                nome = user.Nome,
                email = user.Email,
                cpf = user.Cpf,
                role = AdminRoles.Normalize(user.Role),
                isActive = user.IsActive,
                createdAt = user.CreatedAt,
            });
        });

        group.MapPost("", async Task<IResult> (CreateAdminUserRequest dto, AppDbContext db, IPasswordHasher hasher, CancellationToken ct) =>
        {
            var validation = ValidateCreate(dto);
            if (validation is not null) return validation;

            if (!Cpf.TryParse(dto.Cpf, out var cpf)) return Results.BadRequest("CPF inválido.");

            var normalizedRole = AdminRoles.Normalize(dto.Role);
            var nome = dto.Nome.Trim();
            var email = NormalizeEmail(dto.Email);
            var isActive = dto.IsActive ?? true;
            var senha = dto.Senha.Trim();

            var exists = await db.Administradores.AnyAsync(a => a.Cpf == cpf, ct);
            if (exists) return Results.Conflict("Já existe um usuário com este CPF.");

            var admin = new Administrador
            {
                Id = Guid.NewGuid(),
                Nome = nome,
                Email = email,
                Cpf = cpf,
                Roles = normalizedRole,
                IsActive = isActive,
                SenhaHash = hasher.Hash(senha),
                CreatedAt = DateTime.UtcNow,
                MustChangePassword = true
            };

            db.Administradores.Add(admin);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/api/admin-users/{admin.Id}", new { id = admin.Id });
        }).RequireAuthorization(new AuthorizeAttribute { Roles = AdminRoles.Master });

        group.MapPut("/{id:guid}", async Task<IResult> (Guid id, UpdateAdminUserRequest dto, AppDbContext db, IPasswordHasher hasher, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var validation = ValidateUpdate(dto);
            if (validation is not null) return validation;

            if (!Cpf.TryParse(dto.Cpf, out var cpf)) return Results.BadRequest("CPF inválido.");

            var admin = await db.Administradores.FirstOrDefaultAsync(a => a.Id == id, ct);
            if (admin is null) return Results.NotFound();

            var currentUserId = GetUserId(user);
            var normalizedRole = AdminRoles.Normalize(dto.Role);
            var nome = dto.Nome.Trim();
            var email = NormalizeEmail(dto.Email);
            var novaSenha = dto.NovaSenha?.Trim();

            var exists = await db.Administradores.AnyAsync(a => a.Id != id && a.Cpf == cpf, ct);
            if (exists) return Results.Conflict("Já existe um usuário com este CPF.");

            if (await IsDemotingLastMaster(admin, normalizedRole, db, ct))
            {
                return Results.BadRequest("É necessário manter pelo menos um usuário Master ativo.");
            }

            if (!dto.IsActive && currentUserId == admin.Id)
                return Results.BadRequest("Não é possível inativar o próprio usuário.");
            if (admin.Roles == AdminRoles.Master && !dto.IsActive)
            {
                var hasOther = await db.Administradores.AnyAsync(a => a.Id != admin.Id && a.Roles == AdminRoles.Master && a.IsActive, ct);
                if (!hasOther) return Results.BadRequest("É necessário manter ao menos um usuário Master ativo.");
            }

            admin.Nome = nome;
            admin.Email = email;
            admin.Cpf = cpf;
            admin.Roles = normalizedRole;
            admin.IsActive = dto.IsActive;

            if (!string.IsNullOrWhiteSpace(novaSenha))
            {
                admin.SenhaHash = hasher.Hash(novaSenha);
                admin.MustChangePassword = true;
            }

            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization(new AuthorizeAttribute { Roles = AdminRoles.Master });

        group.MapPatch("/{id:guid}/status", async Task<IResult> (Guid id, UpdateAdminUserStatusRequest dto, AppDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var admin = await db.Administradores.FirstOrDefaultAsync(a => a.Id == id, ct);
            if (admin is null) return Results.NotFound();

            var currentUserId = GetUserId(user);
            if (currentUserId == admin.Id && !dto.IsActive)
                return Results.BadRequest("Não é possível inativar a si mesmo.");

            if (!dto.IsActive && admin.Roles == AdminRoles.Master)
            {
                var hasOther = await db.Administradores.AnyAsync(a => a.Id != admin.Id && a.IsActive && a.Roles == AdminRoles.Master, ct);
                if (!hasOther) return Results.BadRequest("É necessário manter ao menos um usuário Master ativo.");
            }

            admin.IsActive = dto.IsActive;
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization(new AuthorizeAttribute { Roles = AdminRoles.Master });

        group.MapDelete("/{id:guid}", async Task<IResult> (Guid id, AppDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var admin = await db.Administradores.FirstOrDefaultAsync(a => a.Id == id, ct);
            if (admin is null) return Results.NotFound();

            var currentUserId = GetUserId(user);
            if (currentUserId == admin.Id)
                return Results.BadRequest("Não é possível remover o próprio usuário.");

            if (admin.Roles == AdminRoles.Master)
            {
                var hasRemaining = await db.Administradores.AnyAsync(a => a.Id != admin.Id && a.Roles == AdminRoles.Master && a.IsActive, ct);
                if (!hasRemaining) return Results.BadRequest("É necessário manter ao menos um usuário Master.");
            }

            db.Administradores.Remove(admin);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization(new AuthorizeAttribute { Roles = AdminRoles.Master });

        return app;
    }

    private static IResult? ValidateCreate(CreateAdminUserRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome)) return Results.BadRequest("Nome é obrigatório.");
        if (!AdminRoles.IsValid(dto.Role)) return Results.BadRequest("Perfil inválido.");
        var senha = dto.Senha?.Trim() ?? string.Empty;
        if (senha.Length < 6) return Results.BadRequest("A senha deve ter ao menos 6 caracteres.");
        return null;
    }

    private static IResult? ValidateUpdate(UpdateAdminUserRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome)) return Results.BadRequest("Nome é obrigatório.");
        if (!AdminRoles.IsValid(dto.Role)) return Results.BadRequest("Perfil inválido.");
        var novaSenha = dto.NovaSenha?.Trim() ?? string.Empty;
        if (novaSenha.Length > 0 && novaSenha.Length < 6)
            return Results.BadRequest("A nova senha deve ter ao menos 6 caracteres.");
        return null;
    }

    private static Guid? GetUserId(ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(id, out var guid) ? guid : null;
    }

    private static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        return email.Trim().ToLowerInvariant();
    }

    private static async Task<bool> IsDemotingLastMaster(Administrador admin, string newRole, AppDbContext db, CancellationToken ct)
    {
        if (admin.Roles == AdminRoles.Master && newRole != AdminRoles.Master)
        {
            return !await db.Administradores.AnyAsync(a => a.Id != admin.Id && a.Roles == AdminRoles.Master && a.IsActive, ct);
        }
        return false;
    }
}
