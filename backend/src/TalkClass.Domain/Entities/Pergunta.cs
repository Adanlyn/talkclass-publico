using TalkClass.Domain.ValueObjects;

namespace TalkClass.Domain.Entities;

public class Pergunta
{
    public Guid Id { get; set; }

    public Guid CategoriaId { get; set; }
    public Categoria Categoria { get; set; } = null!;

    public string Enunciado { get; set; } = null!;
    public TipoAvaliacao Tipo { get; set; }          // Nota | SimNao | Multipla | Texto
    public bool Obrigatoria { get; set; } = true;
    public int Ordem { get; set; }
    public bool Ativa { get; set; } = true;

    public ICollection<PerguntaOpcao> Opcoes { get; set; } = new List<PerguntaOpcao>();
    public ICollection<FeedbackResposta> Respostas { get; set; } = new List<FeedbackResposta>();
}
