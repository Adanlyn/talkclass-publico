using System;
using System.Collections.Generic;

namespace TalkClass.Domain.Entities;

public class AlertEmailConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public List<Guid> AdminRecipientIds { get; set; } = new();
    public string ExtraEmails { get; set; } = string.Empty;
    public string SendMode { get; set; } = "immediate";
    public string CriticalKeywords { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
