using System.Text.RegularExpressions;

namespace AcmsDashboard.Api.Services;

public record SqlValidationResult(bool IsValid, string? Reason, string? CleanedSql);

/// <summary>
/// Defence-in-depth layer 2. Layer 1 is the SELECT-only SQL login with column
/// DENYs (Phase 7, Step 2) - that is the real boundary. This class exists to
/// reject obviously-bad queries early with a clear message, not to be the
/// last line of defence. Never weaken the SQL permissions on the assumption
/// that this validator is sufficient.
/// </summary>
public class SqlSafetyValidator
{
    // Only these tables may be referenced. AspNetUsers is deliberately absent -
    // it contains password hashes and must never be reachable by the agent.
    //
    // PersonalRFID added: staff/employee RFID access cards (distinct from
    // PersonalVisitorRFID, which tracks per-visit card assignments for VISITORS).
    // Missing from this set is what caused "which cards are blocked - personal
    // or visitor?" style questions to be rejected as unsafe, even though
    // PersonalRFID is a perfectly safe read table with no sensitive columns.
    private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "PersonalSmartCard", "CardRequestProcess", "VisitorInfo",
        "VisitorsRFID", "PersonalVisitorRFID", "PersonalRFID",
        "DailyCardStats", "VisitorTrafficDaily", "CardFunnelStats"
    };

    private static readonly Regex WriteKeywords = new(
        @"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|SHUTDOWN|RECONFIGURE|OPENROWSET|OPENQUERY|OPENDATASOURCE|BULK)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // SELECT ... INTO creates a table - a write disguised as a read.
    private static readonly Regex SelectInto = new(
        @"\bINTO\s+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveColumns = new(
        @"\b(CNICBlob|FIRBlob|PoliceVerificationBlob|AttachmentBlob|FPEnroll|Picture|QRCode|PresentAddress|PermanentAddress|PasswordHash|SecurityStamp|ConcurrencyStamp)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SystemObjects = new(
        @"\b(sys\.|information_schema|xp_|sp_|fn_|master\.|msdb\.|tempdb\.|AspNet\w*)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex TableRefs = new(
        @"\b(?:FROM|JOIN)\s+(?:\[?dbo\]?\s*\.\s*)?\[?([A-Za-z_][A-Za-z0-9_]*)\]?",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public SqlValidationResult Validate(string? rawSql)
    {
        if (string.IsNullOrWhiteSpace(rawSql))
            return new(false, "The model returned no SQL.", null);

        var sql = Clean(rawSql);

        if (sql.Length == 0)
            return new(false, "The model returned no usable SQL.", null);

        sql = sql.TrimEnd(';', ' ', '\n', '\r', '\t');
        if (sql.Contains(';'))
            return new(false, "Multiple SQL statements are not permitted.", null);

        if (sql.Contains("--") || sql.Contains("/*"))
            return new(false, "SQL comments are not permitted.", null);

        if (!Regex.IsMatch(sql, @"^\s*SELECT\b", RegexOptions.IgnoreCase))
            return new(false, "Only SELECT statements are permitted.", null);

        var write = WriteKeywords.Match(sql);
        if (write.Success)
            return new(false, $"Blocked keyword '{write.Value}' detected.", null);

        if (SelectInto.IsMatch(sql))
            return new(false, "SELECT ... INTO is not permitted.", null);

        var sensitive = SensitiveColumns.Match(sql);
        if (sensitive.Success)
            return new(false, $"Column '{sensitive.Value}' is not accessible.", null);

        var sysObj = SystemObjects.Match(sql);
        if (sysObj.Success)
            return new(false, $"Access to '{sysObj.Value}' is not permitted.", null);

        if (Regex.IsMatch(sql, @"SELECT\s+\*", RegexOptions.IgnoreCase))
            return new(false, "SELECT * is not permitted; name columns explicitly.", null);

        var referenced = TableRefs.Matches(sql)
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (referenced.Count == 0)
            return new(false, "No recognisable table reference found.", null);

        foreach (var table in referenced)
        {
            if (!AllowedTables.Contains(table))
                return new(false, $"Table '{table}' is not in the allowed set.", null);
        }

        if (sql.Length > 4000)
            return new(false, "Generated query is unreasonably long.", null);

        return new(true, null, sql);
    }

    private static string Clean(string raw)
    {
        var s = raw.Trim();
        s = Regex.Replace(s, @"^```(?:sql)?\s*", "", RegexOptions.IgnoreCase | RegexOptions.Multiline);
        s = Regex.Replace(s, @"```\s*$", "", RegexOptions.Multiline);
        return s.Trim();
    }
}