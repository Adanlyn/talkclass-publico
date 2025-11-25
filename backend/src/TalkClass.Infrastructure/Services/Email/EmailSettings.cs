namespace TalkClass.Infrastructure.Services.Email;

public class EmailSettings
{
    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string? UserName { get; set; }
    public string? Password { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(FromAddress) &&
        !string.IsNullOrWhiteSpace(Host);
}
