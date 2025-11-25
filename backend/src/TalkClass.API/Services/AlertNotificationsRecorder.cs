using Microsoft.EntityFrameworkCore;
using TalkClass.Domain.Entities;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Services;

public class AlertNotificationsRecorder
{
    private readonly AppDbContext _db;

    public AlertNotificationsRecorder(AppDbContext db)
    {
        _db = db;
    }

    public async Task RecordNewFeedbackAsync(Feedback feedback, CancellationToken ct)
    {
        var categoria = await _db.Categorias
            .AsNoTracking()
            .Where(c => c.Id == feedback.CategoriaId)
            .Select(c => c.Nome)
            .FirstOrDefaultAsync(ct);

        var title = "Novo feedback recebido";
        var message = categoria != null
            ? $"Novo feedback na categoria \"{categoria}\"."
            : "Novo feedback registrado.";

        _db.AlertNotifications.Add(new AlertNotification
        {
            Id = Guid.NewGuid(),
            Title = title,
            Message = message,
            Severity = "info",
            FeedbackId = feedback.Id,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordIdentifiedFeedbackAsync(Feedback feedback, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(feedback.NomeIdentificado) && string.IsNullOrWhiteSpace(feedback.ContatoIdentificado))
            return;

        var categoria = await _db.Categorias
            .AsNoTracking()
            .Where(c => c.Id == feedback.CategoriaId)
            .Select(c => c.Nome)
            .FirstOrDefaultAsync(ct);

        var title = "Feedback identificado";
        var message = categoria != null
            ? $"Feedback identificado em \"{categoria}\"."
            : "Feedback identificado registrado.";

        _db.AlertNotifications.Add(new AlertNotification
        {
            Id = Guid.NewGuid(),
            Title = title,
            Message = message,
            Severity = "warning",
            FeedbackId = feedback.Id,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordAsync(AlertsProcessor.RunResult result, CancellationToken ct)
    {
        if ((result.Items?.Count ?? 0) == 0 && (result.Keywords?.Count ?? 0) == 0)
            return;

        var now = DateTime.UtcNow;
        var toAdd = new List<AlertNotification>();

        foreach (var item in result.Items ?? Array.Empty<AlertsProcessor.TriggeredRule>())
        {
            var msg = $"Média {item.MediaCalculada:F1} abaixo de {item.NotaMinima:F1} nos últimos {item.PeriodoDias} dias ({item.TotalFeedbacks} feedbacks).";
            toAdd.Add(new AlertNotification
            {
                Id = Guid.NewGuid(),
                Title = item.Nome,
                Message = msg,
                Severity = "warning",
                CreatedAt = now
            });
        }

        foreach (var kw in result.Keywords ?? Array.Empty<KeywordMatch>())
        {
            var msg = $"Palavra-chave \"{kw.Keyword}\" encontrada em {kw.Occurrences} resposta(s) (30 dias).";
            toAdd.Add(new AlertNotification
            {
                Id = Guid.NewGuid(),
                Title = "Palavra-chave crítica",
                Message = msg,
                Severity = "error",
                CreatedAt = now
            });
        }

        if (toAdd.Count == 0) return;

        _db.AlertNotifications.AddRange(toAdd);
        await _db.SaveChangesAsync(ct);
    }
}
