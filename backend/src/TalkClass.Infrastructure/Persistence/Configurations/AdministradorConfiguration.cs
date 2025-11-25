using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class AdministradorConfiguration : IEntityTypeConfiguration<Administrador>
{
    public void Configure(EntityTypeBuilder<Administrador> b)
    {
        b.ToTable("administradores");
        b.HasKey(x => x.Id);

        b.Property(x => x.Nome).IsRequired().HasMaxLength(120);
        b.Property(x => x.Email).HasMaxLength(160);
        b.Property(x => x.SenhaHash).IsRequired().HasMaxLength(200);
        b.Property(x => x.Roles).IsRequired().HasMaxLength(100);
        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.MustChangePassword).IsRequired().HasDefaultValue(false);

        b.Property(x => x.Cpf).IsRequired().HasMaxLength(11);
        b.HasIndex(x => x.Cpf).IsUnique();
        b.HasIndex(x => x.IsActive);
    }
}
