using Microsoft.EntityFrameworkCore;
using TalkClass.Infrastructure.Persistence;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Npgsql;
using NpgsqlTypes;
using TalkClass.API.Dtos;
using Microsoft.AspNetCore.Mvc;
using TalkClass.API.Services;


namespace TalkClass.API.Endpoints;

public static class DashboardEndpoints
{
    private static DateTime EnsureUtc(DateTime dt) =>
        dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };

    private static (DateTime start, DateTime end) Range(DateTime? from, DateTime? to, int defaultDays)
    {
        var now = DateTime.UtcNow;
        var s = from ?? now.AddDays(-defaultDays);
        var e = to ?? now;
        return (EnsureUtc(s), EnsureUtc(e));
    }

    // Notas estão em escala Likert 1..5: tratamos promotores como >=4 e detratores como <=2.
    private const int NpsPromoterMin = 4;
    private const int NpsDetractorMax = 2;

    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/dashboard")
                   .WithTags("Dashboard")
                   .RequireAuthorization();

        // ---- KPIs: NPS, total feedbacks, áreas com alerta, total de áreas
        // assinatura
        g.MapGet("/kpis", async (DateTime? from, DateTime? to, Guid? categoryId,bool? identified, AppDbContext db) =>
        {
            var (inicio, fim) = Range(from, to, 30);

            var feedbacksQ = db.Feedbacks.AsNoTracking()
                .Where(f => f.CriadoEm >= inicio && f.CriadoEm <= fim);
            if (categoryId.HasValue) feedbacksQ = feedbacksQ.Where(f => f.CategoriaId == categoryId);

              if (identified is bool flag)
    {
        if (flag)
        {
            feedbacksQ = feedbacksQ.Where(f =>
                f.NomeIdentificado    != null ||
                f.ContatoIdentificado != null
            );
        }
        else
        {
            feedbacksQ = feedbacksQ.Where(f =>
                f.NomeIdentificado    == null &&
                f.ContatoIdentificado == null
            );
        }
    }

            var totalFeedbacks = await feedbacksQ.CountAsync();

            var notasQ = db.FeedbackRespostas.AsNoTracking()
                .Where(r => r.ValorNota != null && r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim);
            if (categoryId.HasValue) notasQ = notasQ.Where(r => r.Feedback.CategoriaId == categoryId);

         if (identified is bool flag2)
    {
        if (flag2)
        {
            notasQ = notasQ.Where(r =>
                r.Feedback.NomeIdentificado    != null ||
                r.Feedback.ContatoIdentificado != null
            );
        }
        else
        {
            notasQ = notasQ.Where(r =>
                r.Feedback.NomeIdentificado    == null &&
                r.Feedback.ContatoIdentificado == null
            );
        }
    }



            var totalNotas = await notasQ.CountAsync();
            var prom = await notasQ.CountAsync(r => r.ValorNota >= NpsPromoterMin);
            var det = await notasQ.CountAsync(r => r.ValorNota <= NpsDetractorMax);
            var nps = totalNotas == 0 ? 0 : (int)Math.Round(((prom - det) / (double)totalNotas) * 100);

            // áreas com alerta filtradas pela categoria (se houver)
            var mediasPorAreaQ = db.FeedbackRespostas.AsNoTracking()
                .Where(r => r.ValorNota != null && r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim);
            if (categoryId.HasValue) mediasPorAreaQ = mediasPorAreaQ.Where(r => r.Feedback.CategoriaId == categoryId);

            if (identified is bool flag3)
    {
        if (flag3)
        {
            mediasPorAreaQ = mediasPorAreaQ.Where(r =>
                r.Feedback.NomeIdentificado    != null ||
                r.Feedback.ContatoIdentificado != null
            );
        }
        else
        {
            mediasPorAreaQ = mediasPorAreaQ.Where(r =>
                r.Feedback.NomeIdentificado    == null &&
                r.Feedback.ContatoIdentificado == null
            );
        }
    }


            var mediasPorArea = await mediasPorAreaQ
                .GroupBy(r => new { r.Feedback.CategoriaId, Nome = r.Feedback.Categoria != null ? r.Feedback.Categoria.Nome : "(Sem categoria)" })
                .Select(g => new { g.Key.CategoriaId, g.Key.Nome, Media = g.Average(x => (double)x.ValorNota!) })
                .ToListAsync();
            var areasComAlerta = mediasPorArea.Count(x => x.Media < 3.0);

            var totalAreas = await db.Categorias.AsNoTracking().CountAsync();

            return Results.Ok(new { nps, totalFeedbacks, areasComAlerta, totalAreas });
        });





        g.MapGet("/series", async (
            AppDbContext db,
            string interval,
            DateTime? from,
            DateTime? to,
            Guid? categoryId,
            bool? identified) =>
        {
            var inicio = AsUtc(((from ?? DateTime.UtcNow.AddDays(-30)).Date));
            var fim = AsUtc(((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1)));

            var q = db.FeedbackRespostas
                .Where(r => r.ValorNota != null &&
                            r.Feedback.CriadoEm >= inicio &&
                            r.Feedback.CriadoEm <= fim);

            if (identified == true)
            {
                q = q.Where(r =>
                    !string.IsNullOrEmpty(r.Feedback.NomeIdentificado) ||
                    !string.IsNullOrEmpty(r.Feedback.ContatoIdentificado));
            }

            if (categoryId.HasValue)
                q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);
        
            var rows = await q
                .Select(r => new { r.ValorNota, r.Feedback.CriadoEm })
                .AsNoTracking()
                .ToListAsync();

            DateTime Bucket(DateTime dt) => (interval?.ToLowerInvariant()) switch
            {
                "week" => dt.Date.AddDays(-(((int)dt.DayOfWeek + 6) % 7)), // segunda
                "month" => new DateTime(dt.Year, dt.Month, 1),
                _ => dt.Date
            };

            var grouped = rows
                .GroupBy(r => Bucket(r.CriadoEm))
                .OrderBy(g => g.Key)
                .Select(g =>
                {
                    var notas = g.Where(x => x.ValorNota.HasValue)
                                 .Select(x => (double)x.ValorNota!.Value)
                                 .ToList();

                    var media = notas.Count > 0 ? notas.Average() : 0.0;
                    return new { bucket = g.Key, avg = Math.Round(media, 2), count = g.Count() };
                })
                .ToList();

            return Results.Ok(grouped);
        });

        // coloque isso depois de declarar o 'g' (grupo /dashboard)

    g.MapGet("/words/heatmap", async (
        [FromQuery] string polarity,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? categoryId,
        [FromQuery] int? top,
        [FromQuery] bool? identified,
        AppDbContext db,
        AiClient ai,
        CancellationToken ct) =>
    {
        var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
        var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));
        var take = top is > 0 ? top.Value : 24;

        var q = db.FeedbackRespostas.AsNoTracking()
            .Where(r => r.ValorTexto != null &&
                        r.Feedback.CriadoEm >= inicio &&
                        r.Feedback.CriadoEm <= fim);

        if (categoryId.HasValue)
            q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

        if (identified == true)
        {
            q = q.Where(r =>
                !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
                !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
        }

        var rows = await q
            .Select(r => new
            {
                r.FeedbackId,
                Texto = r.ValorTexto!,
                r.Feedback.CriadoEm,
                r.Feedback.CategoriaId
            })
            .ToListAsync(ct);

        var inputs = rows.Select(r => new AiTextDto
        {
            Id = r.FeedbackId.ToString(),
            Text = r.Texto,
            Week = WeekBucket(r.CriadoEm).ToString("yyyy-MM-dd"),
            CategoryId = r.CategoriaId
        }).ToList();

        if (inputs.Count == 0)
            return Results.Ok(new List<WordHeatmapRow>());

        var wantPositive = string.Equals(polarity, "positive", StringComparison.OrdinalIgnoreCase)
                           || string.Equals(polarity, "pos", StringComparison.OrdinalIgnoreCase);

        var aiRes = await ai.ExtractKeywordsAsync(inputs, take, ct);
        List<AiHeatItemDto> list;
        if (aiRes == null)
        {
            // fallback simples se a IA não devolver nada: conta termos frequentes localmente
            var stop = new HashSet<string>(new[]
            {
                "de","da","do","das","dos","e","a","o","os","as","um","uma","que","com","pra","pro","na","no","em","por","para","se","ser","foi","era","é","são"
            }, StringComparer.OrdinalIgnoreCase);

            var freq = inputs
                .SelectMany(inp =>
                {
                    var week = inp.Week ?? WeekBucket(DateTime.UtcNow).ToString("yyyy-MM-dd");
                    var tokens = Regex.Matches(inp.Text ?? "", @"\p{L}{3,}", RegexOptions.IgnoreCase)
                        .Select(m => m.Value.ToLowerInvariant())
                        .Where(t => !stop.Contains(t));
                    return tokens.Select(t => new { week, keyword = t });
                })
                .GroupBy(x => new { x.week, x.keyword })
                .Select(g => new { g.Key.week, g.Key.keyword, total = g.Count(), score = 0.0 })
                .OrderByDescending(x => x.total)
                .Take(take)
                .ToList();

            var fallbackScore = wantPositive ? 0.6 : -0.6;
            list = freq.Select(f => new AiHeatItemDto
            {
                Week = f.week,
                Keyword = f.keyword,
                Total = f.total,
                Score = fallbackScore
            }).ToList();
        }
        else
        {
            list = wantPositive
                ? (aiRes.Pos ?? new List<AiHeatItemDto>()).ToList()
                : (aiRes.Neg ?? new List<AiHeatItemDto>()).ToList();
        }

        if (list.Count == 0)
            return Results.Ok(new List<WordHeatmapRow>());

        var dto = list
            .Select(item => new WordHeatmapRow
            {
                Week = item.Week ?? "",
                CategoryId = item.CategoryId,
                Word = item.Keyword,
                Total = item.Total,
                Score = item.Score
            })
            .ToList();

        dto = (wantPositive
                ? dto.Where(x => x.Score > 0.01)
                     .OrderByDescending(x => x.Score)
                     .ThenByDescending(x => x.Total)
                : dto.Where(x => x.Score < -0.01)
                     .OrderBy(x => x.Score)
                     .ThenByDescending(x => x.Total))
            .Take(take)
            .ToList();

        return Results.Ok(dto);
    });


        // ---- Distribuição de notas (1..10)
        g.MapGet("/distribution", async (DateTime? from, DateTime? to, Guid? categoryId,bool? identified, AppDbContext db) =>
     {
         var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
         var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

         var q = db.FeedbackRespostas.AsNoTracking()
             .Where(r => r.ValorNota != null && r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim);
         if (categoryId.HasValue)
             q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

        
    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

         var bins = await q.GroupBy(r => r.ValorNota!.Value)
             .Select(g => new { rating = g.Key, total = g.Count() })
             .OrderBy(x => x.rating)
             .ToListAsync();

         return Results.Ok(bins);
     });

        // ---- Top áreas (piores médias primeiro + nº de alertas)
       g.MapGet("/top-areas", async (
        int? limit,
        DateTime? from,
        DateTime? to,
        Guid? categoryId,
        bool? identified,
        AppDbContext db) =>
{
    var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
    var fim    = AsUtc((to   ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));
    int take   = limit is > 0 ? limit.Value : 10;

    var q = db.FeedbackRespostas.AsNoTracking()
        .Where(r => r.ValorNota != null &&
                    r.Feedback.CriadoEm >= inicio &&
                    r.Feedback.CriadoEm <= fim);

    if (categoryId.HasValue)
        q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

    var data = await q
        .Select(r => new
        {
            r.ValorNota,
            r.Feedback.CategoriaId,
            r.Feedback.Categoria!.Nome
        })
        .GroupBy(x => new { x.CategoriaId, x.Nome })
        .Select(g => new
        {
            categoryId = g.Key.CategoriaId,
            area       = g.Key.Nome,
            media      = g.Average(x => (double)x.ValorNota!),
            alertas    = g.Count(x => x.ValorNota! <= 3)
        })
        .OrderBy(x => x.media)
        .ThenByDescending(x => x.alertas)
        .Take(take)
        .ToListAsync();

    return Results.Ok(data);
});


        g.MapGet("/kpis-ira", async (DateTime? from, DateTime? to, AppDbContext db) =>
 {
     var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
     var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

     var respostas = await db.FeedbackRespostas.AsNoTracking()
         .Where(r => r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim)
         .Select(r => new { Nota = r.ValorNota, Texto = r.ValorTexto })
         .ToListAsync();

     if (respostas.Count == 0) return Results.Ok(new { ira = 0.0 });

     // pesos (pode ajustar depois)
     const double wK = 0.4; // palavras críticas
     const double wN = 0.6; // nota invertida
     const double W = wK + wN;

     double ScoreItem(int? nota, string? texto)
     {
         // nota normalizada 0..1 (se não tiver, usa 0.5)
         var n = nota.HasValue ? Math.Clamp(nota.Value, 0, 10) / 10.0 : 0.5;
         var invN = 1 - n; // quanto maior, pior

         // checagem de palavras críticas no ValorTexto
         bool hasKw = false;
         if (!string.IsNullOrWhiteSpace(texto))
         {
             var clean = RemoveDiacritics(texto.ToLowerInvariant());
             foreach (var tok in TokenSplit.Split(clean))
             {
                 var t = tok.Trim();
                 if (t.Length < 3) continue;
                 if (CriticalWords.Contains(t)) { hasKw = true; break; }
             }
         }

         var kw = hasKw ? 1.0 : 0.0;
         var ira01 = (wK * kw + wN * invN) / W; // 0..1
         return ira01 * 100.0;                  // 0..100
     }

     var ira = Math.Round(respostas.Average(x => ScoreItem(x.Nota, x.Texto)), 1);
     return Results.Ok(new { ira });
 });


        g.MapGet("/kpis-negativos", async (AppDbContext db) =>
 {
     var fim = DateTime.UtcNow;
     var d7 = fim.AddDays(-7);
     var d30 = fim.AddDays(-30);

    var rows = await db.FeedbackRespostas.AsNoTracking()
        .Select(r => new { r.ValorNota, r.Feedback.CriadoEm })
        .ToListAsync();

     var s7 = rows.Where(x => x.CriadoEm >= d7).ToList();
     var s30 = rows.Where(x => x.CriadoEm >= d30).ToList();

     double pct7 = s7.Count == 0 ? 0 : Math.Round(100.0 * s7.Count(x => x.ValorNota.HasValue && x.ValorNota <= 6) / s7.Count, 1);
     double pct30 = s30.Count == 0 ? 0 : Math.Round(100.0 * s30.Count(x => x.ValorNota.HasValue && x.ValorNota <= 6) / s30.Count, 1);

     return Results.Ok(new { pct7, pct30 });
 });


        g.MapGet("/kpis-cobertura", async (DateTime? from, DateTime? to, AppDbContext db) =>
        {
            var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
            var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

            int feedbacks = await db.Feedbacks.AsNoTracking()
                .CountAsync(f => f.CriadoEm >= inicio && f.CriadoEm <= fim);

            int? totalAlunos = null; // TODO: puxar de tabela 'turma' ou config
            double? cobertura = totalAlunos.HasValue && totalAlunos.Value > 0
                ? Math.Round(100.0 * feedbacks / totalAlunos.Value, 1)
                : null;

            return Results.Ok(new { feedbacks, totalAlunos, cobertura });
        });

        g.MapGet("/kpis-topico-critico", async (DateTime? to, AppDbContext db) =>
        {
            var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));
            var w0ini = AsUtc(fim.AddDays(-7).Date);   // semana atual
            var w1ini = AsUtc(fim.AddDays(-14).Date);  // semana anterior

            var rows = await db.FeedbackRespostas.AsNoTracking()
                .Where(r => r.ValorNota != null && r.Feedback.CriadoEm >= w1ini && r.Feedback.CriadoEm <= fim)
                .Select(r => new
                {
                    Cat = r.Feedback.Categoria != null ? r.Feedback.Categoria.Nome : "(Sem categoria)",
                    Dt = r.Feedback.CriadoEm
                })
                .ToListAsync();

            var w0 = rows.Where(x => x.Dt >= w0ini);
            var w1 = rows.Where(x => x.Dt < w0ini);

            var grup = (from x in rows
                        group x by x.Cat into g
                        let c0 = w0.Count(z => z.Cat == g.Key)
                        let c1 = w1.Count(z => z.Cat == g.Key)
                        where (c0 + c1) >= 20                     // mínimo 20 menções
                        let growth = c1 == 0 ? (c0 > 0 ? double.PositiveInfinity : 0) : (c0 - c1) / (double)c1
                        orderby growth descending
                        select new { topico = g.Key, c0, c1, growth }).FirstOrDefault();

            return Results.Ok(grup ?? new { topico = "—", c0 = 0, c1 = 0, growth = 0.0 });
        });

        g.MapGet("/question-series", async (Guid questionId, string? interval, DateTime? from, DateTime? to, AppDbContext db) =>
{
    var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-84)).Date);
    var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));
    var step = (interval ?? "week").ToLowerInvariant(); // day|week|month

    var rows = await db.FeedbackRespostas.AsNoTracking()
        .Where(r => r.PerguntaId == questionId && r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim)
        .Select(r => new { r.ValorNota, r.Feedback.CriadoEm })
        .ToListAsync();

    IEnumerable<IGrouping<DateTime, dynamic>> groups = step switch
    {
        "day" => rows.GroupBy(x => x.CriadoEm.Date),
        "month" => rows.GroupBy(x => new DateTime(x.CriadoEm.Year, x.CriadoEm.Month, 1)),
        _ => rows.GroupBy(x => WeekBucket(x.CriadoEm))
    };

    var data = groups.OrderBy(g => g.Key).Select(g =>
    {
        var tot = g.Count();
        var media = g.Where(x => x.ValorNota.HasValue).Select(x => (double)x.ValorNota!).DefaultIfEmpty().Average();
        var neg = tot == 0 ? 0.0 : Math.Round(100.0 * g.Count(x => x.ValorNota.HasValue && x.ValorNota <= 6) / tot, 1);
        return new
        {
            bucket = g.Key.ToString("yyyy-MM-dd"),
            avg = Math.Round(media, 2),
            neg
        };
    });

    return Results.Ok(data);
});

        // /dashboard/topics-heatmap — keywords por semana vindas de ValorTexto (sem precisar de #)
      g.MapGet("/topics-heatmap", async (
     AppDbContext db,
     DateTime? from,
     DateTime? to,
     Guid? categoryId,
     bool? identified,
     int? top,
     int? limit) =>
{
    var inicio = AsUtc((from ?? DateTime.UtcNow.AddDays(-30)).Date);
    var fim    = AsUtc((to   ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));
    var topN   = (top ?? limit ?? 6);

     var baseQ = db.FeedbackRespostas
         .Where(r => r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim)
       .Where(r => !string.IsNullOrWhiteSpace(r.ValorTexto));

     if (categoryId.HasValue)
         baseQ = baseQ.Where(r => r.Feedback.CategoriaId == categoryId.Value);

             if (identified == true)
    {
        baseQ = baseQ.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

     var rows = await baseQ.AsNoTracking()
         .Select(r => new { Texto = r.ValorTexto!, Dt = r.Feedback.CriadoEm })
         .ToListAsync();

     static DateTime WeekBucket(DateTime d)
         => d.Date.AddDays(-(((int)d.DayOfWeek + 6) % 7)); // segunda

     var wkKw = new Dictionary<(DateTime week, string kw), int>();
     var kwTotals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

     foreach (var row in rows)
     {
         var week = WeekBucket(row.Dt);
         var text = RemoveDiacritics(row.Texto.ToLowerInvariant());
         foreach (var raw in TokenSplit.Split(text))
         {
             var w = raw.Trim();
             if (w.Length <= 3) continue;         
             if (int.TryParse(w, out _)) continue;
             if (Stopwords.Contains(w)) continue;

             var key = (week, w);
             wkKw[key] = wkKw.TryGetValue(key, out var c) ? c + 1 : 1;
             kwTotals[w] = kwTotals.TryGetValue(w, out var t) ? t + 1 : 1;
         }
     }

     var topKeywords = kwTotals
         .OrderByDescending(kv => kv.Value)
         .Take(topN)
         .Select(kv => kv.Key)
         .ToHashSet(StringComparer.OrdinalIgnoreCase);

    var data = wkKw
        .Where(kv => topKeywords.Contains(kv.Key.kw))
        .OrderBy(kv => kv.Key.week)
        .Select(kv => new
        {
             week  = kv.Key.week.ToString("yyyy-MM-dd"),
             topic = kv.Key.kw,
             total = kv.Value
       })
        .ToList(); // materializa para evitar streams vazios

     return Results.Ok(data);
 });


g.MapGet("/topics-polarity", async (DateTime? from, DateTime? to, Guid? categoryId,bool? identified, AppDbContext db) =>
 {
     var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
     var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

      var q = db.FeedbackRespostas.AsNoTracking()
          .Where(r => r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim);

      if (categoryId.HasValue)
          q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

        
    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

      var rows = await q.Select(r => new { Topico = r.Pergunta.Enunciado, Nota = r.ValorNota }).ToListAsync();

      bool Neg(int? n) => n.HasValue && n <= 6;
      bool Pos(int? n) => n.HasValue && n >= 9;

      var data = rows
          .GroupBy(x => x.Topico)
          .Select(g =>
          {
              int tot = g.Count();
              int neg = g.Count(x => Neg(x.Nota));
              int pos = g.Count(x => Pos(x.Nota));
              int neu = tot - neg - pos;
              double pneg = tot == 0 ? 0 : (100.0 * neg / tot);
              return new { topic = g.Key, neg, neu, pos, pneg };
          })
          .OrderByDescending(x => x.pneg)
          .ToList();

        return Results.Ok(data);
});


        g.MapGet("/boxplot-notas", async (string groupBy, DateTime? from, DateTime? to, Guid? categoryId, bool? identified, AppDbContext db) =>
 {
     var gb = (groupBy ?? "curso").ToLowerInvariant();
     if (gb != "curso")
         return Results.BadRequest(new { error = "groupBy aceita apenas 'curso' (CursoOuTurma) no momento." });

     var inicio = AsUtc((from ?? DateTime.UtcNow.Date.AddDays(-30)).Date);
     var fim = AsUtc((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

     var q = db.FeedbackRespostas.AsNoTracking()
         .Where(r => r.ValorNota != null && r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim);

     if (categoryId.HasValue)
         q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

     var data = await q
         .Select(r => new { Grupo = r.Feedback.CursoOuTurma ?? "(Sem curso/turma)", Nota = (double)r.ValorNota! })
         .GroupBy(x => x.Grupo)
         .Select(g => new { group = g.Key, notas = g.Select(v => v.Nota).ToList() })
         .ToListAsync();

     static (double q1, double q2, double q3, double min, double max, double[] outliers) Box(List<double> v)
     {
         var a = v.OrderBy(x => x).ToArray();
         if (a.Length == 0) return (0, 0, 0, 0, 0, Array.Empty<double>());
         double P(double p) { var i = (a.Length - 1) * p; var lo = (int)Math.Floor(i); var hi = (int)Math.Ceiling(i); return lo == hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); }
         var q1 = P(0.25); var q2 = P(0.5); var q3 = P(0.75); var iqr = q3 - q1; var lo = q1 - 1.5 * iqr; var hi = q3 + 1.5 * iqr;
         var outs = a.Where(x => x < lo || x > hi).ToArray();
         var min = a.Where(x => x >= lo).DefaultIfEmpty(a.First()).Min();
         var max = a.Where(x => x <= hi).DefaultIfEmpty(a.Last()).Max();
         return (q1, q2, q3, min, max, outs);
     }

     var result = data.Select(d =>
     {
         var b = Box(d.notas);
         return new { d.group, q1 = Math.Round(b.q1, 2), median = Math.Round(b.q2, 2), q3 = Math.Round(b.q3, 2), min = Math.Round(b.min, 2), max = Math.Round(b.max, 2), outliers = b.outliers };
     });

     return Results.Ok(result);
 });



        // 1) NPS por período (para o gráfico "NPS (tendência)")
       g.MapGet("/nps-series", async (
        string? interval,
        DateTime? from,
        DateTime? to,
        Guid? categoryId,
        bool? identified,
        AppDbContext db) =>
{
    var step   = (interval ?? "week").ToLowerInvariant(); // day|week|month
    var inicio = AsUtc((from ?? DateTime.UtcNow.AddDays(-84)).Date);
    var fim    = AsUtc((to   ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

    var q = db.FeedbackRespostas.AsNoTracking()
        .Where(r => r.ValorNota != null &&
                    r.Feedback.CriadoEm >= inicio &&
                    r.Feedback.CriadoEm <= fim);

    if (categoryId.HasValue)
        q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

    var rows = await q
        .Select(r => new { Nota = r.ValorNota!.Value, Dt = r.Feedback.CriadoEm })
        .ToListAsync();

    IEnumerable<IGrouping<DateTime, dynamic>> groups = step switch
    {
        "day"   => rows.GroupBy(x => x.Dt.Date),
        "month" => rows.GroupBy(x => new DateTime(x.Dt.Year, x.Dt.Month, 1)),
        _       => rows.GroupBy(x => WeekBucket(x.Dt))
    };

    var data = groups.OrderBy(g => g.Key).Select(g =>
    {
        var tot = g.Count();
        var prom = g.Count(x => x.Nota >= NpsPromoterMin);
        var det  = g.Count(x => x.Nota <= NpsDetractorMax);
        var nps  = tot == 0 ? 0 : (int)Math.Round(((prom - det) / (double)tot) * 100);
        return new { bucket = g.Key, nps };
    }).ToList()
      .Select(x => new { bucket = x.bucket.ToString("yyyy-MM-dd"), x.nps })
      .ToList();

    return Results.Ok(data);
});


        // 2) Volume de feedbacks por dia (para "Volume de feedbacks")
       g.MapGet("/volume-series", async (
        string? interval,
        DateTime? from,
        DateTime? to,
        Guid? categoryId,
        bool? identified,
        AppDbContext db) =>
{
    var step   = (interval ?? "day").ToLowerInvariant(); // day|week|month
    var inicio = AsUtc((from ?? DateTime.UtcNow.AddDays(-30)).Date);
    var fim    = AsUtc((to   ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

    var q = db.Feedbacks.AsNoTracking()
        .Where(f => f.CriadoEm >= inicio && f.CriadoEm <= fim);

    if (categoryId.HasValue)
        q = q.Where(f => f.CategoriaId == categoryId.Value);

    if (identified == true)
    {
        q = q.Where(f =>
            !string.IsNullOrWhiteSpace(f.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(f.ContatoIdentificado));
    }

    var rows = await q.Select(f => f.CriadoEm).ToListAsync();

    IEnumerable<IGrouping<DateTime, DateTime>> groups = step switch
    {
        "week"  => rows.GroupBy(x => WeekBucket(x)),
        "month" => rows.GroupBy(x => new DateTime(x.Year, x.Month, 1)),
        _       => rows.GroupBy(x => x.Date)
    };

    var data = groups
        .OrderBy(g => g.Key)
        .Select(g => new { bucket = g.Key, total = g.Count() })
        .ToList()
        .Select(x => new { bucket = x.bucket.ToString("yyyy-MM-dd"), x.total })
        .ToList();

    return Results.Ok(data);
});

        // 3) Alertas por área (para "Alertas por área")
       g.MapGet("/areas-alerts", async (
        int? limit,
        DateTime? from,
        DateTime? to,
        Guid? categoryId,
        bool? identified,
        AppDbContext db) =>
{
    var inicio = AsUtc((from ?? DateTime.UtcNow.AddDays(-30)).Date);
    var fim    = AsUtc((to   ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));
    int take   = limit is > 0 ? limit.Value : 8;

    var q = db.FeedbackRespostas.AsNoTracking()
        .Where(r => r.ValorNota != null &&
                    r.Feedback.CriadoEm >= inicio &&
                    r.Feedback.CriadoEm <= fim);

    if (categoryId.HasValue)
        q = q.Where(r => r.Feedback.CategoriaId == categoryId.Value);

    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

    var data = await q
        .Select(r => new
        {
            r.ValorNota,
            r.Feedback.CategoriaId,
            Area = r.Feedback.Categoria != null
                ? r.Feedback.Categoria.Nome
                : "(Sem categoria)"
        })
        .GroupBy(x => new { x.CategoriaId, x.Area })
        .Select(g => new
        {
            area = g.Key.Area,
            crit = g.Count(x => x.ValorNota! <= 3),
            ok   = g.Count(x => x.ValorNota! >= 4)
        })
        .OrderByDescending(x => x.crit)
        .Take(take)
        .ToListAsync();

    return Results.Ok(data);
});


        // 4) Horários 00..23 (para "Participação por horário")
        g.MapGet("/hourly", async (
        DateTime? from,
        DateTime? to,
        Guid? categoryId,
        bool? identified,
        AppDbContext db) =>
{
    var inicio = AsUtc((from ?? DateTime.UtcNow.AddDays(-30)).Date);
    var fim    = AsUtc((to   ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1));

    var q = db.Feedbacks.AsNoTracking()
        .Where(f => f.CriadoEm >= inicio && f.CriadoEm <= fim);

    if (categoryId.HasValue)
        q = q.Where(f => f.CategoriaId == categoryId.Value);

    if (identified == true)
    {
        q = q.Where(f =>
            !string.IsNullOrWhiteSpace(f.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(f.ContatoIdentificado));
    }

    var rows = await q.Select(f => f.CriadoEm.Hour).ToListAsync();

    var data = Enumerable.Range(0, 24)
        .Select(h => new { hour = h, total = rows.Count(x => x == h) });

    return Results.Ok(data);
});


        // 5) Piores perguntas (para "Piores perguntas – Top 5")
       g.MapGet("/questions-worst", async (
        AppDbContext db,
        DateTime? from,
       DateTime? to,
       DateTime? inicio,
       DateTime? fim,
       Guid? categoryId,
       bool? identified,
       int? limit) =>
{
    var startLocal = (from ?? inicio ?? DateTime.UtcNow.AddDays(-30));
    var endLocal   = (to   ?? fim   ?? DateTime.UtcNow);

    var start = AsUtc(startLocal.Date);
    var end   = AsUtc(endLocal.Date.AddDays(1).AddTicks(-1));

    var take = (limit is > 0 ? limit.Value : 5);

    var q = db.FeedbackRespostas.AsNoTracking()
        .Where(r => r.ValorNota != null &&
                    r.Feedback.CriadoEm >= start &&
                    r.Feedback.CriadoEm <= end);

    if (categoryId.HasValue)
        q = q.Where(r => r.Feedback.CategoriaId == categoryId);

    if (identified == true)
    {
        q = q.Where(r =>
            !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
            !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
    }

    var data = await q
        .GroupBy(r => new { r.PerguntaId, r.Pergunta.Enunciado })
        .Select(g => new
        {
            questionId = g.Key.PerguntaId,
            pergunta   = g.Key.Enunciado,
            media      = g.Average(x => (double)x.ValorNota!)
        })
        .OrderBy(x => x.media)
        .Take(take)
        .ToListAsync();

    return Results.Ok(data);
});

        // ====== Chatbot/assistente de insights (usa IA Python local) ======
        g.MapPost("/assistant", async (
            [FromBody] DashboardAssistantRequest body,
            AppDbContext db,
            AiClient ai,
            CancellationToken ct) =>
        {
            var (inicio, fim) = Range(body.From, body.To, 30);

            var fbQ = db.Feedbacks.AsNoTracking()
                .Where(f => f.CriadoEm >= inicio && f.CriadoEm <= fim);

            if (body.CategoryId.HasValue)
                fbQ = fbQ.Where(f => f.CategoriaId == body.CategoryId.Value);
            if (!string.IsNullOrWhiteSpace(body.Curso))
                fbQ = fbQ.Where(f => f.CursoOuTurma == body.Curso);
            if (body.Identified == true)
            {
                fbQ = fbQ.Where(f =>
                    !string.IsNullOrWhiteSpace(f.NomeIdentificado) ||
                    !string.IsNullOrWhiteSpace(f.ContatoIdentificado));
            }

            var respQ = db.FeedbackRespostas.AsNoTracking()
                .Where(r => r.Feedback.CriadoEm >= inicio && r.Feedback.CriadoEm <= fim);

            if (body.CategoryId.HasValue)
                respQ = respQ.Where(r => r.Feedback.CategoriaId == body.CategoryId.Value);
            if (body.Identified == true)
            {
                respQ = respQ.Where(r =>
                    !string.IsNullOrWhiteSpace(r.Feedback.NomeIdentificado) ||
                    !string.IsNullOrWhiteSpace(r.Feedback.ContatoIdentificado));
            }
            if (!string.IsNullOrWhiteSpace(body.Curso))
                respQ = respQ.Where(r => r.Feedback.CursoOuTurma == body.Curso);

            var totalFeedbacks = await fbQ.CountAsync(ct);

            var notasQ = respQ.Where(r => r.ValorNota != null);
            var totalNotas = await notasQ.CountAsync(ct);
            var prom = await notasQ.CountAsync(r => r.ValorNota >= NpsPromoterMin, ct);
            var det = await notasQ.CountAsync(r => r.ValorNota <= NpsDetractorMax, ct);
            var nps = totalNotas == 0 ? 0 : (int)Math.Round(((prom - det) / (double)totalNotas) * 100);

            var medias = await respQ
                .Where(r => r.ValorNota != null)
                .GroupBy(r => new { r.Feedback.CategoriaId })
                .Select(g => new { Media = g.Average(x => (double)x.ValorNota!) })
                .ToListAsync(ct);
            var areasComAlerta = medias.Count(x => x.Media < 3.0);
            var totalAreas = await db.Categorias.AsNoTracking().CountAsync(ct);

            var seriesRows = await notasQ
                .Select(r => new { r.ValorNota, r.Feedback.CriadoEm })
                .ToListAsync(ct);

            var series = seriesRows
                .GroupBy(r => WeekBucket(r.CriadoEm))
                .OrderBy(g => g.Key)
                .Select(g => new SeriesPointDto
                {
                    Bucket = g.Key.ToString("yyyy-MM-dd"),
                    Avg = g.Where(x => x.ValorNota.HasValue).Select(x => (double)x.ValorNota!).DefaultIfEmpty().Average(),
                    Count = g.Count()
                })
                .ToList();

            var volumeRows = await fbQ
                .Select(f => f.CriadoEm.Date)
                .ToListAsync(ct);

            var volume = volumeRows
                .GroupBy(d => d)
                .OrderBy(g => g.Key)
                .Select(g => new VolumePointDto
                {
                    Bucket = g.Key.ToString("yyyy-MM-dd"),
                    Total = g.Count()
                })
                .ToList();

            var topicRows = await respQ
                .Where(r => r.ValorNota != null)
                .Select(r => new { Topic = r.Pergunta.Enunciado, Nota = r.ValorNota })
                .ToListAsync(ct);

            bool Neg(int? n) => n.HasValue && n <= 6;
            bool Pos(int? n) => n.HasValue && n >= 9;

            var topics = topicRows
                .GroupBy(x => x.Topic)
                .Select(g =>
                {
                    int tot = g.Count();
                    int neg = g.Count(x => Neg(x.Nota));
                    int pos = g.Count(x => Pos(x.Nota));
                    int neu = tot - neg - pos;
                    double pneg = tot == 0 ? 0 : (100.0 * neg / tot);
                    return new TopicsPolarityRowDto
                    {
                        Topic = g.Key,
                        Neg = neg,
                        Neu = neu,
                        Pos = pos,
                        Pneg = pneg
                    };
                })
                .OrderByDescending(x => x.Pneg)
                .Take(12)
                .ToList();

            var worstQuestions = await respQ
                .Where(r => r.ValorNota != null)
                .GroupBy(r => new { r.PerguntaId, r.Pergunta.Enunciado })
                .Select(g => new AiWorstQuestionDto
                {
                    Question = g.Key.Enunciado,
                    Avg = g.Average(x => (double)x.ValorNota!),
                    Total = g.Count()
                })
                .OrderBy(q => q.Avg)
                .ThenByDescending(q => q.Total)
                .Take(3)
                .ToListAsync(ct);

            var textRows = await respQ
                .Where(r => r.ValorTexto != null)
                .Select(r => new
                {
                    r.FeedbackId,
                    Texto = r.ValorTexto!,
                    r.Feedback.CriadoEm,
                    r.Feedback.CategoriaId
                })
                .ToListAsync(ct);

            var aiTexts = textRows.Select(r => new AiTextDto
            {
                Id = r.FeedbackId.ToString(),
                Text = r.Texto,
                Week = WeekBucket(r.CriadoEm).ToString("yyyy-MM-dd"),
                CategoryId = r.CategoriaId
            }).ToList();

            var aiKw = aiTexts.Count > 0
                ? await ai.ExtractKeywordsAsync(aiTexts, 32, ct)
                : new AiKeywordResponseDto();

            var filtersRaw = new Dictionary<string, string?>
            {
                ["from"] = body.From?.ToString("yyyy-MM-dd"),
                ["to"] = body.To?.ToString("yyyy-MM-dd"),
                ["categoryId"] = body.CategoryId?.ToString(),
                ["curso"] = body.Curso,
                ["turno"] = body.Turno,
                ["unidade"] = body.Unidade,
                ["identified"] = body.Identified?.ToString()
            };
            var filters = filtersRaw
                .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            var aiReq = new AiAssistantRequestDto
            {
                Question = body.Question ?? "",
                Context = new AiAssistantContextDto
                {
                    Filters = filters,
                    Kpis = new AiKpiDto
                    {
                        Nps = nps,
                        TotalFeedbacks = totalFeedbacks,
                        AreasComAlerta = areasComAlerta,
                        TotalAreas = totalAreas
                    },
                    Series = series,
                    Volume = volume,
                    Topics = topics,
                    WorstQuestions = worstQuestions,
                    WordsNeg = aiKw.Neg,
                    WordsPos = aiKw.Pos
                }
            };

            var aiResp = await ai.AskAssistantAsync(aiReq, ct);
            aiResp ??= new AiAssistantResponseDto
            {
                Answer = "Assistente temporariamente indisponível. Tente novamente em instantes.",
                Filters = filters,
                Suggestions = new List<string> { "Verifique se o serviço de IA está rodando (container ai)." }
            };

            return Results.Ok(aiResp);
        });

        return api;
    }

public sealed class DashboardAssistantRequest
{
    public string? Question { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public Guid? CategoryId { get; set; }
    public string? Curso { get; set; }
    public string? Turno { get; set; }
    public string? Unidade { get; set; }
    public bool? Identified { get; set; }
}

public sealed class WordHeatmapRow
{
    public string Week { get; set; } = "";
    public Guid? CategoryId { get; set; }
    public string Word { get; set; } = "";
    public int Total { get; set; }
    public double Score { get; set; } // <<< necessário
}

    // ===== Helpers globais (nível de classe) =====
    private static readonly HashSet<string> Stopwords = new(StringComparer.OrdinalIgnoreCase)
{
    "a","o","os","as","de","da","do","das","dos","e","é","em","no","na","nos","nas","um","uma","uns","umas",
    "para","por","com","sem","ao","à","aos","às","que","se","ser","tem","têm","ter","foi","era","são","está",
    "estão","como","mais","menos","muito","muita","muitos","muitas","pouco","pouca","poucos","poucas","já",
    "também","entre","até","quando","onde","porque","pois","per","sobre","sob","lhe","lhes","me","te","vai",
    "depois","antes","agora","hoje","ontem","amanhã","pra","pro","q","pq","vc","vcs","ok","bom","boa","ruim"
};



    private static readonly Regex TokenSplit = new(@"[^a-zà-ú0-9]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static string RemoveDiacritics(string text)
    {
        return string.Concat(text.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark))
            .Normalize(NormalizationForm.FormC);
    }

    // Auxiliares de bucket de data
    // Normaliza qualquer DateTime para UTC (evita mix de Kinds)
    private static DateTime AsUtc(DateTime dt)
        => dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };

    private static DateTime WeekBucket(DateTime dt) => dt.Date.AddDays(-(int)dt.Date.DayOfWeek).Date;

    private static readonly HashSet<string> CriticalWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "ruim", "péssimo", "horrível", "terrível", "insuportável", "inaceitável",
        "ódio", "detesto", "pior", "decepcionante", "frustrante", "lamentável",
        "problema", "erro", "falha", "bug", "defeito", "complicado",
        "difícil", "demorado", "atraso", "insuportável", "inaceitável",
        "reclamação", "reclamar", "insatisfação", "insatisfeito",
        "cancelar", "cancelamento", "deixar", "abandono"
    };

}
