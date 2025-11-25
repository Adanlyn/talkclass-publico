using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class PerguntaConfiguration : IEntityTypeConfiguration<Pergunta>
{
    public void Configure(EntityTypeBuilder<Pergunta> b)
    {
        b.ToTable("perguntas");
        b.HasKey(x => x.Id);

        b.Property(x => x.Enunciado).IsRequired().HasMaxLength(500);
        b.Property(x => x.Tipo).HasConversion<int>().IsRequired(); // enum -> int
        b.Property(x => x.Obrigatoria).HasDefaultValue(true);
        b.Property(x => x.Ativa).HasDefaultValue(true);
        b.Property(x => x.Ordem).HasDefaultValue(0);

        b.HasOne(x => x.Categoria)
            .WithMany(c => c.Perguntas) // se tiver ICollection<Pergunta> em Categoria, troque para WithMany(c => c.Perguntas)
            .HasForeignKey(x => x.CategoriaId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(x => new { x.CategoriaId, x.Ativa });
        b.HasIndex(x => x.Tipo);
        b.HasIndex(x => x.Ordem);
    }
}
