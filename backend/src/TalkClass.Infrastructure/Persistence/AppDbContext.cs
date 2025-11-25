using Microsoft.EntityFrameworkCore;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Domain.Entities;
using TalkClass.Domain.ValueObjects;



public class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Pergunta> Perguntas => Set<Pergunta>();
    public DbSet<PerguntaOpcao> PerguntaOpcoes => Set<PerguntaOpcao>();   // << NOVO DbSet
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<FeedbackResposta> FeedbackRespostas => Set<FeedbackResposta>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Administrador> Administradores => Set<Administrador>();
    public DbSet<AlertRule> AlertRules => Set<AlertRule>();
    public DbSet<AlertEmailConfig> AlertEmailConfigs => Set<AlertEmailConfig>();
    public DbSet<AlertNotification> AlertNotifications => Set<AlertNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // ValueObject CPF
        modelBuilder.Entity<Administrador>()
            .Property(a => a.Cpf)
            .HasConversion(v => v.Value, v => new Cpf(v));

    

        base.OnModelCreating(modelBuilder);
    }
}
