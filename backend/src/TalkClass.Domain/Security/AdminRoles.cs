using System;
using System.Linq;

namespace TalkClass.Domain.Security;

public static class AdminRoles
{
    public const string Master = "Master";
    public const string Admin = "Admin";

    public static readonly string[] All = new[] { Master, Admin };

    public static bool IsValid(string? role) =>
        !string.IsNullOrWhiteSpace(role) &&
        All.Any(r => string.Equals(r, role, StringComparison.OrdinalIgnoreCase));

    public static string Normalize(string? role)
    {
        if (string.Equals(role, Master, StringComparison.OrdinalIgnoreCase)) return Master;
        if (string.Equals(role, Admin, StringComparison.OrdinalIgnoreCase)) return Admin;
        return Admin;
    }
}
