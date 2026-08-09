using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Lookups;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Services;

/// <summary>
/// Builds the summary breakdown and searchable grid for each of the five
/// drill-down KPIs. Split out of the controller because each kind reads a
/// different table/predicate — that logic belongs in a service, the
/// controller's job is just routing and shaping the HTTP response.
///
/// Rows are pulled with `ToListAsync()` and then grouped/bucketed in memory
/// rather than in SQL. Two of the five groupings (CardCat/OPICode label
/// lookup, and the pending-request age buckets) depend on C# logic — a
/// dictionary lookup and a date-difference bucket rule — that EF Core cannot
/// translate into SQL. At this project's row counts (dozens to low
/// hundreds per table) that is a non-issue; if ACMS ever needs this over a
/// genuinely large table, the age-bucket and label logic would need to move
/// into T-SQL (a CASE expression) or a computed column.
/// </summary>
public class DrilldownQueryService
{
    private readonly AcmsDbContext _db;

    public DrilldownQueryService(AcmsDbContext db) => _db = db;

    /* ------------------------------------------------------------ summary */

    public async Task<DrilldownSummaryDto> SummaryAsync(
        DrilldownKind kind, DrilldownDimension dimension, CancellationToken ct)
    {
        return kind switch
        {
            DrilldownKind.ActiveCards    => await ActiveCardsSummaryAsync(dimension, ct),
            DrilldownKind.BlockedCards   => await BlockedCardsSummaryAsync(ct),
            DrilldownKind.PendingPrinting=> await AgeBucketSummaryAsync(printing: true, ct),
            DrilldownKind.PendingApproval=> await AgeBucketSummaryAsync(printing: false, ct),
            DrilldownKind.VisitorsToday  => await VisitorsTodaySummaryAsync(ct),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };
    }

    private async Task<DrilldownSummaryDto> ActiveCardsSummaryAsync(
        DrilldownDimension dimension, CancellationToken ct)
    {
        // Req 1 explicitly names tables ① PersonalSmartCard + ③ PersonalRFID.
        // "Active" is defined on the card record, not the employee profile -
        // an employee can be IsActiveFlag=true with a card that has since been
        // reissued/deactivated, and vice-versa on transfer.
        var query =
            from card in _db.PersonalRfids.AsNoTracking()
            where card.IsActive == true
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on card.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new { card, emp };

        var rows = await query.ToListAsync(ct);

        var breakdown = dimension == DrilldownDimension.Opicode
            ? rows.GroupBy(r => r.emp != null ? r.emp.Opicode : null)
                  .Select(g => new BreakdownItemDto(
                      g.Key?.ToString() ?? "none",
                      CardCodeLookup.LabelOpicode(g.Key),
                      g.Count()))
                  .OrderByDescending(b => b.Count)
                  .ToList()
            : rows.GroupBy(r => r.emp != null ? r.emp.CardCat : null)
                  .Select(g => new BreakdownItemDto(
                      g.Key?.ToString() ?? "none",
                      CardCodeLookup.LabelCardCat(g.Key),
                      g.Count()))
                  .OrderByDescending(b => b.Count)
                  .ToList();

        return new DrilldownSummaryDto(
            DrilldownKind.ActiveCards, rows.Count, breakdown, SupportsDimensionToggle: true);
    }

    private async Task<DrilldownSummaryDto> BlockedCardsSummaryAsync(CancellationToken ct)
    {
        // Req 2, same table pair. "Blocked" reuses the exact predicate from
        // PersonalRfidController so the two screens can never disagree on
        // what counts as blocked.
        var blocked = await _db.PersonalRfids.AsNoTracking()
            .Where(c => c.IsDeactive == true
                     && c.Remarks != null
                     && c.Remarks.Contains(BlockReasons.Marker))
            .Select(c => c.Remarks)
            .ToListAsync(ct);

        var breakdown = blocked
            .Select(BlockReasons.Parse)
            .GroupBy(code => code)
            .Select(g => new BreakdownItemDto(g.Key, BlockReasons.Labels[g.Key], g.Count()))
            .OrderByDescending(b => b.Count)
            .ToList();

        return new DrilldownSummaryDto(
            DrilldownKind.BlockedCards, blocked.Count, breakdown, SupportsDimensionToggle: false);
    }

