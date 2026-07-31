using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AcmsDashboard.Api.Analytics;

[Table("DailyCardStats")]
public class DailyCardStat
{
    [Key] public DateOnly StatDate { get; set; }
    public int Submitted { get; set; }
    public int Verified { get; set; }
    public int Printed { get; set; }
    public double? AvgProcessingHours { get; set; }
    public DateTime GeneratedAt { get; set; }
}

[Table("VisitorTrafficDaily")]
public class VisitorTrafficDaily
{
    [Key] public DateOnly StatDate { get; set; }
    public int? GateId { get; set; }
    public int EntryCount { get; set; }
    public int ExitCount { get; set; }
    public int? PeakHour { get; set; }
    public DateTime GeneratedAt { get; set; }
}

[Table("CardFunnelStats")]
public class CardFunnelStat
{
    [Key] public DateOnly StatDate { get; set; }
    public int Submitted { get; set; }
    public int Verified { get; set; }
    public int Printed { get; set; }
    public double ConversionRate { get; set; }
    public string? BottleneckStage { get; set; }
    public DateTime GeneratedAt { get; set; }
}