using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TalkClass.Domain.Entities;
using TalkClass.Domain.Security;
using TalkClass.Domain.ValueObjects;         
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Endpoints;

public record PerguntaOpcaoDto(string Texto, int Valor);
public record CreateQuestionRequest(Guid CategoriaId, string Enunciado, TipoAvaliacao Tipo, bool Obrigatoria, int? Ordem, List<PerguntaOpcaoDto>? Opcoes);
public record UpdateQuestionRequest(Guid CategoriaId, string Enunciado, TipoAvaliacao Tipo, bool Obrigatoria, int? Ordem, List<PerguntaOpcaoDto>? Opcoes);
public record QueryPerguntas(string? search, Guid? categoriaId, TipoAvaliacao? tipo, int page = 1, int pageSize = 10, bool? onlyActive = null);
public record PagedResult<T>(IEnumerable<T> Items, int Total);

public static class QuestionsEndpoints
{
    public static IEndpointRouteBuilder MapQuestionsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/questions").WithTags("Questions").RequireAuthorization();
        var requireMaster = new AuthorizeAttribute { Roles = AdminRoles.Master };

        // LIST (pagina, busca, filtros)
        g.MapGet("", async ([AsParameters] QueryPerguntas qp, AppDbContext db) =>
        {
            var q = db.Perguntas.AsNoTracking()
                .Include(x => x.Categoria)
                .Include(x => x.Opcoes)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(qp.search))
                q = q.Where(x => EF.Functions.ILike(x.Enunciado, $"%{qp.search}%"));
            if (qp.categoriaId.HasValue)
                q = q.Where(x => x.CategoriaId == qp.categoriaId.Value);
            if (qp.tipo.HasValue)
                q = q.Where(x => x.Tipo == qp.tipo.Value);
            if (qp.onlyActive is true)
                q = q.Where(x => x.Ativa);

            var total = await q.CountAsync();

            var items = await q
                .OrderBy(x => x.Ordem).ThenBy(x => x.Enunciado)
                .Skip((qp.page - 1) * qp.pageSize)
                .Take(qp.pageSize)
                .Select(x => new {
                    x.Id, x.Enunciado, x.Tipo, x.Obrigatoria, x.Ordem, x.Ativa,
                    x.CategoriaId, CategoriaNome = x.Categoria.Nome,
                    Opcoes = x.Opcoes.OrderBy(o => o.Valor).Select(o => new { o.Texto, o.Valor })
                })
                .ToListAsync();

            return Results.Ok(new PagedResult<object>(items, total));
        });

        // CREATE
        g.MapPost("", async ([FromBody] CreateQuestionRequest r, AppDbContext db) =>
        {
            var categoriaOk = await db.Categorias.AnyAsync(c => c.Id == r.CategoriaId && c.Ativa);
            if (!categoriaOk) return Results.BadRequest("Categoria inválida ou inativa.");

            var opcoes = NormalizeOptions(r.Tipo, r.Opcoes);
            if (RequiresOptions(r.Tipo) && opcoes.Count < 2)
                return Results.BadRequest("Informe pelo menos 2 opções.");

            var normalized = r.Enunciado?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(normalized))
                return Results.BadRequest("Enunciado é obrigatório.");

            var ordem = r.Ordem ?? 0;

            var dupText = await db.Perguntas
                .AnyAsync(p => p.CategoriaId == r.CategoriaId && EF.Functions.ILike(p.Enunciado, normalized));
            if (dupText)
                return Results.Conflict(new
                {
                    code = "QUESTION_DUPLICATE_TEXT",
                    message = "Já existe uma pergunta com esse enunciado nessa categoria."
                });

            var dupOrder = await db.Perguntas
                .AnyAsync(p => p.CategoriaId == r.CategoriaId && p.Ordem == ordem);
            if (dupOrder)
                return Results.Conflict(new
                {
                    code = "QUESTION_DUPLICATE_ORDER",
                    message = "Já existe uma pergunta com essa ordem nessa categoria."
                });

            var p = new Pergunta
            {
                Id = Guid.NewGuid(),
                CategoriaId = r.CategoriaId,
                Enunciado = normalized,
                Tipo = r.Tipo,
                Obrigatoria = r.Obrigatoria,
                Ordem = ordem,
                Ativa = true
            };
            foreach (var o in opcoes)
                p.Opcoes.Add(new PerguntaOpcao { Id = Guid.NewGuid(), Texto = o.Texto, Valor = o.Valor });

            db.Perguntas.Add(p);
            await db.SaveChangesAsync();
            return Results.Created($"/api/questions/{p.Id}", new { p.Id });
        }).RequireAuthorization(requireMaster);

        // UPDATE
        // UPDATE
