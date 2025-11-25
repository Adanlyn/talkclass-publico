using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> b)
    {
        b.ToTable("password_reset_tokens");
        b.HasKey(x => x.Id);

        b.Property(x => x.TokenHash)
            .IsRequired()
            .HasMaxLength(128);

        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.ExpiresAt).IsRequired();

        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.AdministradorId, x.ExpiresAt });

        b.HasOne(x => x.Administrador)
            .WithMany()
            .HasForeignKey(x => x.AdministradorId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
