using System;

namespace TalkClass.Domain.Entities;

public class AlertNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = default!;
    public string Message { get; set; } = default!;
    public string Severity { get; set; } = "info"; // info, warning, error
    public Guid? FeedbackId { get; set; }
    public bool Read { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
