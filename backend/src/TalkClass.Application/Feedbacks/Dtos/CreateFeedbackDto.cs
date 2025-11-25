using System;
using System.Collections.Generic;
using TalkClass.Domain.ValueObjects; 

namespace TalkClass.Application.Feedbacks.Dtos
{
    public class CreateFeedbackDto
    {
        public Guid CategoriaId { get; set; }
        public string? CursoOuTurma { get; set; }
        public List<RespostaDto> Respostas { get; set; } = new();
    }

    public class RespostaDto
    {
        public Guid PerguntaId { get; set; }
        public TipoAvaliacao Tipo { get; set; }

        public int? ValorNota { get; set; }
        public bool? ValorBool { get; set; }
        public string? ValorOpcao { get; set; }
        public string? ValorTexto { get; set; }
    }
}
