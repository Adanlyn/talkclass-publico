using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace TalkClass.Infrastructure.Auth;

public class JwtSettings
{
    public string Issuer { get; set; } = default!;
    public string Audience { get; set; } = default!;
    public string Key { get; set; } = default!;
    public int ExpiresMinutes { get; set; } = 60;

    public TokenValidationParameters ToValidationParameters() => new()
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,
        ValidIssuer = Issuer,
        ValidAudience = Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
        ClockSkew = TimeSpan.FromSeconds(5)
    };
}
