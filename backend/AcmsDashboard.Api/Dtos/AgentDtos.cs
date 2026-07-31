namespace AcmsDashboard.Api.Dtos;

public record AgentQueryRequest(string Question);

public record AgentAnswerDto(
    string Answer,
    string? GeneratedSql,   // shown in dev for transparency; hidden in production
    int RowCount,
    bool ChartSuggested,
    int ElapsedMs);