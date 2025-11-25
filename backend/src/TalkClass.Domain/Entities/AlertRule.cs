using System;

namespace TalkClass.Domain.Entities;

public class AlertRule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = default!;
    public Guid? CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }
    public decimal NotaMinima { get; set; }
    public int PeriodoDias { get; set; }
    public bool EnviarEmail { get; set; } = true;
    public bool Ativa { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
