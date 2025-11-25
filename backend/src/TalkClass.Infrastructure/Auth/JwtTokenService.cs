using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Domain.Entities;
using TalkClass.Domain.Security;

namespace TalkClass.Infrastructure.Auth;

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtSettings _settings;

    public JwtTokenService(IOptions<JwtSettings> options)
    {
        _settings = options.Value;
    }

    public (string token, DateTime expiresAtUtc) CreateToken(Administrador admin)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_settings.ExpiresMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, admin.Id.ToString()),
            new(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new("cpf", admin.Cpf.Value),
            new(ClaimTypes.Name, admin.Nome),
        };

        if (!string.IsNullOrWhiteSpace(admin.Email))
        {
            claims.Add(new Claim(ClaimTypes.Email, admin.Email));
        }
        claims.Add(new Claim("must_change_password", admin.MustChangePassword ? "true" : "false"));

        var normalizedRoles = (admin.Roles ?? AdminRoles.Admin)
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(r => AdminRoles.Normalize(r.Trim()))
            .DefaultIfEmpty(AdminRoles.Admin)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var role in normalizedRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        return (jwt, expires);
    }
}
