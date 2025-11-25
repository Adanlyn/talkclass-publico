using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TalkClass.Application.Common.Interfaces;

namespace TalkClass.Infrastructure.Services.Email;

public class SmtpEmailSender : IEmailSender
{
    private readonly EmailSettings _settings;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<EmailSettings> settings, ILogger<SmtpEmailSender> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        if (!_settings.IsConfigured)
        {
            _logger.LogWarning("EmailSettings are not configured. Email destined to {Recipient} with subject {Subject} was not sent. Body preview: {Body}",
                to, subject, body);
            return;
        }

        using var message = new MailMessage
        {
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };

        message.To.Add(new MailAddress(to));
        message.From = new MailAddress(
            _settings.FromAddress!,
            string.IsNullOrWhiteSpace(_settings.FromName) ? _settings.FromAddress : _settings.FromName);

        using var client = new SmtpClient(_settings.Host!, _settings.Port)
        {
            EnableSsl = _settings.EnableSsl
        };

        if (!string.IsNullOrWhiteSpace(_settings.UserName))
        {
            client.Credentials = new NetworkCredential(
                _settings.UserName,
                _settings.Password ?? string.Empty);
        }

        await client.SendMailAsync(message, ct);
    }
}
