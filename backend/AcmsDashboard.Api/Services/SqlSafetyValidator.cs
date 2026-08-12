using System.Text;
using System.Text.RegularExpressions;

namespace AcmsDashboard.Api.Services;

/// <param name="Retryable">
/// True when the rejection is a SHAPE problem the model could plausibly fix if
/// asked again (prose around the SQL, an unknown alias, SELECT *). False when
/// it is a genuine security stop (a write keyword, a denied column, a system
/// object) — those are logged loudly and never retried, because retrying an
/// attempted write is not a user-experience problem to smooth over.
/// </param>
public record SqlValidationResult(
    bool IsValid,
    string? Reason,
    string? CleanedSql,
    bool Retryable = false);

/// <summary>
/// Defence-in-depth layer 2. Layer 1 is the SELECT-only SQL login with column
/// DENYs — that is the real security boundary. This class exists to reject bad
/// queries early with a clear message, not to be the last line of defence.
/// Never weaken the SQL permissions on the assumption that this is sufficient.
///
/// ── Why this was rewritten ───────────────────────────────────────────────
/// The previous version refused a large share of perfectly ordinary questions,
/// which is why only the canned suggestion chips appeared to work. Four causes,
/// all cosmetic rather than security-relevant:
///
///  1. It required the response to START with SELECT. Models routinely prefix
///     an answer with "Here is the query:" or wrap it in a fence mid-string,
///     and Ollama does this far more than Gemini. Perfectly good SQL was
///     rejected for the sentence in front of it.
///  2. It rejected anything containing a semicolon. A single trailing
///     semicolon, or SQL followed by an explanatory sentence, tripped it.
///  3. It rejected CTEs outright — a WITH clause does not start with SELECT,
///     and the CTE's own name then failed the allow-list check because it is
///     not a real table. CTEs are exactly what a model reaches for on
///     "conversion rate" and "busiest day" style questions.
///  4. It rejected any SELECT *, including inside EXISTS(...), where no
///     columns are returned at all and the sensitive-column concern does not
///     apply.
///
/// The security checks themselves are unchanged and, in two places, tightened.
/// What changed is that the validator now extracts and normalises the statement
/// before judging it, instead of judging the raw model output.
/// </summary>
public class SqlSafetyValidator
{
    // Only these tables may be referenced. AspNetUsers is deliberately absent —
    // it holds password hashes and must never be reachable by the agent.
    private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "PersonalSmartCard", "CardRequestProcess", "VisitorInfo",
        "VisitorsRFID", "PersonalVisitorRFID", "PersonalRFID",
        "DailyCardStats", "VisitorTrafficDaily", "CardFunnelStats",
    };

    private static readonly Regex WriteKeywords = new(
        @"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|SHUTDOWN|RECONFIGURE|OPENROWSET|OPENQUERY|OPENDATASOURCE|BULK)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // SELECT ... INTO creates a table — a write disguised as a read.
    private static readonly Regex SelectInto = new(
        @"\bINTO\s+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveColumns = new(
        @"\b(CNICBlob|FIRBlob|PoliceVerificationBlob|AttachmentBlob|FPEnroll|Picture|QRCode|PresentAddress|PermanentAddress|PasswordHash|SecurityStamp|ConcurrencyStamp)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SystemObjects = new(
        @"\b(sys\.|information_schema|xp_|sp_|master\.|msdb\.|tempdb\.|AspNet\w*)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex TableRefs = new(
        @"\b(?:FROM|JOIN)\s+(?:\[?dbo\]?\s*\.\s*)?\[?([A-Za-z_][A-Za-z0-9_]*)\]?",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // SQL Server checks permission on EVERY column of a table when a query uses
// COUNT(*) against a login with column-level DENYs present — even though
// COUNT(*) never actually reads any column's data. This is what caused
// "SELECT COUNT(*) FROM PersonalSmartCard" to be rejected with a permission
// error naming Picture, FPEnroll, CNICBlob etc., while the semantically
// identical "SELECT COUNT(CNIC) FROM PersonalSmartCard" succeeded.
//
// Rather than hope the model remembers to avoid COUNT(*), rewrite it
// deterministically to COUNT(<primary key>) before validation completes.
private static readonly Regex CountStar = new(
    @"COUNT\s*\(\s*\*\s*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

private static readonly Dictionary<string, string> PrimaryKeyColumn =
    new(StringComparer.OrdinalIgnoreCase)
{
    ["PersonalSmartCard"] = "CNIC",
    ["CardRequestProcess"] = "CRID",
    ["VisitorInfo"] = "ID",
    ["VisitorsRFID"] = "SmartCardNo",
    ["PersonalVisitorRFID"] = "RegID",
    ["PersonalRFID"] = "RegID",
    ["DailyCardStats"] = "StatDate",
    ["VisitorTrafficDaily"] = "StatDate",
    ["CardFunnelStats"] = "StatDate",
};    

    // Names introduced by a WITH clause: "WITH x AS (" and ", y AS (".
    private static readonly Regex CteNames = new(
        @"(?:\bWITH\s+|,\s*)\[?([A-Za-z_][A-Za-z0-9_]*)\]?\s*(?:\([^)]*\)\s*)?AS\s*\(",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // SELECT * that is NOT the body of an EXISTS test.
    private static readonly Regex BareSelectStar = new(
        @"(?<!EXISTS\s{0,4}\(\s{0,4})\bSELECT\s+\*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
/// Replaces COUNT(*) with COUNT(&lt;primary key&gt;) for the common case of a
/// single-table query. Only rewrites when exactly one table is referenced —
/// for joins, guessing the wrong table's key is worse than leaving COUNT(*) to
/// fail loudly, and joined "how many" questions are rare for this agent.
/// </summary>
private static string RewriteCountStar(string sql)
{
    if (!CountStar.IsMatch(sql)) return sql;

    var tables = TableRefs.Matches(sql)
        .Select(m => m.Groups[1].Value)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

    if (tables.Count != 1) return sql;
    if (!PrimaryKeyColumn.TryGetValue(tables[0], out var pk)) return sql;

    return CountStar.Replace(sql, $"COUNT({pk})");
}    

    public SqlValidationResult Validate(string? rawSql)
    {
        if (string.IsNullOrWhiteSpace(rawSql))
            return Shape("The model returned nothing to run.");

        // ── 1. Normalise before judging ──
        var sql = StripFences(rawSql);
        sql = StripComments(sql);
        sql = ExtractStatement(sql);
        sql = TruncateAtStatementEnd(sql);
        sql = CollapseWhitespace(sql).Trim().TrimEnd(';', ' ');
        sql = RewriteCountStar(sql);

        if (sql.Length == 0)
        {
            return Shape(
                "No SQL query could be found in the model's reply. Try asking the "
                + "question more directly.");
        }

        // ── 2. Must be a single read ──
        if (!Regex.IsMatch(sql, @"^\s*(SELECT|WITH)\b", RegexOptions.IgnoreCase))
        {
            return Shape(
                "The model did not produce a readable query for that question. "
                + "Try rephrasing it, or ask about one thing at a time.");
        }

        // Anything after the first statement boundary was already cut above, so
        // a surviving semicolon means one appeared inside the statement itself.
        if (sql.Contains(';'))
            return Hard("Multiple SQL statements are not permitted.");

        // ── 3. Security stops — never retried ──
        var write = WriteKeywords.Match(sql);
        if (write.Success)
            return Hard($"Blocked keyword '{write.Value.ToUpperInvariant()}' detected. The assistant can only read data.");

        if (SelectInto.IsMatch(sql))
            return Hard("SELECT ... INTO is not permitted.");

        var sensitive = SensitiveColumns.Match(sql);
        if (sensitive.Success)
        {
            return Hard(
                $"'{sensitive.Value}' is a protected column (biometric, document or "
                + "address data) and cannot be read by the assistant.");
        }

        var sysObj = SystemObjects.Match(sql);
        if (sysObj.Success)
            return Hard($"Access to '{sysObj.Value}' is not permitted.");

        // ── 4. Shape checks — retryable ──
        if (BareSelectStar.IsMatch(sql))
        {
            return Shape(
                "The query selected every column rather than naming them. "
                + "Ask for the specific facts you want.");
        }

        var ctes = CteNames.Matches(sql)
            .Select(m => m.Groups[1].Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var referenced = TableRefs.Matches(sql)
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(t => !ctes.Contains(t))       // a CTE name is not a table
            .ToList();

        if (referenced.Count == 0)
        {
            return Shape(
                "The query did not reference any known table. Try naming what you "
                + "are asking about — employees, card requests, visitors, staff "
                + "cards or visitor passes.");
        }

        foreach (var table in referenced)
        {
            if (!AllowedTables.Contains(table))
            {
                return Shape(
                    $"'{table}' is not a table the assistant can read. It can see "
                    + "employees, card requests, visitors, visitor passes, staff RFID "
                    + "cards and the daily statistics tables.");
            }
        }

        if (sql.Length > 4000)
            return Shape("The generated query was unreasonably long. Try a simpler question.");

        return new SqlValidationResult(true, null, sql);
    }

    private static SqlValidationResult Shape(string reason) => new(false, reason, null, Retryable: true);
    private static SqlValidationResult Hard(string reason) => new(false, reason, null, Retryable: false);

    /* ══════════════════════════════════════════════════════ normalisation */

    /// <summary>Removes ``` fences wherever they appear, not only at the start.</summary>
    private static string StripFences(string raw)
    {
        var s = raw.Trim();
        s = Regex.Replace(s, @"```[a-zA-Z]*", " ", RegexOptions.Compiled);
        return s.Trim();
    }

    /// <summary>
    /// Strips -- line comments and block comments, skipping anything inside a
    /// string literal so a legitimate value like 'A--B' survives.
    ///
    /// The previous version REJECTED comments outright. Stripping is both safer
    /// and friendlier: the cleaned text is what gets validated AND what gets
    /// executed, so nothing can hide in a comment, and a model that adds a
    /// helpful "-- count of active cards" no longer causes a refusal.
    /// </summary>
    private static string StripComments(string sql)
    {
        var sb = new StringBuilder(sql.Length);
        var inString = false;

        for (var i = 0; i < sql.Length; i++)
        {
            var c = sql[i];

            if (inString)
            {
                sb.Append(c);
                if (c == '\'') inString = false;
                continue;
            }

            if (c == '\'') { inString = true; sb.Append(c); continue; }

            if (c == '-' && i + 1 < sql.Length && sql[i + 1] == '-')
            {
                while (i < sql.Length && sql[i] != '\n') i++;
                sb.Append(' ');
                continue;
            }

            if (c == '/' && i + 1 < sql.Length && sql[i + 1] == '*')
            {
                i += 2;
                while (i + 1 < sql.Length && !(sql[i] == '*' && sql[i + 1] == '/')) i++;
                i++;
                sb.Append(' ');
                continue;
            }

            sb.Append(c);
        }

        return sb.ToString();
    }

    /// <summary>
    /// Slices from the first SELECT or WITH keyword, discarding any preamble
    /// the model wrote in front of it. This is the single biggest source of
    /// false refusals — the SQL was fine, the sentence introducing it was not.
    /// </summary>
    private static string ExtractStatement(string sql)
    {
        var m = Regex.Match(sql, @"\b(SELECT|WITH)\b", RegexOptions.IgnoreCase);
        return m.Success ? sql[m.Index..] : sql;
    }

    /// <summary>
    /// Cuts at the first semicolon that is outside a string literal, so a
    /// trailing "; here's what it does..." is dropped rather than causing a
    /// "multiple statements" refusal. Only the surviving first statement is
    /// validated, and only it is executed.
    /// </summary>
    private static string TruncateAtStatementEnd(string sql)
    {
        var inString = false;

        for (var i = 0; i < sql.Length; i++)
        {
            if (sql[i] == '\'') { inString = !inString; continue; }
            if (sql[i] == ';' && !inString) return sql[..i];
        }

        return sql;
    }

    private static string CollapseWhitespace(string sql) =>
        Regex.Replace(sql, @"\s+", " ");
}