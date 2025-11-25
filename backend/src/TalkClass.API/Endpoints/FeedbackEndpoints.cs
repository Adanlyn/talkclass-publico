using Microsoft.EntityFrameworkCore;
using TalkClass.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;

// === IMPORTANTE: namespaces das suas entidades e enum ===
using TalkClass.Domain.Entities;
using TalkClass.Domain.ValueObjects;
using TalkClass.API.Services;

namespace TalkClass.API.Endpoints;

// ===== DTOs (fora do método) =====
public record NovaResposta(
    Guid perguntaId,
    int tipo,                 // 0=Nota, 1=SimNao, 2=Multipla, 3=Texto (segue o enum TipoAvaliacao)
    int? valorNota,
    bool? valorBool,
    string? valorOpcao,       // <- string, conforme sua entidade FeedbackResposta
    string? valorTexto
);

public record NovoFeedback(
    Guid categoriaId,
    string? cursoOuTurma,
    string? nomeIdentificado,
    string? contatoIdentificado,
    List<NovaResposta> respostas
);

public static class FeedbackEndpoints
{
    private static TimeZoneInfo GetLocalTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }
        catch
        {
            try { return TimeZoneInfo.CreateCustomTimeZone("UTC-3", TimeSpan.FromHours(-3), "UTC-3", "UTC-3"); }
            catch { return TimeZoneInfo.Utc; }
        }
    }

    public static IEndpointRouteBuilder MapFeedbackEndpoints(this IEndpointRouteBuilder app)
    {
        var feedbacks = app.MapGroup("/api/feedbacks");


        // GET /api/feedbacks  -> lista paginada + filtros
        // GET /api/feedbacks  -> lista paginada + filtros
        feedbacks.MapGet("", async (AppDbContext db,
        ILoggerFactory lf,
         [FromQuery(Name = "identified")] string? identifiedStr,
            [FromQuery] string? search,
            [FromQuery] Guid? categoriaId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? sort = "desc",
            [FromQuery] string? courseName = null,
         [FromQuery] string? dateStart = null,
            [FromQuery] string? dateEnd = null)
             =>
        {
            var log = lf.CreateLogger("Feedbacks");

            try
            {
                bool? identified = null;
                if (!string.IsNullOrWhiteSpace(identifiedStr) &&
                    bool.TryParse(identifiedStr, out var b))
                    identified = b;

                var qry = db.Feedbacks
                    .AsNoTracking()
                    .Include(f => f.Categoria)
                    .Include(f => f.Respostas)
                    .AsQueryable();

                // período por data convertido de horário local (ex.: America/Sao_Paulo) para UTC
                DateTime? startUtc = null, endUtc = null;
                var tz = GetLocalTz();
                if (!string.IsNullOrWhiteSpace(dateStart) && DateTime.TryParse(dateStart, out var dStart))
                {
                    var localStart = new DateTime(dStart.Year, dStart.Month, dStart.Day, 0, 0, 0, DateTimeKind.Unspecified);
                    startUtc = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
                }
                if (!string.IsNullOrWhiteSpace(dateEnd) && DateTime.TryParse(dateEnd, out var dEnd))
                {
                    var nextDay = new DateTime(dEnd.Year, dEnd.Month, dEnd.Day, 0, 0, 0, DateTimeKind.Unspecified).AddDays(1);
                    endUtc = TimeZoneInfo.ConvertTimeToUtc(nextDay, tz);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var like = $"%{search}%";
                    qry = qry.Where(f =>
                        EF.Functions.ILike(f.Categoria.Nome, like) ||
                        EF.Functions.ILike(f.CursoOuTurma ?? "", like) ||
                        EF.Functions.ILike(f.NomeIdentificado ?? "", like) ||
                        EF.Functions.ILike(f.ContatoIdentificado ?? "", like) ||
                        f.Respostas.Any(r =>
                            r.Tipo == TipoAvaliacao.Texto &&
                            r.ValorTexto != null &&
                            EF.Functions.ILike(r.ValorTexto!, like)
                        )
                    );
                }

                if (categoriaId.HasValue)
                    qry = qry.Where(f => f.CategoriaId == categoriaId.Value);

                if (startUtc.HasValue) qry = qry.Where(f => f.CriadoEm >= startUtc.Value);
                if (endUtc.HasValue) qry = qry.Where(f => f.CriadoEm < endUtc.Value);

                if (!string.IsNullOrWhiteSpace(courseName))
                {
                    var likeCurso = $"%{courseName}%";
                    qry = qry.Where(f => EF.Functions.ILike(f.CursoOuTurma ?? "", likeCurso));
                }


                if (identified == true)
                    qry = qry.Where(f => f.NomeIdentificado != null || f.ContatoIdentificado != null);
                if (identified == false)
                    qry = qry.Where(f => f.NomeIdentificado == null && f.ContatoIdentificado == null);


                qry = (sort?.ToLowerInvariant()) switch
                {
                    "asc" => qry.OrderBy(f => f.CriadoEm),
                    _ => qry.OrderByDescending(f => f.CriadoEm)
                };

                var total = await qry.CountAsync();

                // 1) materializa somente dados “básicos” no DB
                var pageRaw = await qry
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(f => new
                    {
                        f.Id,
                        f.CriadoEm,
                        f.CategoriaId,
                        CategoriaNome = f.Categoria.Nome,
                        f.CursoOuTurma,
                        Identificado = (f.NomeIdentificado != null || f.ContatoIdentificado != null),

                        // traga só o necessário das respostas
                        Respostas = f.Respostas.Select(r => new
                        {
                            r.Tipo,
                            r.ValorNota,
                            r.ValorTexto
                        }).ToList()
                    })
                    .ToListAsync();

                // 2) calcula em memória os campos derivados (sem forçar tradução SQL)
                var items = pageRaw.Select(f => new
                {
                    id = f.Id,
                    criadoEm = f.CriadoEm,
                    categoriaId = f.CategoriaId,
                    categoriaNome = f.CategoriaNome,
                    cursoOuTurma = f.CursoOuTurma,
                    identificado = f.Identificado,

                    // primeiro texto (ou null)
                    texto = f.Respostas
                        .Where(r => r.Tipo == TipoAvaliacao.Texto && !string.IsNullOrWhiteSpace(r.ValorTexto))
                        .Select(r => r.ValorTexto!.Trim())
                        .OrderBy(x => x)
                        .FirstOrDefault(),

                    // resumo com reticências feito em memória
                    resumo = f.Respostas
                        .Where(r => r.Tipo == TipoAvaliacao.Texto && !string.IsNullOrWhiteSpace(r.ValorTexto))
                        .Select(r =>
                        {
                            var t = r.ValorTexto!.Trim();
                            return t.Length <= 140 ? t : t.Substring(0, 140) + "…";
                        })
                        .OrderBy(x => x)
                        .FirstOrDefault(),

                    qtdRespostas = f.Respostas.Count,

                    // média de notas segura (0 se vazio)
                    notaMedia = f.Respostas
                        .Where(r => r.Tipo == TipoAvaliacao.Nota && r.ValorNota.HasValue)
                        .Select(r => (double)r.ValorNota!.Value)
                        .DefaultIfEmpty(0)
                        .Average()
                })
                .ToList();

                return Results.Ok(new { items, total });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro na listagem de feedbacks");
                return Results.Problem("Falha ao listar feedbacks.");
            }
        });


        // GET /api/feedbacks/{id:guid} -> detalhe para o "Ver mais"
        feedbacks.MapGet("/{id:guid}", async ([FromRoute] Guid id, AppDbContext db, ILoggerFactory lf) =>
        {
            var log = lf.CreateLogger("Feedbacks");

            string? MapOpcao(string? valor)
            {
                if (string.IsNullOrWhiteSpace(valor)) return null;
                var v = valor.Trim();
                if (System.Text.RegularExpressions.Regex.IsMatch(v, @"^\++$")) return v.Length.ToString();
                var up = v.ToUpperInvariant();
                if (up is "S" or "SIM" or "TRUE" or "1") return "Sim";
                if (up is "N" or "NAO" or "NÃO" or "FALSE" or "0") return "Não";
                return v;
            }

            try
            {
                var raw = await db.Feedbacks
                    .AsNoTracking()
                    .Where(f => f.Id == id)
                    .Select(f => new
                    {
                        f.Id,
                        f.CriadoEm,
                        // Pega só o nome da categoria sem materializar a entidade (evita c.CriadoEm)
                        CategoriaNome = db.Categorias
                            .Where(c => c.Id == f.CategoriaId)
                            .Select(c => c.Nome)
                            .FirstOrDefault(),

                        f.CursoOuTurma,
                        Identificado = !string.IsNullOrWhiteSpace(f.NomeIdentificado) || !string.IsNullOrWhiteSpace(f.ContatoIdentificado),
                        f.NomeIdentificado,
                        f.ContatoIdentificado,

                        // Respostas com subqueries escalares p/ a pergunta
                        Resps = f.Respostas.Select(r => new
                        {
                            r.Tipo,
                            r.ValorNota,
                            r.ValorTexto,
                            r.ValorOpcao,
                            PerguntaTexto = db.Perguntas
                                .Where(p => p.Id == r.PerguntaId)
                                .Select(p => p.Enunciado)
                                .FirstOrDefault()
                        }).ToList()
                    })
                    .FirstOrDefaultAsync();

                if (raw is null) return Results.NotFound();

                var respostas = raw.Resps
                    .Where(r => r.ValorNota.HasValue || !string.IsNullOrWhiteSpace(r.ValorTexto) || !string.IsNullOrWhiteSpace(r.ValorOpcao))
                    .Select(r => new
                    {
                        tipo = r.Tipo.ToString(),
                        pergunta = r.PerguntaTexto,
                        nota = r.ValorNota,
                        texto = string.IsNullOrWhiteSpace(r.ValorTexto) ? null : r.ValorTexto!.Trim(),
                        opcao = MapOpcao(r.ValorOpcao)
                    })
                    .ToList();

                var notaMedia = raw.Resps
                    .Where(r => r.Tipo == TipoAvaliacao.Nota && r.ValorNota.HasValue)
                    .Select(r => (double)r.ValorNota!.Value)
                    .DefaultIfEmpty(0)
                    .Average();

                var dto = new
                {
                    id = raw.Id,
                    criadoEm = raw.CriadoEm,
                    categoria = raw.CategoriaNome,
                    curso = raw.CursoOuTurma,
                    identificado = raw.Identificado,
                    nome = raw.NomeIdentificado,
                    contato = raw.ContatoIdentificado,
                    notaMedia,
                    respostas
                };

                return Results.Ok(dto);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro no detalhe do feedback {Id}", id);
                return Results.Problem("Falha ao carregar o detalhe do feedback.");
            }
        });



        // ===================== CATEGORIAS =====================
        var group = app.MapGroup("/api/categorias");

        // GET /api/categorias/public


        // GET /api/categorias/{id}/perguntas (oficial)
        group.MapGet("/{id:guid}/perguntas", async (Guid id, AppDbContext db) =>
        {
            var perguntas = await db.Perguntas
                .AsNoTracking()
                .Where(p => p.CategoriaId == id && p.Ativa)
                .OrderBy(p => p.Ordem)
                .Select(p => new
                {
                    id = p.Id,
                    enunciado = p.Enunciado,
                    // devolvo como int para casar com o front (TipoAvaliacao enum -> number)
                    tipo = (int)p.Tipo,
                    ordem = p.Ordem,
                    opcoes = p.Opcoes
                        .OrderBy(o => o.Valor)
                        .Select(o => new { id = o.Id, texto = o.Texto, valor = o.Valor })
                        .ToList()
                })
                .ToListAsync();

            return Results.Ok(perguntas);
        });

        group.MapGet("/{id:guid}/perguntas/public", async (Guid id, AppDbContext db) =>
        {
            var perguntas = await db.Perguntas
                .AsNoTracking()
                .Where(p => p.CategoriaId == id && p.Ativa)
                .OrderBy(p => p.Ordem)
                .Select(p => new
                {
                    id = p.Id,
                    enunciado = p.Enunciado,
                    tipo = (int)p.Tipo,
                    ordem = p.Ordem,
                    opcoes = p.Opcoes
                        .OrderBy(o => o.Valor)
                        .Select(o => new { id = o.Id, texto = o.Texto, valor = o.Valor })
                        .ToList()
                })
                .ToListAsync();

            return Results.Ok(perguntas);
        });

        // ===================== FEEDBACKS =====================
        // POST /api/feedbacks -> grava no banco
        feedbacks.MapPost("", async (
            NovoFeedback dto,
            AppDbContext db,
            AlertsProcessor alertsProcessor,
            AlertNotificationsRecorder notificationsRecorder,
            CancellationToken ct) =>
        {
            var catOk = await db.Categorias.AsNoTracking()
                .AnyAsync(c => c.Id == dto.categoriaId && c.Ativa, ct);
            if (!catOk) return Results.BadRequest("Categoria inválida ou inativa.");

            var idsPerg = dto.respostas.Select(r => r.perguntaId).Distinct().ToList();
            var idsValidos = await db.Perguntas.AsNoTracking()
                .Where(p => idsPerg.Contains(p.Id) && p.CategoriaId == dto.categoriaId && p.Ativa)
                .Select(p => p.Id).ToListAsync(ct);
            if (idsValidos.Count != idsPerg.Count)
                return Results.BadRequest("Existe pergunta inválida para esta categoria.");

     var fb = new Feedback
     {
         Id = Guid.NewGuid(),
         CategoriaId = dto.categoriaId,
         CursoOuTurma = dto.cursoOuTurma,
         NomeIdentificado = string.IsNullOrWhiteSpace(dto.nomeIdentificado) ? null : dto.nomeIdentificado.Trim(),
         ContatoIdentificado = string.IsNullOrWhiteSpace(dto.contatoIdentificado) ? null : dto.contatoIdentificado.Trim(),
         CriadoEm = DateTime.UtcNow,
         Respostas = new List<FeedbackResposta>()
     };

     foreach (var r in dto.respostas)
     {
         if (!Enum.IsDefined(typeof(TipoAvaliacao), r.tipo))
             return Results.BadRequest($"Tipo inválido na resposta da pergunta {r.perguntaId}.");

         fb.Respostas.Add(new FeedbackResposta
         {
             Id = Guid.NewGuid(),
             PerguntaId = r.perguntaId,
             Tipo = (TipoAvaliacao)r.tipo,
             ValorNota = r.valorNota,   // usado quando tipo = Nota
             ValorBool = r.valorBool,   // usado quando tipo = Sim/Não
             ValorOpcao = r.valorOpcao,  // usado quando tipo = Múltipla escolha
             ValorTexto = r.valorTexto   // usado quando tipo = Texto  <<<< AQUI
         });
     }

     db.Feedbacks.Add(fb);
     await db.SaveChangesAsync(ct);

     var hasIdentification = !string.IsNullOrWhiteSpace(fb.NomeIdentificado) || !string.IsNullOrWhiteSpace(fb.ContatoIdentificado);

     // Notificação única: identificado => alerta, senão info
     if (hasIdentification)
         await notificationsRecorder.RecordIdentifiedFeedbackAsync(fb, ct);
     else
         await notificationsRecorder.RecordNewFeedbackAsync(fb, ct);

     // Dispara alertas automaticamente quando sendMode = immediate
     var runResult = await alertsProcessor.RunAsync(ct);
     await notificationsRecorder.RecordAsync(runResult, ct);

     return Results.Created($"/api/feedbacks/{fb.Id}", new { id = fb.Id });
 });

        return app;
    }
}
