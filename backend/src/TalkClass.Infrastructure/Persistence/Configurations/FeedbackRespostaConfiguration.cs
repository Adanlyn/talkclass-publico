using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class FeedbackRespostaConfiguration : IEntityTypeConfiguration<FeedbackResposta>
{
    public void Configure(EntityTypeBuilder<FeedbackResposta> b)
    {
        // TABELA REAL no BD (minúsculo e com underscore)
        b.ToTable("feedback_respostas");

        b.HasKey(r => r.Id);

        // Suas colunas no BD estão em PascalCase (Id, FeedbackId, PerguntaId, Tipo, Valor*)
        // então NÃO force HasColumnName aqui — o default do EF já gera "FeedbackId", "PerguntaId", etc.,
        // que casam com o que o BD tem (vide seu print do information_schema).

        b.Property(r => r.Tipo).IsRequired();      // enum -> int já é tratado no seu contexto
        b.Property(r => r.ValorNota);
        b.Property(r => r.ValorBool);
        b.Property(r => r.ValorOpcao);
        b.Property(r => r.ValorTexto);

        b.HasOne(r => r.Feedback)
         .WithMany(f => f.Respostas)
         .HasForeignKey(r => r.FeedbackId)
         .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(r => r.Pergunta)
         .WithMany(p => p.Respostas)
         .HasForeignKey(r => r.PerguntaId)
         .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(r => r.FeedbackId);
        b.HasIndex(r => r.PerguntaId);
        b.HasIndex(r => r.Tipo);
    }
}
