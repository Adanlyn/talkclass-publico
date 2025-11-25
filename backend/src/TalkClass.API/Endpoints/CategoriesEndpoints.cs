using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TalkClass.Domain.Entities;
using TalkClass.Domain.Security;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Endpoints;

public record CreateCategoryRequest(string Nome, string? Descricao);
public record UpdateCategoryRequest(string Nome, string? Descricao, int? Ordem);
public record ToggleCategoryStatusRequest(bool Ativa);

public static class CategoriesEndpoints
{
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {

        app.MapGet("/api/categories/public", async (AppDbContext db) =>
{
    var cats = await db.Categorias
        .AsNoTracking()
        .Where(c => c.Ativa)
        .OrderBy(c => c.Ordem).ThenBy(c => c.Nome)
        .Select(c => new
        {
            id = c.Id,
            nome = c.Nome
        })
        .ToListAsync();

    return Results.Ok(cats);
})
.WithTags("Categories");

        var group = app.MapGroup("/api/categories")
                       .WithTags("Categories")
                       .RequireAuthorization();
        var requireMaster = new AuthorizeAttribute { Roles = AdminRoles.Master };

        // GET /api/categories?search=&page=1&pageSize=20&onlyActive=true
        group.MapGet("", async (
            [AsParameters] QueryParams qp,
            AppDbContext db) =>
        {
            var q = db.Categorias.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(qp.search))
                q = q.Where(c => EF.Functions.ILike(c.Nome, $"%{qp.search}%"));

            if (qp.onlyActive is true)
                q = q.Where(c => c.Ativa);

            var total = await q.CountAsync();
            var items = await q.OrderBy(c => c.Ordem).ThenBy(c => c.Nome)
                .Skip((qp.page - 1) * qp.pageSize)
                .Take(qp.pageSize)
                .Select(c => new
                {
                    id = c.Id,
                    nome = c.Nome,
                    descricao = c.Descricao,
                    ordem = c.Ordem,
                    ativa = c.Ativa,
                    perguntasCount = c.Perguntas.Count()
                })
                .ToListAsync();

            return Results.Ok(new { total, page = qp.page, pageSize = qp.pageSize, items });
        });

        // GET /api/categories/{id}
        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var c = await db.Categorias.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return c is null ? Results.NotFound() : Results.Ok(c);
        });

        // POST /api/categories
        group.MapPost("", async (CreateCategoryRequest dto, AppDbContext db) =>
        {
            var normalizedName = dto.Nome?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(normalizedName))
                return Results.BadRequest(new { message = "Nome é obrigatório." });

            // evita duplicata (case-insensitive)
            var exists = await db.Categorias.AnyAsync(c => EF.Functions.ILike(c.Nome, normalizedName));
            if (exists)
                return Results.Conflict(new
                {
                    code = "CATEGORY_DUPLICATE_NAME",
                    message = "Já existe uma categoria com esse nome. Altere o nome e tente novamente."
                });

            var cat = new Categoria
            {
                Id = Guid.NewGuid(),
                Nome = normalizedName,
                Descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim(),
                Ordem = 0,
                Ativa = true,
            };

            db.Categorias.Add(cat);
            await db.SaveChangesAsync();
            return Results.Created($"/api/categories/{cat.Id}", new { id = cat.Id });
        }).RequireAuthorization(requireMaster);

        // PUT /api/categories/{id}
        group.MapPut("/{id:guid}", async (Guid id, UpdateCategoryRequest dto, AppDbContext db) =>
        {
            var cat = await db.Categorias.FirstOrDefaultAsync(c => c.Id == id);
            if (cat is null) return Results.NotFound();

            var normalizedName = dto.Nome?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(normalizedName))
                return Results.BadRequest(new { message = "Nome é obrigatório." });

            var dup = await db.Categorias
                .AnyAsync(c => c.Id != id && EF.Functions.ILike(c.Nome, normalizedName));
            if (dup)
                return Results.Conflict(new
                {
                    code = "CATEGORY_DUPLICATE_NAME",
                    message = "Já existe uma categoria com esse nome. Altere o nome e tente novamente."
                });

            cat.Nome = normalizedName;
            cat.Descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim();
            if (dto.Ordem.HasValue) cat.Ordem = dto.Ordem.Value;

            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(requireMaster);

        // PATCH /api/categories/{id}/status
        group.MapPatch("/{id:guid}/status", async (Guid id, ToggleCategoryStatusRequest dto, AppDbContext db) =>
        {
            var cat = await db.Categorias.FirstOrDefaultAsync(c => c.Id == id);
            if (cat is null) return Results.NotFound();

            cat.Ativa = dto.Ativa;
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(requireMaster);
        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var cat = await db.Categorias.FirstOrDefaultAsync(c => c.Id == id);
            if (cat is null) return Results.NotFound();

            var hasPerguntas = await db.Perguntas.AnyAsync(p => p.CategoriaId == id);
            if (hasPerguntas)
                return Results.Conflict(new
                {
                    code = "CATEGORY_HAS_QUESTIONS",
                    message = "Essa categoria possui perguntas associadas e não pode ser excluída. Exclua as perguntas ou inative a categoria."
                });

            db.Categorias.Remove(cat);

            try
            {
                await db.SaveChangesAsync();
                return Results.NoContent();
            }
            catch
            {
                return Results.Problem("Erro ao excluir categoria.");
            }
        }).RequireAuthorization(requireMaster);

        return app;
    }

    public record QueryParams(
        string? search = null,
        bool? onlyActive = true,
        int page = 1,
        int pageSize = 20);
}