    /// <summary>
    /// Reqs 4 &amp; 5. CardRequestProcess has no categorical field to break down
    /// by, so this buckets by how long each request has been waiting instead -
    /// a genuinely more useful operational view than a flat count, and the
    /// natural analogue of "category-wise" for a workflow table.
    /// </summary>
    private async Task<DrilldownSummaryDto> AgeBucketSummaryAsync(bool printing, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var query = printing
            // Pending printing: verified, not yet printed. Age measured from verification.
            ? _db.CardRequestProcesses.AsNoTracking()
                .Where(r => r.IsVerified == true && r.IsPrinted != true)
                .Select(r => r.MarkedOn ?? r.ProcessDate)
            // Pending approval: not yet verified. Age measured from submission.
            : _db.CardRequestProcesses.AsNoTracking()
                .Where(r => r.IsVerified != true)
                .Select(r => r.ProcessDate);

        var dates = await query.ToListAsync(ct);

        var breakdown = dates
            .Select(d => AgeBucket(d, now))
            .GroupBy(b => b)
            .Select(g => new BreakdownItemDto(g.Key, g.Key, g.Count()))
            .OrderBy(b => AgeBucketOrder(b.Code))
            .ToList();

        var kind = printing ? DrilldownKind.PendingPrinting : DrilldownKind.PendingApproval;
        return new DrilldownSummaryDto(kind, dates.Count, breakdown, SupportsDimensionToggle: false);
    }

    private async Task<DrilldownSummaryDto> VisitorsTodaySummaryAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        // Req 6 names table ⑥ (PersonalVisitorRFID) but that table has no
        // entry-date field - VisitorInfo.EntryDate is what "today" filters on.
        // "Department-wise" has no literal Department column on VisitorInfo;
        // CompanyName is the closest analogue for a visitor (they don't belong
        // to a NASTP department, they belong to a visiting company), so that
        // is the grouping field here. Flagged for supervisor confirmation.
        var visitors = await _db.VisitorInfos.AsNoTracking()
            .Where(v => v.EntryDate != null && v.EntryDate.Value.Date == today)
            .Select(v => v.CompanyName)
            .ToListAsync(ct);

        var breakdown = visitors
            .GroupBy(c => string.IsNullOrWhiteSpace(c) ? "Unspecified" : c!.Trim())
            .Select(g => new BreakdownItemDto(g.Key, g.Key, g.Count()))
            .OrderByDescending(b => b.Count)
            .ToList();

