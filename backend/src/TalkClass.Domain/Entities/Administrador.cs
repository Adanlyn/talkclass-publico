using TalkClass.Domain.ValueObjects;

namespace TalkClass.Domain.Entities;

public class Administrador
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = default!;
    public string? Email { get; set; }
    public Cpf Cpf { get; set; } = default!;
    public string SenhaHash { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public string Roles { get; set; } = "Admin";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool MustChangePassword { get; set; } = false;
}
