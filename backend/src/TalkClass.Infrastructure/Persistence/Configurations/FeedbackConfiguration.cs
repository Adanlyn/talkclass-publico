// backend/src/TalkClass.Infrastructure/Persistence/Configurations/FeedbackConfiguration.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class FeedbackConfiguration : IEntityTypeConfiguration<Feedback>
{
    public void Configure(EntityTypeBuilder<Feedback> b)
    {
        b.ToTable("feedbacks");
        b.HasKey(x => x.Id);

        b.Property(x => x.CriadoEm).IsRequired();

        b.Property(x => x.CursoOuTurma)
            .HasMaxLength(120)
            .IsRequired(false);

        // novos campos opcionais:
        b.Property(x => x.NomeIdentificado)
            .HasColumnName("NomeIdentificado")
            .HasMaxLength(120);

        b.Property(x => x.ContatoIdentificado)
            .HasColumnName("ContatoIdentificado")
            .HasMaxLength(160);

        b.HasOne(x => x.Categoria)
            .WithMany(c => c.Feedbacks)
            .HasForeignKey(x => x.CategoriaId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasMany(x => x.Respostas)
            .WithOne(r => r.Feedback)
            .HasForeignKey(r => r.FeedbackId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
