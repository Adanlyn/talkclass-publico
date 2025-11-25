namespace TalkClass.Domain.Entities;

public class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AdministradorId { get; set; }
    public Administrador Administrador { get; set; } = default!;
    public string TokenHash { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }

    public bool IsExpired(DateTime referenceUtc) => referenceUtc >= ExpiresAt;
    public bool IsRedeemed => UsedAt.HasValue;
}