        return new DrilldownSummaryDto(
            DrilldownKind.VisitorsToday, visitors.Count, breakdown, SupportsDimensionToggle: false);
    }

    /* --------------------------------------------------------------- rows */

    public async Task<(IReadOnlyList<DrilldownRowDto> Rows, int Total)> RowsAsync(
        DrilldownKind kind, DrilldownDimension dimension, string? category, string? search,
        int page, int limit, CancellationToken ct)
    {
        page = Math.Max(page, 1);
        limit = Math.Clamp(limit, 1, 200);

        var all = kind switch
        {
            DrilldownKind.ActiveCards     => await ActiveCardRowsAsync(dimension, ct),
            DrilldownKind.BlockedCards    => await BlockedCardRowsAsync(ct),
            DrilldownKind.PendingPrinting => await PendingRowsAsync(printing: true, ct),
            DrilldownKind.PendingApproval => await PendingRowsAsync(printing: false, ct),
            DrilldownKind.VisitorsToday   => await VisitorTodayRowsAsync(ct),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };

        IEnumerable<DrilldownRowDto> filtered = all;

        if (!string.IsNullOrWhiteSpace(category) && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            filtered = filtered.Where(r =>
                string.Equals(CategoryKeyOf(r, kind), category, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            filtered = filtered.Where(r =>
                (r.Primary?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (r.Secondary?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false));
        }

        var list = filtered.ToList();
        var total = list.Count;
        var page_ = list.OrderByDescending(r => r.Date).Skip((page - 1) * limit).Take(limit).ToList();

        return (page_, total);
    }

    // The row DTO doesn't carry the raw category CODE (only the display
    // label), so filtering-by-code needs the same derivation used when the
    // row was built. Re-deriving from CategoryLabel would break the moment a
    // label is edited in CardCodeLookup, so each branch stashes the raw code
    // in `Note` as `code:<value>` purely for this lookup - never rendered.
    private static string? CategoryKeyOf(DrilldownRowDto r, DrilldownKind kind) =>
        r.Note?.StartsWith("code:", StringComparison.Ordinal) == true
            ? r.Note["code:".Length..]
            : r.CategoryLabel;

    private async Task<List<DrilldownRowDto>> ActiveCardRowsAsync(DrilldownDimension dimension, CancellationToken ct)
    {
        var query =
            from card in _db.PersonalRfids.AsNoTracking()
            where card.IsActive == true
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on card.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new { card, emp };

        var rows = await query.ToListAsync(ct);

        return rows.Select(r =>
        {
            var code = dimension == DrilldownDimension.Opicode
                ? r.emp?.Opicode : r.emp?.CardCat;
            var label = dimension == DrilldownDimension.Opicode
                ? CardCodeLookup.LabelOpicode(r.emp?.Opicode)
                : CardCodeLookup.LabelCardCat(r.emp?.CardCat);

            return new DrilldownRowDto(
                r.card.RegId.ToString(),
                r.emp?.Name ?? "Unknown holder",
                r.card.Cnic,
                label,
                "Active", "success",
                r.card.ActivationDate,
                $"code:{code?.ToString() ?? "none"}");
        }).ToList();
    }

    private async Task<List<DrilldownRowDto>> BlockedCardRowsAsync(CancellationToken ct)
    {
        var query =
            from card in _db.PersonalRfids.AsNoTracking()
            where card.IsDeactive == true
               && card.Remarks != null
               && card.Remarks.Contains(BlockReasons.Marker)
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on card.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new { card, emp };

        var rows = await query.ToListAsync(ct);

        return rows.Select(r =>
        {
            var code = BlockReasons.Parse(r.card.Remarks);
            return new DrilldownRowDto(
                r.card.RegId.ToString(),
                r.emp?.Name ?? "Unknown holder",
                r.card.Cnic,
                BlockReasons.Labels[code],
                "Blocked", "danger",
                r.card.DeactiveDate,
                $"code:{code}");
        }).ToList();
    }

    private async Task<List<DrilldownRowDto>> PendingRowsAsync(bool printing, CancellationToken ct)
    {
        var query = printing
            ? _db.CardRequestProcesses.AsNoTracking().Where(r => r.IsVerified == true && r.IsPrinted != true)
            : _db.CardRequestProcesses.AsNoTracking().Where(r => r.IsVerified != true);

        var joined =
            from req in query
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on req.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new { req, emp };

        var rows = await joined.ToListAsync(ct);
        var now = DateTime.UtcNow;

        return rows.Select(r =>
        {
            var refDate = printing ? (r.req.MarkedOn ?? r.req.ProcessDate) : r.req.ProcessDate;
            var bucket = AgeBucket(refDate, now);
            return new DrilldownRowDto(
                r.req.Crid.ToString(),
                r.emp?.Name ?? $"CNIC {r.req.Cnic}",
                r.req.Cnic,
                bucket,
                printing ? "Awaiting printing" : "Awaiting verification",
                printing ? "info" : "warn",
                refDate,
                $"code:{bucket}");
        }).ToList();
    }

    private async Task<List<DrilldownRowDto>> VisitorTodayRowsAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var visitors = await _db.VisitorInfos.AsNoTracking()
            .Where(v => v.EntryDate != null && v.EntryDate.Value.Date == today)
            .ToListAsync(ct);

        return visitors.Select(v =>
        {
            var company = string.IsNullOrWhiteSpace(v.CompanyName) ? "Unspecified" : v.CompanyName!.Trim();
            var checkedOut = v.ExitDate != null;
            return new DrilldownRowDto(
                v.Id.ToString(),
                v.Name ?? "Unnamed visitor",
                v.Cnic,
                company,
                checkedOut ? "Checked out" : "On site",
                checkedOut ? "neutral" : "success",
                v.EntryDate,
                $"code:{company}");
        }).ToList();
    }

    /* -------------------------------------------------------------- utils */

    private static string AgeBucket(DateTime? date, DateTime now)
    {
        if (date is null) return "Unknown";
        var hours = (now - date.Value).TotalHours;
        return hours switch
        {
            < 24 => "Under 24h",
            < 72 => "1–3 days",
            < 168 => "3–7 days",
            _ => "Over 7 days",
        };
    }

    private static int AgeBucketOrder(string bucket) => bucket switch
    {
        "Under 24h" => 0,
        "1–3 days" => 1,
        "3–7 days" => 2,
        "Over 7 days" => 3,
        _ => 4,
    };
}