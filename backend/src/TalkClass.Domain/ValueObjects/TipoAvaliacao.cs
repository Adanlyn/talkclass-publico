namespace TalkClass.Domain.ValueObjects
{
    public enum TipoAvaliacao
    {
        Nota = 0,      // escala 1..5 (Likert)
        SimNao = 1,    // pergunta binária
        Multipla = 2,  // múltipla escolha (opções)
        Texto = 3      // resposta aberta
    }
}
