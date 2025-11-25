using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class AlertRuleConfiguration : IEntityTypeConfiguration<AlertRule>
{
    public void Configure(EntityTypeBuilder<AlertRule> b)
    {
        b.ToTable("alert_rules");
        b.HasKey(x => x.Id);

        b.Property(x => x.Nome)
            .IsRequired()
            .HasMaxLength(160);

        b.Property(x => x.NotaMinima)
            .HasPrecision(3, 2)
            .IsRequired();

        b.Property(x => x.PeriodoDias)
            .IsRequired();

        b.Property(x => x.EnviarEmail)
            .HasDefaultValue(true);

        b.Property(x => x.Ativa)
            .HasDefaultValue(true);

        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.UpdatedAt);

        b.HasOne(x => x.Categoria)
            .WithMany()
            .HasForeignKey(x => x.CategoriaId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(x => x.Ativa);
        b.HasIndex(x => x.CategoriaId);
    }
}
