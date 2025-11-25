namespace TalkClass.API.Dtos;

public sealed class WordHeatRow
{
    public DateTime Week { get; set; }          // week::date AS "Week"
    public Guid? CategoryId { get; set; }       // category_id AS "CategoryId"
    public string Word { get; set; } = "";      // word AS "Word"
    public int Total { get; set; }              // total AS "Total"
    public int Rk { get; set; }                 // rk AS "Rk"
}
