using System.Text.Json.Serialization;

namespace TalkClass.API.Dtos;

public sealed class AiTextDto
{
    public string Id { get; set; } = "";
    public string Text { get; set; } = "";
    public string Week { get; set; } = "";
    public Guid? CategoryId { get; set; }
}

public sealed class AiHeatItemDto
{
    public string Week { get; set; } = "";
    public string Keyword { get; set; } = "";
    public int Total { get; set; }
    public double Score { get; set; }
    public Guid? CategoryId { get; set; }
}

public sealed class AiKeywordResponseDto
{
    public List<AiHeatItemDto> Pos { get; set; } = new();
    public List<AiHeatItemDto> Neg { get; set; } = new();
}

public sealed class AiAssistantRequestDto
{
    public string Question { get; set; } = "";
    public AiAssistantContextDto Context { get; set; } = new();
}

public sealed class AiAssistantContextDto
{
    public Dictionary<string, string?> Filters { get; set; } = new();
    public AiKpiDto Kpis { get; set; } = new();
    public List<SeriesPointDto> Series { get; set; } = new();
    public List<VolumePointDto> Volume { get; set; } = new();
    public List<TopicsPolarityRowDto> Topics { get; set; } = new();
    public List<AiHeatItemDto> WordsNeg { get; set; } = new();
    public List<AiHeatItemDto> WordsPos { get; set; } = new();
    public List<AiWorstQuestionDto> WorstQuestions { get; set; } = new();
}

public sealed class AiKpiDto
{
    public int? Nps { get; set; }
    public int? TotalFeedbacks { get; set; }
    public int? AreasComAlerta { get; set; }
    public int? TotalAreas { get; set; }
}

public sealed class SeriesPointDto
{
    public string Bucket { get; set; } = "";
    public double? Avg { get; set; }
    public int Count { get; set; }
}

public sealed class VolumePointDto
{
    public string Bucket { get; set; } = "";
    public int Total { get; set; }
}

public sealed class TopicsPolarityRowDto
{
    public string Topic { get; set; } = "";
    public double Neg { get; set; }
    public double Neu { get; set; }
    public double Pos { get; set; }
    public double Pneg { get; set; }
}

public sealed class AiAssistantResponseDto
{
    public string Answer { get; set; } = "";
    public List<string> Highlights { get; set; } = new();
    public List<string> Suggestions { get; set; } = new();
    public Dictionary<string, string?> Filters { get; set; } = new();
}

public sealed class AiWorstQuestionDto
{
    public string Question { get; set; } = "";
    public double Avg { get; set; }
    public int Total { get; set; }
}
