namespace TalkClass.Domain.Entities;

public class PerguntaOpcao
{
    public Guid Id { get; set; }

    public Guid PerguntaId { get; set; }
    public Pergunta Pergunta { get; set; } = null!;

    public string Texto { get; set; } = null!;
    public int Valor { get; set; }
}
