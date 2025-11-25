using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class CategoriaConfiguration : IEntityTypeConfiguration<Categoria>
{
    public void Configure(EntityTypeBuilder<Categoria> builder)
    {
        // 🔹 Nome da tabela exatamente como está no banco
        builder.ToTable("categorias");

        // 🔹 Chave primária
        builder.HasKey(c => c.Id);

        // 🔹 Propriedades principais
        builder.Property(c => c.Nome)
               .HasMaxLength(120)
               .IsRequired();

        builder.Property(c => c.Descricao)
               .HasMaxLength(500);

        builder.Property(c => c.Ordem)
               .HasDefaultValue(0);

        builder.Property(c => c.Ativa)
               .HasDefaultValue(true);

        builder.Property(c => c.CriadoEm);

        // 🔹 Relacionamento com Perguntas
        builder.HasMany(c => c.Perguntas)
               .WithOne(p => p.Categoria)
               .HasForeignKey(p => p.CategoriaId)
               .OnDelete(DeleteBehavior.Restrict);

        // 🔹 Relacionamento com Feedbacks
        builder.HasMany(c => c.Feedbacks)
               .WithOne(f => f.Categoria)
               .HasForeignKey(f => f.CategoriaId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
