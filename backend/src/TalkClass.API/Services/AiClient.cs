using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using TalkClass.API.Dtos;

namespace TalkClass.API.Services;

public sealed class AiServiceOptions
{
    public string BaseUrl { get; set; } = "http://ai:8000";
    // Aumenta o timeout padrão para dar tempo ao processamento de keywords/summaries.
    public int TimeoutSeconds { get; set; } = 60;
}

public class AiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AiClient> _logger;

    public AiClient(HttpClient http, IOptions<AiServiceOptions> options, ILogger<AiClient> logger)
    {
        _http = http;
        _logger = logger;

        var baseUrl = options.Value.BaseUrl?.TrimEnd('/') ?? "http://ai:8000";
        _http.BaseAddress = new Uri(baseUrl + "/");
        if (options.Value.TimeoutSeconds > 0)
            _http.Timeout = TimeSpan.FromSeconds(options.Value.TimeoutSeconds);
    }

    public async Task<AiKeywordResponseDto> ExtractKeywordsAsync(IEnumerable<AiTextDto> texts, int top, CancellationToken ct)
    {
        var payload = new
        {
            texts = texts,
            top,
            min_freq = 1
        };

        try
        {
            var resp = await _http.PostAsJsonAsync("keywords", payload, cancellationToken: ct);
            resp.EnsureSuccessStatusCode();
            var data = await resp.Content.ReadFromJsonAsync<AiKeywordResponseDto>(cancellationToken: ct);
            return data ?? new AiKeywordResponseDto();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao consultar o service de IA para keywords/heatmap");
            return new AiKeywordResponseDto();
        }
    }

    public async Task<AiAssistantResponseDto?> AskAssistantAsync(AiAssistantRequestDto dto, CancellationToken ct)
    {
        try
        {
            var resp = await _http.PostAsJsonAsync("assistant", dto, cancellationToken: ct);
            resp.EnsureSuccessStatusCode();
            return await resp.Content.ReadFromJsonAsync<AiAssistantResponseDto>(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao consultar o service de IA para assistant/chatbot");
            return null;
        }
    }
}
