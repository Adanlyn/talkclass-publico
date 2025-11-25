using TalkClass.Domain.ValueObjects;

namespace TalkClass.Domain.Entities;

public class FeedbackResposta
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FeedbackId { get; set; }
    public Guid PerguntaId { get; set; }
    public TipoAvaliacao Tipo { get; set; }

    // Preencha apenas UM conforme o Tipo
    public int? ValorNota { get; set; }       // Nota
    public bool? ValorBool { get; set; }      // Sim/Não
    public string? ValorOpcao { get; set; }   // Frequência (ou múltipla)
    public string? ValorTexto { get; set; }   // Texto aberto
    public Feedback Feedback { get; set; } = default!;
    public Pergunta Pergunta { get; set; } = default!;
}
