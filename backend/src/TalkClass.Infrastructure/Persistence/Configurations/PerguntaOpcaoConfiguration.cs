using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class PerguntaOpcaoConfiguration : IEntityTypeConfiguration<PerguntaOpcao>
{
    public void Configure(EntityTypeBuilder<PerguntaOpcao> b)
    {
        b.ToTable("pergunta_opcoes");
        b.HasKey(x => x.Id);

        b.Property(x => x.Texto)
            .HasMaxLength(200)
            .IsRequired();

        b.HasOne(x => x.Pergunta)
            .WithMany(p => p.Opcoes)         // precisa existir ICollection<PerguntaOpcao> Opcoes em Pergunta
            .HasForeignKey(x => x.PerguntaId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.PerguntaId);
    }
}
