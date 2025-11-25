using Microsoft.EntityFrameworkCore;
using TalkClass.Domain.Entities;

namespace TalkClass.Application.Common.Interfaces;

public interface IAppDbContext
{
    DbSet<Administrador> Administradores { get; }

    DbSet<Categoria> Categorias { get; }
    DbSet<Pergunta> Perguntas { get; }
    DbSet<Feedback> Feedbacks { get; }
    DbSet<FeedbackResposta> FeedbackRespostas { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<AlertRule> AlertRules { get; }
    DbSet<AlertEmailConfig> AlertEmailConfigs { get; }
    DbSet<AlertNotification> AlertNotifications { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