g.MapPut("{id:guid}", async (Guid id, [FromBody] UpdateQuestionRequest r, AppDbContext db) =>
{
    var p = await db.Perguntas
        .Include(x => x.Opcoes)
        .FirstOrDefaultAsync(x => x.Id == id);

    if (p is null) return Results.NotFound();

    var categoriaOk = await db.Categorias.AnyAsync(c => c.Id == r.CategoriaId && c.Ativa);
    if (!categoriaOk) return Results.BadRequest("Categoria inválida ou inativa.");

    var opcoes = NormalizeOptions(r.Tipo, r.Opcoes);
    if (RequiresOptions(r.Tipo) && opcoes.Count < 2)
        return Results.BadRequest("Informe pelo menos 2 opções.");

    var normalized = r.Enunciado?.Trim() ?? string.Empty;
    if (string.IsNullOrWhiteSpace(normalized))
        return Results.BadRequest("Enunciado é obrigatório.");

    var ordem = r.Ordem ?? 0;

    var dupText = await db.Perguntas
        .AnyAsync(x => x.Id != id && x.CategoriaId == r.CategoriaId && EF.Functions.ILike(x.Enunciado, normalized));
    if (dupText)
        return Results.Conflict(new
        {
            code = "QUESTION_DUPLICATE_TEXT",
            message = "Já existe uma pergunta com esse enunciado nessa categoria."
        });

    var dupOrder = await db.Perguntas
        .AnyAsync(x => x.Id != id && x.CategoriaId == r.CategoriaId && x.Ordem == ordem);
    if (dupOrder)
        return Results.Conflict(new
        {
            code = "QUESTION_DUPLICATE_ORDER",
            message = "Já existe uma pergunta com essa ordem nessa categoria."
        });

    // aplica campos
    p.CategoriaId = r.CategoriaId;
    p.Enunciado = normalized;
    p.Tipo = r.Tipo;
    p.Obrigatoria = r.Obrigatoria;
    p.Ordem = ordem;

    try
    {
        // Estratégia segura em 2 passos para evitar colisão/ordem de comandos:
        // 1) remove TODAS as opções existentes e salva
        var existentes = await db.PerguntaOpcoes
            .Where(o => o.PerguntaId == p.Id)
            .ToListAsync();

        if (existentes.Count > 0)
        {
            db.PerguntaOpcoes.RemoveRange(existentes);
            await db.SaveChangesAsync();
        }

        // 2) insere as novas opções (se aplicável) e salva
        if (RequiresOptions(p.Tipo))
        {
            var novas = opcoes.Select(o => new PerguntaOpcao
            {
                Id = Guid.NewGuid(),
                PerguntaId = p.Id,
                Texto = o.Texto,
                Valor = o.Valor
            });

            await db.PerguntaOpcoes.AddRangeAsync(novas);
        }

        await db.SaveChangesAsync();
        return Results.NoContent();
    }
    catch (DbUpdateException ex)
    {
        // Mensagem mais amigável para o front
        var msg =
            ex.InnerException?.Message ??
            ex.Message ??
            "Falha ao salvar alterações.";
        return Results.BadRequest(msg);
    }
}).RequireAuthorization(requireMaster);


        // TOGGLE
        g.MapPatch("{id:guid}/toggle", async (Guid id, [FromBody] bool ativa, AppDbContext db) =>
        {
            var p = await db.Perguntas.FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            p.Ativa = ativa;
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(requireMaster);

        // DELETE
        g.MapDelete("{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var p = await db.Perguntas.FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();

            var hasFeedbacks = await db.FeedbackRespostas.AnyAsync(fr => fr.PerguntaId == id);
            if (hasFeedbacks)
                return Results.Conflict(new
                {
                    code = "QUESTION_HAS_FEEDBACKS",
                    message = "Essa pergunta já foi utilizada em feedbacks e não pode ser excluída. Inative-a em vez de excluir."
                });

            db.Perguntas.Remove(p); // CASCADE remove opções (já mapeado)
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(requireMaster);

        return app;
    }

    static bool RequiresOptions(TipoAvaliacao t) => t == TipoAvaliacao.Multipla;

    // Regras:
    // - SimNao: se não vier opções, gera ["Não"(0), "Sim"(1)]
    // - Multipla: usa as informadas (mín. 2)
    // - Nota | Texto: ignora opções
    static List<PerguntaOpcaoDto> NormalizeOptions(TipoAvaliacao t, List<PerguntaOpcaoDto>? opcoes)
    {
        if (t == TipoAvaliacao.Multipla)
        {
            return (opcoes ?? new())
                .Where(o => !string.IsNullOrWhiteSpace(o.Texto))
                .Select(o => new PerguntaOpcaoDto(o.Texto.Trim(), o.Valor))
                .ToList();
        }
        return new(); // Nota | Texto
    }
}
