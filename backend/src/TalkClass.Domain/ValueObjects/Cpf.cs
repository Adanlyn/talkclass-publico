using System.Linq;

namespace TalkClass.Domain.ValueObjects;

public readonly struct Cpf : IEquatable<Cpf>
{
    public string Value { get; }

    public Cpf(string value)
    {
        var digits = Normalize(value);
        if (!IsValidDigits(digits)) throw new ArgumentException("CPF invalido.", nameof(value));
        Value = digits;
    }

    private Cpf(string digits, bool _)
    {
        Value = digits;
    }

    public static bool TryParse(string? value, out Cpf cpf)
    {
        var digits = Normalize(value);
        if (!IsValidDigits(digits))
        {
            cpf = default;
            return false;
        }

        cpf = new Cpf(digits, true);
        return true;
    }

    public static bool IsValid(string? value) => IsValidDigits(Normalize(value));

    private static string Normalize(string? value) =>
        new string((value ?? string.Empty).Where(char.IsDigit).ToArray());

    private static bool IsValidDigits(string digits)
    {
        if (digits.Length != 11) return false;
        if (digits.All(d => d == digits[0])) return false;

        var first = CalculateDigit(digits, 9);
        if ((digits[9] - '0') != first) return false;

        var second = CalculateDigit(digits, 10);
        return (digits[10] - '0') == second;
    }

    private static int CalculateDigit(string digits, int length)
    {
        var sum = 0;
        for (var i = 0; i < length; i++)
        {
            sum += (digits[i] - '0') * (length + 1 - i);
        }

        var mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
    }

    public bool Equals(Cpf other) => Value == other.Value;
    public override bool Equals(object? obj) => obj is Cpf other && Equals(other);
    public override int GetHashCode() => Value.GetHashCode();
    public static bool operator ==(Cpf left, Cpf right) => left.Equals(right);
    public static bool operator !=(Cpf left, Cpf right) => !left.Equals(right);

    public override string ToString() => Value;
}
