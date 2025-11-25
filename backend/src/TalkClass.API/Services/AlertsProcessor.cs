using System.Text;
using Microsoft.EntityFrameworkCore;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Domain.Entities;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Services;

public class AlertsProcessor
{
    private readonly AppDbContext _db;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<AlertsProcessor> _logger;

    public AlertsProcessor(AppDbContext db, IEmailSender emailSender, ILogger<AlertsProcessor> logger)
    {
        _db = db;
        _emailSender = emailSender;
        _logger = logger;
    }

    public record TriggeredRule(
        Guid Id,
        string Nome,
        string Categoria,
        decimal NotaMinima,
        int PeriodoDias,
        double MediaCalculada,
        int TotalFeedbacks);

    public record RunResult(
        int TriggeredCount,
        int ActiveRules,
        string SendMode,
        IReadOnlyList<TriggeredRule> Items,
        IReadOnlyList<KeywordMatch> Keywords);

    public async Task<RunResult> RunAsync(CancellationToken ct, bool forceSend = false)
    {
        var now = DateTime.UtcNow;

        var rules = await _db.AlertRules
            .AsNoTracking()
            .Where(r => r.Ativa)
            .ToListAsync(ct);

        var categories = await _db.Categorias
            .AsNoTracking()
            .Select(c => new { c.Id, c.Nome })
            .ToListAsync(ct);
        var categoryNames = categories.ToDictionary(c => c.Id, c => c.Nome);

        var config = await _db.AlertEmailConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        config ??= new AlertEmailConfig
        {
            AdminRecipientIds = new List<Guid>(),
            ExtraEmails = string.Empty,
            SendMode = "immediate",
            UpdatedAt = now
        };

        var sendMode = NormalizeSendMode(config.SendMode);

        var adminIds = (config.AdminRecipientIds ?? new List<Guid>()).Distinct().ToList();
        var adminEmails = new List<string>();
        if (adminIds.Count > 0)
        {
            adminEmails = await _db.Administradores
                .AsNoTracking()
                .Where(a => adminIds.Contains(a.Id) && a.IsActive && !string.IsNullOrWhiteSpace(a.Email))
                .Select(a => a.Email!)
                .ToListAsync(ct);
        }

        var extraEmails = (config.ExtraEmails ?? string.Empty)
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(e => e.Trim())
            .Where(e => e.Length > 3)
            .ToList();

        var recipients = adminEmails
            .Concat(extraEmails)
            .Select(e => e.ToLowerInvariant())
            .Distinct()
            .ToList();

        var triggered = new List<TriggeredRule>();
        var keywordMatches = new List<KeywordMatch>();

        foreach (var rule in rules)
        {
            var since = now.AddDays(-rule.PeriodoDias);

            var query = from resp in _db.FeedbackRespostas.AsNoTracking()
                        join fb in _db.Feedbacks.AsNoTracking() on resp.FeedbackId equals fb.Id
                        where resp.ValorNota != null
                              && fb.CriadoEm >= since
                              && (rule.CategoriaId == null || fb.CategoriaId == rule.CategoriaId)
                        select new { resp.ValorNota, fb.CategoriaId };

            var count = await query.CountAsync(ct);
            if (count == 0) continue;

            var avg = await query.AverageAsync(x => (double)x.ValorNota!, ct);

            if ((decimal)avg < rule.NotaMinima)
            {
                triggered.Add(new TriggeredRule(
                    rule.Id,
                    rule.Nome,
                    rule.CategoriaId != null && categoryNames.TryGetValue(rule.CategoriaId.Value, out var catName)
                        ? catName
                        : "Todas",
                    rule.NotaMinima,
                    rule.PeriodoDias,
                    avg,
                    count));
            }
            else
            {
                _logger.LogInformation("Regra não disparou: {Rule} | media={Media:F2} limite={Limite} period={Dias}d categoria={Categoria}",
                    rule.Nome, avg, rule.NotaMinima, rule.PeriodoDias, rule.CategoriaId);
            }
        }

        // Palavras-chave críticas em textos (lookback fixo: 30 dias)
        var keywords = ParseKeywords(config.CriticalKeywords);
        if (keywords.Count > 0)
        {
            var lookback = now.AddDays(-30);
            foreach (var kw in keywords)
            {
                var count = await _db.FeedbackRespostas.AsNoTracking()
                    .Where(r => r.Feedback.CriadoEm >= lookback &&
                                (
                                    (r.ValorTexto != null && EF.Functions.ILike(r.ValorTexto!, $"%{kw}%")) ||
                                    (r.ValorOpcao != null && EF.Functions.ILike(r.ValorOpcao!, $"%{kw}%"))
                                ))
                    .CountAsync(ct);

                if (count > 0)
                    keywordMatches.Add(new KeywordMatch(kw, count));
            }
        }

        var shouldSend = (triggered.Count > 0 || keywordMatches.Count > 0)
            && recipients.Count > 0
            && (forceSend || sendMode == "immediate");
        _logger.LogInformation("Processamento de alertas: regrasAtivas={ActiveRules} disparadas={Triggered} keywords={Keywords} destinatarios={Recipients} sendMode={SendMode} forceSend={ForceSend}",
            rules.Count, triggered.Count, keywordMatches.Count, recipients.Count, sendMode, forceSend);

        if (shouldSend)
        {
            var subject = $"Alertas disparados ({triggered.Count}) - TalkClass";

            var sb = new StringBuilder();
            sb.AppendLine("Olá,");
            sb.AppendLine();
            sb.AppendLine("As seguintes regras de alerta foram disparadas:");
            sb.AppendLine("--------------------------------------------------");
            sb.AppendLine();
            foreach (var t in triggered)
            {
                sb.AppendLine($"Regra:      {t.Nome}");
                sb.AppendLine($"Categoria:  {t.Categoria}");
                sb.AppendLine($"Período:    Últimos {t.PeriodoDias} dia(s)");
                sb.AppendLine($"Média:      {t.MediaCalculada:F2}");
                sb.AppendLine($"Limite:     {t.NotaMinima:F2}");
                sb.AppendLine($"Feedbacks:  {t.TotalFeedbacks}");
                sb.AppendLine("--------------------------------------------------");
            }
            sb.AppendLine();
            if (keywordMatches.Count > 0)
            {
                sb.AppendLine("Palavras-chave críticas encontradas nos textos (últimos 30 dias):");
                sb.AppendLine("--------------------------------------------------");
                foreach (var km in keywordMatches)
                {
                    sb.AppendLine($"Palavra:    {km.Keyword}");
                    sb.AppendLine($"Ocorrências:{km.Occurrences}");
                    sb.AppendLine("--------------------------------------------------");
                }
                sb.AppendLine();
            }
            sb.AppendLine($"Modo de envio: {sendMode}");
            sb.AppendLine($"Executado em:  {now:yyyy-MM-dd HH:mm:ss} UTC");
            sb.AppendLine();
            sb.AppendLine("Acesse o painel de Alertas para mais detalhes.");

            foreach (var email in recipients)
            {
                try
                {
                    await _emailSender.SendAsync(email, subject, sb.ToString(), ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Falha ao enviar alerta para {Email}", email);
                }
            }
        }
        else if ((triggered.Count > 0 || keywordMatches.Count > 0) && recipients.Count == 0)
        {
            _logger.LogWarning("Alertas disparados, mas não há destinatários configurados.");
        }
        else if ((triggered.Count > 0 || keywordMatches.Count > 0) && !forceSend && sendMode == "daily")
        {
            _logger.LogInformation("Alertas/keywords encontrados, mas sendMode=daily e execução automática foi ignorada.");
        }
        else if (triggered.Count == 0 && keywordMatches.Count == 0)
        {
            _logger.LogInformation("Nenhuma regra disparou e nenhuma palavra-chave crítica foi encontrada.");
        }

        return new RunResult(triggered.Count, rules.Count, sendMode, triggered, keywordMatches);
    }

    private static string NormalizeSendMode(string? mode) =>
        string.Equals(mode, "daily", StringComparison.OrdinalIgnoreCase)
            ? "daily"
            : "immediate";

    private static List<string> ParseKeywords(string? raw) =>
        string.IsNullOrWhiteSpace(raw)
            ? new List<string>()
            : raw.Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                 .Select(k => k.Trim())
                 .Where(k => k.Length > 1)
                 .Distinct(StringComparer.OrdinalIgnoreCase)
                 .ToList();
}
