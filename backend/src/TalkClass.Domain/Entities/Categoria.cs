namespace TalkClass.Domain.Entities;

public class Categoria
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = null!;
    public string? Descricao { get; set; }
    public int Ordem { get; set; }
    public bool Ativa { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public ICollection<Pergunta> Perguntas { get; set; } = new List<Pergunta>();
    public ICollection<Feedback> Feedbacks { get; set; } = new List<Feedback>();

}
