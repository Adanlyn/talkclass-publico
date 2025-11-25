using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalkClass.Domain.Entities;

namespace TalkClass.Infrastructure.Persistence.Configurations;

public class AlertNotificationConfiguration : IEntityTypeConfiguration<AlertNotification>
{
    public void Configure(EntityTypeBuilder<AlertNotification> b)
    {
        b.ToTable("alert_notifications");
        b.HasKey(x => x.Id);

        b.Property(x => x.Title)
            .IsRequired()
            .HasMaxLength(160);

        b.Property(x => x.Message)
            .IsRequired()
            .HasMaxLength(600);

        b.Property(x => x.Severity)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("info");

        b.Property(x => x.FeedbackId);

        b.Property(x => x.Read)
            .HasDefaultValue(false);

        b.Property(x => x.CreatedAt)
            .IsRequired();

        b.HasIndex(x => x.Read);
        b.HasIndex(x => x.FeedbackId);
        b.HasIndex(x => x.CreatedAt);
    }
}
