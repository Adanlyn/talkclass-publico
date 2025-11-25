using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TalkClass.Domain.Entities;
using TalkClass.Domain.Security;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Endpoints;

public record ReportFilters(
    Guid? CategoriaId,
    string? Curso,
    bool? Identificado,
    DateTime? DataInicio,
    DateTime? DataFim,
    int? NotaMin,
    int? NotaMax,
    Guid? PerguntaId);

public static class ReportsEndpoints
{
    private record CategoryIndicatorRow(Guid? CategoriaId, string Categoria, int Feedbacks, double Media, double Nps, double PctNotasBaixas);
    private record QuestionIndicatorRow(Guid PerguntaId, string Pergunta, string Categoria, int Qtd, double Media, double PctNotasBaixas);
    // Escala de notas é 1..5; para NPS usamos promotores >=4 e detratores <=2.
    private const int NpsPromoterMin = 4;
    private const int NpsDetractorMax = 2;

        static TimeZoneInfo Tz()
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }
            catch
            {
                try { return TimeZoneInfo.CreateCustomTimeZone("UTC-3", TimeSpan.FromHours(-3), "UTC-3", "UTC-3"); }
                catch { return TimeZoneInfo.Utc; }
            }
        }

    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/reports")
            .WithTags("Reports")
            .RequireAuthorization(new AuthorizeAttribute { Roles = $"{AdminRoles.Admin},{AdminRoles.Master}" });

        group.MapGet("/feedbacks", async (
            AppDbContext db,
            ILoggerFactory lf,
            [FromQuery] Guid? categoriaId,
            [FromQuery] string? courseName,
            [FromQuery] string? identified,
            [FromQuery] string? dateStart,
            [FromQuery] string? dateEnd,
            [FromQuery] int? notaMin,
            [FromQuery] int? notaMax,
            [FromQuery] Guid? perguntaId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            var log = lf.CreateLogger("Reports");

            try
            {
                var filters = ParseFilters(categoriaId, courseName, identified, dateStart, dateEnd, notaMin, notaMax, perguntaId);
                var baseQry = ApplyFilters(db.FeedbackRespostas.AsNoTracking(), filters);

                var total = await baseQry.CountAsync();

                var items = await baseQry
                    .OrderByDescending(r => r.Feedback.CriadoEm)
                    .Skip(Math.Max(0, (page - 1) * pageSize))
                    .Take(pageSize)
                    .Select(r => new
                    {
                        id = r.Id,
                        feedbackId = r.FeedbackId,
                        criadoEm = r.Feedback.CriadoEm,
                        categoriaId = r.Feedback.CategoriaId,
                        categoria = r.Feedback.Categoria != null ? r.Feedback.Categoria.Nome : null,
                        curso = r.Feedback.CursoOuTurma,
                        perguntaId = r.PerguntaId,
                        pergunta = r.Pergunta.Enunciado,
                        nota = r.ValorNota,
                        resposta = r.ValorTexto ?? r.ValorOpcao,
                        identificado = !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
                                       !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado)
                    })
                    .ToListAsync();

                return Results.Ok(new { total, items, page, pageSize });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro ao gerar relatório de feedbacks.");
                return Results.Problem("Falha ao carregar relatório de feedbacks.");
            }
        });

        group.MapGet("/feedbacks/export", async (
            AppDbContext db,
            ILoggerFactory lf,
            [FromQuery] string? format,
            [FromQuery] Guid? categoriaId,
            [FromQuery] string? courseName,
            [FromQuery] string? identified,
            [FromQuery] string? dateStart,
            [FromQuery] string? dateEnd,
            [FromQuery] int? notaMin,
            [FromQuery] int? notaMax,
            [FromQuery] Guid? perguntaId) =>
        {
            var log = lf.CreateLogger("Reports");
            try
            {
                var filters = ParseFilters(categoriaId, courseName, identified, dateStart, dateEnd, notaMin, notaMax, perguntaId);
                var rows = await ApplyFilters(db.FeedbackRespostas.AsNoTracking(), filters)
                    .OrderByDescending(r => r.Feedback.CriadoEm)
                    .Select(r => new
                    {
                        criadoEm = r.Feedback.CriadoEm,
                        categoria = r.Feedback.Categoria != null ? r.Feedback.Categoria.Nome : "",
                        curso = r.Feedback.CursoOuTurma ?? "",
                        pergunta = r.Pergunta.Enunciado,
                        nota = r.ValorNota,
                        resposta = r.ValorTexto ?? r.ValorOpcao ?? "",
                        identificado = !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
                                       !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado)
                    })
                    .ToListAsync();

                var headers = new[] { "Data", "Categoria", "Curso", "Pergunta", "Nota", "Resposta", "Identificado" };
                var data = rows.Select(r => new[]
                {
                    r.criadoEm.ToString("yyyy-MM-dd HH:mm:ss"),
                    r.categoria,
                    r.curso,
                    r.pergunta,
                    r.nota?.ToString("0.##") ?? "",
                    r.resposta,
                    r.identificado ? "Sim" : "Não"
                });

                return ExportResult(format, "feedbacks", headers, data);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro ao exportar relatório de feedbacks.");
                return Results.Problem("Falha ao exportar relatório.");
            }
        });

        group.MapGet("/indicators", async (
            AppDbContext db,
            ILoggerFactory lf,
            [FromQuery] string? groupBy,
            [FromQuery] Guid? categoriaId,
            [FromQuery] string? courseName,
            [FromQuery] string? identified,
            [FromQuery] string? dateStart,
            [FromQuery] string? dateEnd,
            [FromQuery] int? notaMin,
            [FromQuery] int? notaMax,
            [FromQuery] Guid? perguntaId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            var log = lf.CreateLogger("Reports");
            try
            {
                var filters = ParseFilters(categoriaId, courseName, identified, dateStart, dateEnd, notaMin, notaMax, perguntaId);
                var mode = (groupBy ?? "category").ToLowerInvariant();
                var baseQry = ApplyFilters(db.FeedbackRespostas.AsNoTracking(), filters)
                    .Where(r => r.ValorNota != null);

                IEnumerable<object> grouped = mode == "question"
                    ? await GroupByQuestion(baseQry)
                    : await GroupByCategory(baseQry);

                var total = grouped.Count();
                var paged = grouped
                    .Skip(Math.Max(0, (page - 1) * pageSize))
                    .Take(pageSize)
                    .ToList();

                return Results.Ok(new { total, items = paged, page, pageSize });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro ao gerar indicadores.");
                return Results.Problem("Falha ao carregar indicadores.");
            }
        });

        group.MapGet("/indicators/export", async (
            AppDbContext db,
            ILoggerFactory lf,
            [FromQuery] string? groupBy,
            [FromQuery] string? format,
            [FromQuery] Guid? categoriaId,
            [FromQuery] string? courseName,
            [FromQuery] string? identified,
            [FromQuery] string? dateStart,
            [FromQuery] string? dateEnd,
            [FromQuery] int? notaMin,
            [FromQuery] int? notaMax,
            [FromQuery] Guid? perguntaId) =>
        {
            var log = lf.CreateLogger("Reports");
            try
            {
                var filters = ParseFilters(categoriaId, courseName, identified, dateStart, dateEnd, notaMin, notaMax, perguntaId);
                var mode = (groupBy ?? "category").ToLowerInvariant();
                var baseQry = ApplyFilters(db.FeedbackRespostas.AsNoTracking(), filters)
                    .Where(r => r.ValorNota != null);

                if (mode == "question")
                {
                    var rows = await GroupByQuestion(baseQry);
                    var headers = new[] { "Categoria", "Pergunta", "Qtde respostas", "Média", "% notas baixas" };
                    var data = rows.Select(r => new[]
                    {
                        r.Categoria,
                        r.Pergunta,
                        r.Qtd.ToString(),
                        r.Media.ToString("0.##"),
                        r.PctNotasBaixas.ToString("0.##") + "%"
                    });
                    return ExportResult(format, "indicadores-pergunta", headers, data);
                }
                else
                {
                    var rows = await GroupByCategory(baseQry);
                    var headers = new[] { "Categoria", "Qtde feedbacks", "Média", "NPS", "% notas baixas" };
                    var data = rows.Select(r => new[]
                    {
                        r.Categoria,
                        r.Feedbacks.ToString(),
                        r.Media.ToString("0.##"),
                        r.Nps.ToString("0.##"),
                        r.PctNotasBaixas.ToString("0.##") + "%"
                    });
                    return ExportResult(format, "indicadores-categoria", headers, data);
                }
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro ao exportar indicadores.");
                return Results.Problem("Falha ao exportar indicadores.");
            }
        });

        group.MapGet("/feedbacks/summary", async (
            AppDbContext db,
            ILoggerFactory lf,
            [FromQuery] Guid? categoriaId,
            [FromQuery] string? courseName,
            [FromQuery] string? identified,
            [FromQuery] string? dateStart,
            [FromQuery] string? dateEnd,
            [FromQuery] int? notaMin,
            [FromQuery] int? notaMax,
            [FromQuery] Guid? perguntaId) =>
        {
            var log = lf.CreateLogger("Reports");

            try
            {
                var filters = ParseFilters(categoriaId, courseName, identified, dateStart, dateEnd, notaMin, notaMax, perguntaId);

                var feedbacksQ = ApplyFiltersToFeedbacks(db, filters);
                var volume = await feedbacksQ
                    .GroupBy(f => f.CriadoEm.Date)
                    .Select(g => new { date = g.Key, total = g.Count() })
                    .OrderBy(g => g.date)
                    .ToListAsync();

                var byCategory = await feedbacksQ
                    .GroupBy(f => new { f.CategoriaId, Nome = f.Categoria != null ? f.Categoria.Nome : "—" })
                    .Select(g => new { categoriaId = g.Key.CategoriaId, categoria = g.Key.Nome, total = g.Count() })
                    .OrderByDescending(x => x.total)
                    .ThenBy(x => x.categoria)
                    .ToListAsync();

                var identifiedCounts = await feedbacksQ
                    .Select(f => new
                    {
                        identified = !string.IsNullOrWhiteSpace(f.NomeIdentificado) ||
                                     !string.IsNullOrWhiteSpace(f.ContatoIdentificado)
                    })
                    .ToListAsync();

                var identifiedTotal = identifiedCounts.Count(c => c.identified);
                var anonymousTotal = identifiedCounts.Count - identifiedTotal;

                var responsesQ = ApplyFilters(db.FeedbackRespostas.AsNoTracking(), filters)
                    .Where(r => r.ValorNota != null);

                var notaMedia = await responsesQ
                    .Select(r => (double)r.ValorNota!)
                    .DefaultIfEmpty(0)
                    .AverageAsync();

                return Results.Ok(new
                {
                    volume = volume.Select(v => new { date = v.date.ToString("yyyy-MM-dd"), total = v.total }),
                    byCategory,
                    identified = new { identified = identifiedTotal, anonymous = anonymousTotal },
                    notaMedia = Math.Round(notaMedia, 2)
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Erro ao gerar resumo de feedbacks.");
                return Results.Problem("Falha ao carregar resumo de feedbacks.");
            }
        });

        return app;
    }

    private static ReportFilters ParseFilters(
        Guid? categoriaId,
        string? courseName,
        string? identified,
        string? dateStart,
        string? dateEnd,
        int? notaMin,
        int? notaMax,
        Guid? perguntaId)
    {
        bool? identifiedBool = null;
        if (!string.IsNullOrWhiteSpace(identified) && bool.TryParse(identified, out var b))
            identifiedBool = b;

        DateTime? dtStart = null;
        DateTime? dtEnd = null;
        var tz = Tz();
        if (DateTime.TryParse(dateStart, out var d1))
        {
            var localStart = new DateTime(d1.Year, d1.Month, d1.Day, 0, 0, 0, DateTimeKind.Unspecified);
            dtStart = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
        }
        if (DateTime.TryParse(dateEnd, out var d2))
        {
            var nextDay = new DateTime(d2.Year, d2.Month, d2.Day, 0, 0, 0, DateTimeKind.Unspecified).AddDays(1);
            dtEnd = TimeZoneInfo.ConvertTimeToUtc(nextDay, tz);
        }

        return new ReportFilters(
            categoriaId,
            courseName,
            identifiedBool,
            dtStart,
            dtEnd,
            notaMin,
            notaMax,
            perguntaId);
    }

    private static IQueryable<FeedbackResposta> ApplyFilters(
        IQueryable<FeedbackResposta> q,
        ReportFilters f)
    {
        if (f.CategoriaId.HasValue)
            q = q.Where(r => r.Feedback.CategoriaId == f.CategoriaId.Value);
        if (!string.IsNullOrWhiteSpace(f.Curso))
        {
            var like = $"%{f.Curso}%";
            q = q.Where(r => EF.Functions.ILike(r.Feedback.CursoOuTurma ?? "", like));
        }
        if (f.DataInicio.HasValue)
            q = q.Where(r => r.Feedback.CriadoEm >= f.DataInicio.Value);
        if (f.DataFim.HasValue)
            q = q.Where(r => r.Feedback.CriadoEm < f.DataFim.Value);
        if (f.Identificado == true)
        {
            q = q.Where(r =>
                !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
                !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
        }
        if (f.Identificado == false)
        {
            q = q.Where(r =>
                string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) &&
                string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
        }
        if (f.NotaMin.HasValue)
            q = q.Where(r => r.ValorNota.HasValue && r.ValorNota >= f.NotaMin.Value);
        if (f.NotaMax.HasValue)
            q = q.Where(r => r.ValorNota.HasValue && r.ValorNota <= f.NotaMax.Value);
        if (f.PerguntaId.HasValue)
            q = q.Where(r => r.PerguntaId == f.PerguntaId.Value);

        return q;
    }

    private static async Task<List<CategoryIndicatorRow>> GroupByCategory(IQueryable<FeedbackResposta> q)
    {
        var rows = await q
            .GroupBy(r => new { r.Feedback.CategoriaId, Nome = r.Feedback.Categoria != null ? r.Feedback.Categoria.Nome : "—" })
            .Select(g => new
            {
                categoriaId = g.Key.CategoriaId,
                categoria = g.Key.Nome,
                feedbacks = g.Select(r => r.FeedbackId).Distinct().Count(),
                media = g.Select(r => (double)r.ValorNota!).DefaultIfEmpty(0).Average(),
                promotores = g.Count(r => r.ValorNota >= NpsPromoterMin),
                detratores = g.Count(r => r.ValorNota <= NpsDetractorMax),
                totalNotas = g.Count(r => r.ValorNota != null),
                baixas = g.Count(r => r.ValorNota <= 2)
            })
            .ToListAsync();

        return rows
            .Select(r =>
            {
                var nps = r.totalNotas == 0 ? 0.0 : Math.Round(((r.promotores - r.detratores) / (double)r.totalNotas) * 100, 1);
                var pctBaixas = r.totalNotas == 0 ? 0.0 : Math.Round(100.0 * r.baixas / r.totalNotas, 2);
                return new CategoryIndicatorRow(
                    r.categoriaId,
                    r.categoria,
                    r.feedbacks,
                    Math.Round(r.media, 2),
                    nps,
                    pctBaixas
                );
            })
            .OrderByDescending(r => r.Feedbacks)
            .ThenBy(r => r.Categoria)
            .ToList();
    }

    private static async Task<List<QuestionIndicatorRow>> GroupByQuestion(IQueryable<FeedbackResposta> q)
    {
        var rows = await q
            .GroupBy(r => new
            {
                r.PerguntaId,
                Pergunta = r.Pergunta.Enunciado,
                Categoria = r.Feedback.Categoria != null ? r.Feedback.Categoria.Nome : "—"
            })
            .Select(g => new
            {
                perguntaId = g.Key.PerguntaId,
                pergunta = g.Key.Pergunta,
                categoria = g.Key.Categoria,
                qtd = g.Count(),
                media = g.Select(r => (double)r.ValorNota!).DefaultIfEmpty(0).Average(),
                baixas = g.Count(r => r.ValorNota <= 2)
            })
            .ToListAsync();

        return rows
            .Select(r =>
            {
                var pctBaixas = r.qtd == 0 ? 0.0 : Math.Round(100.0 * r.baixas / r.qtd, 2);
                return new QuestionIndicatorRow(
                    r.perguntaId,
                    r.pergunta,
                    r.categoria,
                    r.qtd,
                    Math.Round(r.media, 2),
                    pctBaixas
                );
            })
            .OrderByDescending(r => r.Qtd)
            .ThenBy(r => r.Pergunta)
            .ToList();
    }

    private static IQueryable<Feedback> ApplyFiltersToFeedbacks(AppDbContext db, ReportFilters f)
    {
        var q = db.Feedbacks.AsNoTracking().Include(fb => fb.Categoria).AsQueryable();

        if (f.CategoriaId.HasValue)
            q = q.Where(fb => fb.CategoriaId == f.CategoriaId.Value);
        if (!string.IsNullOrWhiteSpace(f.Curso))
        {
            var like = $"%{f.Curso}%";
            q = q.Where(fb => EF.Functions.ILike(fb.CursoOuTurma ?? "", like));
        }
        if (f.DataInicio.HasValue)
            q = q.Where(fb => fb.CriadoEm >= f.DataInicio.Value);
        if (f.DataFim.HasValue)
            q = q.Where(fb => fb.CriadoEm <= f.DataFim.Value);

        if (f.Identificado == true)
        {
            q = q.Where(fb =>
                !string.IsNullOrWhiteSpace(fb.NomeIdentificado) ||
                !string.IsNullOrWhiteSpace(fb.ContatoIdentificado));
        }
        if (f.Identificado == false)
        {
            q = q.Where(fb =>
                string.IsNullOrWhiteSpace(fb.NomeIdentificado) &&
                string.IsNullOrWhiteSpace(fb.ContatoIdentificado));
        }

        if (f.NotaMin.HasValue || f.NotaMax.HasValue || f.PerguntaId.HasValue)
        {
            q = q.Where(fb => fb.Respostas.Any(r =>
                (!f.PerguntaId.HasValue || r.PerguntaId == f.PerguntaId.Value) &&
                (!f.NotaMin.HasValue || (r.ValorNota.HasValue && r.ValorNota >= f.NotaMin.Value)) &&
                (!f.NotaMax.HasValue || (r.ValorNota.HasValue && r.ValorNota <= f.NotaMax.Value))));
        }

        return q;
    }

    private static IResult ExportResult(string? format, string baseName, string[] headers, IEnumerable<string[]> rows)
    {
        var fmt = (format ?? "csv").ToLowerInvariant();
        return fmt switch
        {
            "excel" => HtmlTableResult($"{baseName}.xls", headers, rows),
            "pdf" => FileResult("application/pdf", $"{baseName}.pdf", headers, rows, asPdf: true),
            _ => FileResult("text/csv", $"{baseName}.csv", headers, rows)
        };
    }

    private static IResult FileResult(string contentType, string filename, string[] headers, IEnumerable<string[]> rows, bool asPdf = false)
    {
        if (asPdf)
        {
            var pdf = BuildSimplePdf(filename, headers, rows);
            return Results.File(pdf, contentType, filename);
        }

        var sb = new StringBuilder();
        sb.AppendLine(string.Join(";", headers));
        foreach (var r in rows)
        {
            sb.AppendLine(string.Join(";", r.Select(EscapeCsv)));
        }

        var bytes = Encoding.UTF8.GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(sb.ToString()))
            .ToArray();

        return Results.File(bytes, contentType, filename);
    }

    private static IResult HtmlTableResult(string filename, string[] headers, IEnumerable<string[]> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<html><head><meta charset=\"UTF-8\"></head><body><table border=\"1\">");
        sb.AppendLine("<thead><tr>");
        foreach (var h in headers)
            sb.Append("<th>").Append(System.Net.WebUtility.HtmlEncode(h)).Append("</th>");
        sb.AppendLine("</tr></thead><tbody>");
        foreach (var r in rows)
        {
            sb.Append("<tr>");
            foreach (var c in r)
                sb.Append("<td>").Append(System.Net.WebUtility.HtmlEncode(c ?? "")).Append("</td>");
            sb.AppendLine("</tr>");
        }
        sb.AppendLine("</tbody></table></body></html>");
        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return Results.File(bytes, "application/vnd.ms-excel", filename);
    }

    private static byte[] BuildSimplePdf(string title, string[] headers, IEnumerable<string[]> rows)
    {
        // Gera um PDF bem simples em uma única página com texto monoespaçado.
        var lines = new List<string> { string.Join(" | ", headers) };
        lines.AddRange(rows.Select(r => string.Join(" | ", r)));

        var content = new StringBuilder();
        content.AppendLine("BT");
        content.AppendLine("/F1 16 Tf");
        content.AppendLine("70 800 Td");
        content.AppendLine($"({EscapePdf(title)}) Tj");
        content.AppendLine("/F1 10 Tf");

        int y = 780;
        foreach (var line in lines)
        {
            content.AppendLine($"1 0 0 1 70 {y} Tm ({EscapePdf(line)}) Tj");
            y -= 14;
        }
        content.AppendLine("ET");

        var stream = content.ToString();
        var streamBytes = Encoding.ASCII.GetBytes(stream);

        var objects = new List<string>();
        objects.Add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        objects.Add("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n");
        objects.Add("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
        objects.Add($"4 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n{stream}\nendstream\nendobj\n");
        objects.Add("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

        using var ms = new MemoryStream();
        void Write(string s) => ms.Write(Encoding.ASCII.GetBytes(s));

        Write("%PDF-1.4\n");
        var offsets = new List<int> { 0 };
        foreach (var obj in objects)
        {
            offsets.Add((int)ms.Position);
            Write(obj);
        }

        var xrefPos = ms.Position;
        Write($"xref\n0 {objects.Count + 1}\n");
        Write("0000000000 65535 f \n");
        foreach (var off in offsets.Skip(1))
        {
            Write(off.ToString("D10") + " 00000 n \n");
        }
        Write($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefPos}\n%%EOF");

        return ms.ToArray();
    }

    private static string EscapeCsv(string? v)
    {
        if (string.IsNullOrEmpty(v)) return "";
        var needsQuote = v.Contains(';') || v.Contains('"') || v.Contains('\n');
        var cleaned = v.Replace("\"", "\"\"");
        return needsQuote ? $"\"{cleaned}\"" : cleaned;
    }

    private static string EscapePdf(string? v)
    {
        if (string.IsNullOrEmpty(v)) return "";
        return v.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
    }
}
