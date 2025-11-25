using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class AlertEmailConfigConfiguration : IEntityTypeConfiguration<AlertEmailConfig>
{
    public void Configure(EntityTypeBuilder<AlertEmailConfig> b)
    {
        b.ToTable("alert_email_config");
        b.HasKey(x => x.Id);

        b.Property(x => x.AdminRecipientIds)
            .HasColumnType("uuid[]")
            .IsRequired();

        b.Property(x => x.ExtraEmails)
            .HasMaxLength(600)
            .HasDefaultValue(string.Empty);

        b.Property(x => x.SendMode)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("immediate");

        b.Property(x => x.CriticalKeywords)
            .HasMaxLength(1000)
            .HasDefaultValue(string.Empty);

        b.Property(x => x.UpdatedAt).IsRequired();
    }
}
