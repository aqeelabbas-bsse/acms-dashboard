namespace AcmsDashboard.Api.Dtos;

/// <summary>Row shape for GET /v1/personal-rfid.</summary>
public record PersonalRfidDto(
    int RegId,
    string? Cnic,
    string? HolderName,
    string? Designation,
    string? SmartCardNo,
    bool IsActive,
    bool IsDeactive,
    bool IsBlocked,
    string? BlockReason,
    int FullAccess,
    DateTime? ActivationDate,
    DateTime? DeactiveDate,
    DateTime? ActionDate,
    int? CardStatus,
    int? ExportStatus);

/// <summary>Body for PATCH /v1/personal-rfid/{regId}/block.</summary>
public record BlockPersonalCardRequest(string Category, string Reason);

/// <summary>Body for PATCH /v1/personal-rfid/{regId}/reactivate.</summary>
public record ReactivatePersonalCardRequest(string Reason);

/// <summary>
/// The fixed vocabulary of block reasons.
///
/// Design note (decided in the absence of a schema change): neither
/// PersonalRFID nor VisitorsRFID has a dedicated reason column, and adding one
/// needs supervisor sign-off under Database Design Document Sec. 5. Rather than
/// block on that, the category is written into the existing Remarks column
/// behind a machine-readable marker:
///
///     [BLOCK:SecurityIncident] Tailgating at Gate B — 2026-08-07 by admin
///
/// That keeps the free text a human can read while still making
/// "blocked cards, drilled down reason-wise" answerable with a LIKE scan today.
/// If a coded column is approved later, the parser below is the only thing that
/// changes — no data migration is needed because the marker is already there.
/// </summary>
public static class BlockReasons
{
    public const string Marker = "[BLOCK:";

    public static readonly IReadOnlyList<string> All = new[]
    {
        "LostOrStolen",
        "SecurityIncident",
        "EmploymentEnded",
        "Expired",
        "Damaged",
        "PolicyViolation",
        "Other"
    };

    /// <summary>Human-facing labels for the same codes, used by the UI legend.</summary>
    public static readonly IReadOnlyDictionary<string, string> Labels =
        new Dictionary<string, string>
        {
            ["LostOrStolen"]     = "Lost or stolen",
            ["SecurityIncident"] = "Security incident",
            ["EmploymentEnded"]  = "Employment ended",
            ["Expired"]          = "Expired",
            ["Damaged"]          = "Damaged",
            ["PolicyViolation"]  = "Policy violation",
            ["Other"]            = "Other",
            ["Unspecified"]      = "Unspecified"
        };

    public static bool IsValid(string? category) =>
        category is not null && All.Contains(category);

    /// <summary>Builds the Remarks value written on block.</summary>
    public static string Compose(string category, string reason, string? user) =>
        $"{Marker}{category}] {reason} — {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC by {user ?? "system"}";

    /// <summary>
    /// Reads the category back out of a Remarks string.
    /// Returns "Unspecified" for rows blocked before this convention existed,
    /// so historical data still groups into a real bucket rather than vanishing
    /// from the drill-down.
    /// </summary>
    public static string Parse(string? remarks)
    {
        if (string.IsNullOrWhiteSpace(remarks)) return "Unspecified";

        var start = remarks.IndexOf(Marker, StringComparison.Ordinal);
        if (start < 0) return "Unspecified";

        start += Marker.Length;
        var end = remarks.IndexOf(']', start);
        if (end < 0) return "Unspecified";

        var code = remarks[start..end].Trim();
        return IsValid(code) ? code : "Unspecified";
    }
}