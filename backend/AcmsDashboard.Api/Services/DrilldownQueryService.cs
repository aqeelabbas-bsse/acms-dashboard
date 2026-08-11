using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Dtos;
using AcmsDashboard.Api.Lookups;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Services;

/// <summary>
/// Builds the breakdown histogram and the searchable grid for all nine
/// drill-down metrics.
///
/// -- Why one loader feeds both endpoints ---------------------------------
/// A review finding was that the same concept could show a different number in
/// two places (SSMS reported 3 deactivated staff cards, the dashboard showed 2)
/// with nothing on screen to explain the gap. The structural fix is that
/// <see cref="LoadAsync"/> is the ONLY place a drill-down's population is
/// defined. The tile total, the histogram bars and the grid rows are all
/// derived from that one in-memory set, so they are arithmetically incapable of
/// disagreeing. Each kind also publishes the exact SQL predicate it used
/// (Spec.Definition), so any number on screen can be re-run in SSMS verbatim.
///
/// -- Why rows are materialised before filtering --------------------------
/// Several groupings depend on C# logic EF Core cannot translate: CardCat /
/// OPICode label lookup, block-reason parsing out of a free-text Remarks
/// column, wait-time age buckets, and the VisitorInfo/VisitorsRFID card-link
/// join across a varchar/nvarchar boundary. At ACMS row counts (dozens to low
/// hundreds per table) that is a non-issue. Past roughly 50k rows the bucket
/// and label logic must move into T-SQL CASE expressions or computed columns.
/// </summary>
public class DrilldownQueryService
{
    private readonly AcmsDbContext _db;

    public DrilldownQueryService(AcmsDbContext db) => _db = db;

    /* =========================================================== public API */

    public async Task<DrilldownSummaryDto> SummaryAsync(
        DrilldownKind kind, DrilldownDimension dimension, CancellationToken ct)
    {
        var (spec, recs) = await LoadAsync(kind, dimension, ct);

        var breakdown = recs
            .GroupBy(r => new { Code = r.CategoryCode ?? "none", r.CategoryLabel })
            .Select(g => new BreakdownItemDto(g.Key.Code, g.Key.CategoryLabel, g.Count()))
            .OrderByDescending(b => b.Count)
            .ThenBy(b => b.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Age buckets are ordinal, not frequency-ranked. A histogram that puts
        // "Over 7 days" before "Under 24h" reads as noise.
        if (spec.OrdinalBuckets)
            breakdown = breakdown.OrderBy(b => AgeBucketOrder(b.Code)).ToList();

        return new DrilldownSummaryDto(
            kind,
            recs.Count,
            breakdown,
            spec.SupportsDimensionToggle,
            spec.BreakdownLabel,
            spec.Definition,
            spec.SourceTable,
            spec.Columns,
            spec.Filters,
            spec.Reconciliation);
    }

    public async Task<(IReadOnlyList<DrilldownRowDto> Rows, int Total, int Unfiltered)> RowsAsync(
        DrilldownKind kind, DrilldownDimension dimension, DrilldownQuery q, CancellationToken ct)
    {
        var (spec, recs) = await LoadAsync(kind, dimension, ct);
        var unfiltered = recs.Count;

        IEnumerable<Rec> rows = recs;

        // ---- category (histogram bar click) ----
        if (Has(q.Category) && !string.Equals(q.Category, "all", StringComparison.OrdinalIgnoreCase))
        {
            rows = rows.Where(r => string.Equals(
                r.CategoryCode ?? "none", q.Category, StringComparison.OrdinalIgnoreCase));
        }

        // ---- status (select filter) ----
        if (Has(q.Status) && !string.Equals(q.Status, "all", StringComparison.OrdinalIgnoreCase))
        {
            rows = rows.Where(r => string.Equals(
                r.StatusCode, q.Status, StringComparison.OrdinalIgnoreCase));
        }

        // ---- date range, inclusive at both ends ----
        // The picker sends a bare date for `to`, so it is pushed to 23:59:59.
        // Without that, "to 12 Aug" silently drops everything that happened on
        // 12 Aug after midnight, which looks like missing data.
        if (q.From is { } from)
            rows = rows.Where(r => r.Date != null && r.Date >= from.Date);

        if (q.To is { } to)
            rows = rows.Where(r => r.Date != null && r.Date <= to.Date.AddDays(1).AddTicks(-1));

        // ---- free text across every searchable column, or one named column ----
        if (Has(q.Search))
        {
            var needle = q.Search!.Trim();

            var keys = (Has(q.Field) && !string.Equals(q.Field, "all", StringComparison.OrdinalIgnoreCase)
                    ? spec.Columns.Where(c => c.Searchable &&
                          string.Equals(c.Key, q.Field, StringComparison.OrdinalIgnoreCase))
                    : spec.Columns.Where(c => c.Searchable))
                .Select(c => c.Key)
                .ToArray();

            rows = rows.Where(r => keys.Any(k =>
                r.Cells.TryGetValue(k, out var v) &&
                v is not null &&
                v.Contains(needle, StringComparison.OrdinalIgnoreCase)));
        }

        var list = rows.ToList();
        var total = list.Count;

        // ---- sort ----
        var descending = !string.Equals(q.Dir, "asc", StringComparison.OrdinalIgnoreCase);
        var sortKey = Has(q.Sort) ? q.Sort! : "__date";

        var sortColumn = spec.Columns.FirstOrDefault(c =>
            c.Sortable && string.Equals(c.Key, sortKey, StringComparison.OrdinalIgnoreCase));

        IOrderedEnumerable<Rec> ordered;

        if (sortColumn is null || sortColumn.Type == "date")
        {
            ordered = descending
                ? list.OrderByDescending(r => r.Date ?? DateTime.MinValue)
                : list.OrderBy(r => r.Date ?? DateTime.MaxValue);
        }
        else
        {
            ordered = descending
                ? list.OrderByDescending(r => Cell(r, sortColumn.Key), StringComparer.OrdinalIgnoreCase)
                : list.OrderBy(r => Cell(r, sortColumn.Key), StringComparer.OrdinalIgnoreCase);
        }

        var page = Math.Max(q.Page, 1);
        var limit = Math.Clamp(q.Limit, 1, 200);

        var paged = ordered
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(r => new DrilldownRowDto(r.Id, r.CategoryCode, r.Date, r.Cells, r.StatusTone))
            .ToList();

        return (paged, total, unfiltered);
    }

    /* ====================================================== internal shape */

    private sealed record Rec(
        string Id,
        string? CategoryCode,
        string CategoryLabel,
        DateTime? Date,
        string? StatusCode,
        string? StatusTone,
        Dictionary<string, string?> Cells);

    private sealed record Spec(
        string Definition,
        string SourceTable,
        string BreakdownLabel,
        IReadOnlyList<DrilldownColumnDto> Columns,
        IReadOnlyList<DrilldownFilterDto> Filters,
        bool SupportsDimensionToggle = false,
        bool OrdinalBuckets = false,
        string? Reconciliation = null);

    // Short factories so each Spec below reads as a table of columns rather
    // than three lines of ceremony per entry.
    private static DrilldownColumnDto Col(
        string key, string label, string type = "text", bool searchable = true) =>
        new(key, label, type, searchable);

    private static FilterOptionDto Opt(string value, string label) => new(value, label);

    private static DrilldownFilterDto Select(
        string key, string label, params FilterOptionDto[] options) =>
        new(key, label, "select", options);

    private static DrilldownFilterDto DateRange(string label) =>
        new("dateRange", label, "dateRange", null);

    private Task<(Spec Spec, List<Rec> Rows)> LoadAsync(
        DrilldownKind kind, DrilldownDimension dimension, CancellationToken ct) => kind switch
        {
            DrilldownKind.ActiveCards        => ActiveStaffCardsAsync(dimension, ct),
            DrilldownKind.BlockedCards       => DeactivatedStaffCardsAsync(ct),
            DrilldownKind.PendingPrinting    => RequestsAsync(Stage.Printing, ct),
            DrilldownKind.PendingApproval    => RequestsAsync(Stage.Approval, ct),
            DrilldownKind.VisitorsToday      => VisitorsTodayAsync(ct),
            DrilldownKind.TotalEmployees     => EmployeesAsync(dimension, ct),
            DrilldownKind.ActiveVisitorCards => ActiveVisitorCardsAsync(ct),
            DrilldownKind.VisitorsOnSite     => VisitorsOnSiteAsync(ct),
            DrilldownKind.PendingRequests    => RequestsAsync(Stage.All, ct),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };

    /* ================================================ KPI 1 total employees */

    private async Task<(Spec, List<Rec>)> EmployeesAsync(
        DrilldownDimension dimension, CancellationToken ct)
    {
        var emps = await _db.PersonalSmartCards.AsNoTracking()
            .Select(e => new
            {
                e.Cnic, e.Name, e.ServiceNo, e.Designation, e.CompanyName,
                e.ExpiryDate, e.IsActiveFlag, e.CardCat, e.Opicode,
            })
            .ToListAsync(ct);

        var byOpi = dimension == DrilldownDimension.Opicode;

        var rows = emps.Select(e =>
        {
            var code = byOpi ? e.Opicode : e.CardCat;
            var label = byOpi
                ? CardCodeLookup.LabelOpicode(e.Opicode)
                : CardCodeLookup.LabelCardCat(e.CardCat);
            var active = e.IsActiveFlag == true;

            return new Rec(
                e.Cnic,
                code?.ToString() ?? "none",
                label,
                e.ExpiryDate,
                active ? "active" : "inactive",
                active ? "success" : "neutral",
                new Dictionary<string, string?>
                {
                    ["name"]        = e.Name,
                    ["cnic"]        = e.Cnic,
                    ["serviceNo"]   = e.ServiceNo,
                    ["designation"] = e.Designation,
                    ["company"]     = e.CompanyName,
                    ["category"]    = label,
                    ["status"]      = active ? "Active" : "Inactive",
                    ["expiry"]      = Iso(e.ExpiryDate),
                });
        }).ToList();

        var columns = new DrilldownColumnDto[]
        {
            Col("name",        "Employee"),
            Col("cnic",        "CNIC",        "mono"),
            Col("serviceNo",   "Service no.", "mono"),
            Col("designation", "Designation"),
            Col("company",     "Company"),
            Col("category",    "Category"),
            Col("status",      "Profile",     "status", searchable: false),
            Col("expiry",      "Card expiry", "date",   searchable: false),
        };

        var filters = new DrilldownFilterDto[]
        {
            Select("status", "Profile state",
                Opt("all", "All"), Opt("active", "Active"), Opt("inactive", "Inactive")),
            DateRange("Card expiry between"),
        };

        var spec = new Spec(
            Definition: "SELECT COUNT(*) FROM dbo.PersonalSmartCard",
            SourceTable: "dbo.PersonalSmartCard",
            BreakdownLabel: byOpi ? "By OPI code" : "By card category",
            Columns: columns,
            Filters: filters,
            SupportsDimensionToggle: true,
            Reconciliation: "Every registered smart-card profile, with no filter applied. "
                + "IsActiveFlag separates serving from separated personnel but does not remove "
                + "anyone from this count.");

        return (spec, rows);
    }

    /* =========================================== KPI 2 active visitor cards */

    private async Task<(Spec, List<Rec>)> ActiveVisitorCardsAsync(CancellationToken ct)
    {
        // Predicate copied verbatim from AnalyticsController.Summary so the KPI
        // tile and this drill-down cannot drift apart.
        var cards = await _db.VisitorsRfids.AsNoTracking()
            .Where(c => c.IsActive == true && c.IsBlocked != true)
            .Select(c => new { c.SmartCardNo, c.ActiveDate })
            .ToListAsync(ct);

        var serials = cards.Select(c => c.SmartCardNo).ToList();

        // Joined in memory on purpose: VisitorInfo.CardSerialNumber is nvarchar
        // while VisitorsRFID.SmartCardNo is varchar. Pushing that join to SQL
        // Server forces an implicit conversion that defeats index use, and at
        // these row counts the in-memory join is both faster and clearer.
        var visits = await _db.VisitorInfos.AsNoTracking()
            .Where(v => v.CardSerialNumber != null && serials.Contains(v.CardSerialNumber))
            .Select(v => new { v.CardSerialNumber, v.Name, v.Cnic, v.CompanyName, v.EntryDate, v.ExitDate })
            .ToListAsync(ct);

        // Most recent visit wins when a pass has been reissued.
        var latest = visits
            .GroupBy(v => v.CardSerialNumber!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(v => v.EntryDate).First(),
                StringComparer.OrdinalIgnoreCase);

        var rows = cards.Select(c =>
        {
            latest.TryGetValue(c.SmartCardNo, out var v);

            string code, label, status, tone;

            if (v is null)
                (code, label, status, tone) = ("unassigned", "Unassigned - in stock", "In stock", "neutral");
            else if (v.ExitDate is null)
                (code, label, status, tone) = ("onsite", "Assigned - holder on site", "On site", "success");
            else
                (code, label, status, tone) = ("returned", "Assigned - holder checked out", "Checked out", "info");

            return new Rec(
                c.SmartCardNo, code, label, c.ActiveDate, code, tone,
                new Dictionary<string, string?>
                {
                    ["cardNo"]    = c.SmartCardNo,
                    ["holder"]    = v?.Name,
                    ["cnic"]      = v?.Cnic,
                    ["company"]   = v?.CompanyName,
                    ["state"]     = label,
                    ["status"]    = status,
                    ["activated"] = Iso(c.ActiveDate),
                });
        }).ToList();

        var columns = new DrilldownColumnDto[]
        {
            Col("cardNo",    "Card no.", "mono"),
            Col("holder",    "Current holder"),
            Col("cnic",      "CNIC",     "mono"),
            Col("company",   "Company"),
            Col("state",     "Link state"),
            Col("status",    "Status",    "status", searchable: false),
            Col("activated", "Activated", "date",   searchable: false),
        };

        var filters = new DrilldownFilterDto[]
        {
            Select("status", "Holder state",
                Opt("all", "All"),
                Opt("onsite", "Holder on site"),
                Opt("returned", "Holder checked out"),
                Opt("unassigned", "Unassigned / in stock")),
            DateRange("Activated between"),
        };

        var spec = new Spec(
            Definition: "SELECT COUNT(*) FROM dbo.VisitorsRFID "
                      + "WHERE isActive = 1 AND ISNULL(isBlocked, 0) = 0",
            SourceTable: "dbo.VisitorsRFID",
            BreakdownLabel: "By holder state",
            Columns: columns,
            Filters: filters,
            Reconciliation: "This counts CARDS in the pass inventory, not people. It is not "
                + "expected to equal 'Visitors on site now', which counts open VISITS in "
                + "dbo.VisitorInfo. The Link state column shows exactly where the two populations "
                + "diverge.");

        return (spec, rows);
    }

    /* ============================================== KPI 3 visitors on site */

    private async Task<(Spec, List<Rec>)> VisitorsOnSiteAsync(CancellationToken ct)
    {
        var open = await _db.VisitorInfos.AsNoTracking()
            .Where(v => v.ExitDate == null)
            .Select(v => new
            {
                v.Id, v.Cnic, v.Name, v.CompanyName, v.Designation,
                v.ContactNo, v.EntryDate, v.CardSerialNumber,
            })
            .ToListAsync(ct);

        var serials = open
            .Where(v => v.CardSerialNumber != null)
            .Select(v => v.CardSerialNumber!)
            .Distinct()
            .ToList();

        var cards = await _db.VisitorsRfids.AsNoTracking()
            .Where(c => serials.Contains(c.SmartCardNo))
            .Select(c => new { c.SmartCardNo, c.IsActive, c.IsBlocked })
            .ToListAsync(ct);

        var cardIndex = cards.ToDictionary(
            c => c.SmartCardNo, c => c, StringComparer.OrdinalIgnoreCase);

        var rows = open.Select(v =>
        {
            string code, label, status, tone;

            if (string.IsNullOrWhiteSpace(v.CardSerialNumber))
                (code, label, status, tone) = ("nocard", "No pass recorded", "No pass", "warn");
            else if (!cardIndex.TryGetValue(v.CardSerialNumber!, out var card))
                (code, label, status, tone) = ("orphan", "Pass number not in card inventory", "Unlinked", "danger");
            else if (card.IsBlocked == true)
                (code, label, status, tone) = ("blocked", "Pass blocked while holder on site", "Blocked pass", "danger");
            else if (card.IsActive != true)
                (code, label, status, tone) = ("inactive", "Pass deactivated while holder on site", "Inactive pass", "warn");
            else
                (code, label, status, tone) = ("linked", "Active pass held", "Active pass", "success");

            return new Rec(
                v.Id.ToString(), code, label, v.EntryDate, code, tone,
                new Dictionary<string, string?>
                {
                    ["name"]        = v.Name,
                    ["cnic"]        = v.Cnic,
                    ["company"]     = v.CompanyName,
                    ["designation"] = v.Designation,
                    ["contact"]     = v.ContactNo,
                    ["cardNo"]      = v.CardSerialNumber,
                    ["state"]       = label,
                    ["status"]      = status,
                    ["entry"]       = Iso(v.EntryDate),
                });
        }).ToList();

        var columns = new DrilldownColumnDto[]
        {
            Col("name",        "Visitor"),
            Col("cnic",        "CNIC",     "mono"),
            Col("company",     "Company"),
            Col("designation", "Designation"),
            Col("contact",     "Contact",  "mono"),
            Col("cardNo",      "Pass no.", "mono"),
            Col("state",       "Link state"),
            Col("status",      "Status",     "status", searchable: false),
            Col("entry",       "Checked in", "date",   searchable: false),
        };

        var filters = new DrilldownFilterDto[]
        {
            Select("status", "Pass link state",
                Opt("all", "All"),
                Opt("linked", "Active pass held"),
                Opt("inactive", "Pass inactive"),
                Opt("blocked", "Pass blocked"),
                Opt("orphan", "Pass not in inventory"),
                Opt("nocard", "No pass recorded")),
            DateRange("Checked in between"),
        };

        var spec = new Spec(
            Definition: "SELECT COUNT(*) FROM dbo.VisitorInfo WHERE ExitDate IS NULL",
            SourceTable: "dbo.VisitorInfo",
            BreakdownLabel: "By pass link state",
            Columns: columns,
            Filters: filters,
            Reconciliation: "An open visit is a row with no ExitDate. Any row outside the "
                + "'Active pass held' bucket is a real integrity gap between the visit log and the "
                + "pass inventory - usually a check-in captured without activating a pass, or a "
                + "checkout that was never recorded.");

        return (spec, rows);
    }

    /* ================================ KPI 4 and tiles 3 and 4 - card requests */

    private enum Stage { All, Approval, Printing }

    private async Task<(Spec, List<Rec>)> RequestsAsync(Stage stage, CancellationToken ct)
    {
        var baseQuery = _db.CardRequestProcesses.AsNoTracking();

        baseQuery = stage switch
        {
            Stage.Approval => baseQuery.Where(r => r.IsVerified != true),
            Stage.Printing => baseQuery.Where(r => r.IsVerified == true && r.IsPrinted != true),
            _              => baseQuery.Where(r => r.IsPrinted != true),
        };

        var joined = await (
            from req in baseQuery
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on req.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new
            {
                req.Crid,
                req.Cnic,
                req.Remarks,
                req.ProcessDate,
                req.MarkedOn,
                req.IsVerified,
                Name = emp != null ? emp.Name : null,
                Designation = emp != null ? emp.Designation : null,
            }).ToListAsync(ct);

        var now = DateTime.UtcNow;
        var byStage = stage == Stage.All;

        var rows = joined.Select(r =>
        {
            var verified = r.IsVerified == true;
            var refDate = verified ? (r.MarkedOn ?? r.ProcessDate) : r.ProcessDate;
            var bucket = AgeBucket(refDate, now);

            var stageLabel = verified ? "Awaiting printing" : "Awaiting verification";
            var stageCode = verified ? "printing" : "approval";

            // The combined KPI groups by workflow stage, because "what is this 4
            // made of?" is the question it answers. The two individual tiles
            // group by wait time instead - their stage is already fixed.
            var code = byStage ? stageCode : bucket;
            var label = byStage ? stageLabel : bucket;

            return new Rec(
                r.Crid.ToString(), code, label, refDate, stageCode,
                verified ? "info" : "warn",
                new Dictionary<string, string?>
                {
                    ["name"]        = r.Name ?? $"CNIC {r.Cnic}",
                    ["cnic"]        = r.Cnic,
                    ["designation"] = r.Designation,
                    ["remarks"]     = r.Remarks,
                    ["stage"]       = stageLabel,
                    ["waiting"]     = bucket,
                    ["date"]        = Iso(refDate),
                });
        }).ToList();

        string definition, breakdownLabel, reconciliation;

        switch (stage)
        {
            case Stage.Approval:
                definition = "SELECT COUNT(*) FROM dbo.CardRequestProcess "
                           + "WHERE ISNULL(isVerified, 0) = 0";
                breakdownLabel = "By time waiting";
                reconciliation = "Age is measured from ProcessDate, the submission timestamp.";
                break;

            case Stage.Printing:
                definition = "SELECT COUNT(*) FROM dbo.CardRequestProcess "
                           + "WHERE isVerified = 1 AND ISNULL(isPrinted, 0) = 0";
                breakdownLabel = "By time waiting";
                reconciliation = "Age is measured from MarkedOn (verification), falling back to "
                               + "ProcessDate when a request was verified without a timestamp.";
                break;

            default:
                definition = "SELECT COUNT(*) FROM dbo.CardRequestProcess "
                           + "WHERE ISNULL(isPrinted, 0) = 0";
                breakdownLabel = "By workflow stage";
                reconciliation = "This total is exactly 'Pending approval' plus 'Pending printing' - "
                               + "the two tiles below partition it with no overlap and no gap.";
                break;
        }

        var columns = new DrilldownColumnDto[]
        {
            Col("name",        "Requester"),
            Col("cnic",        "CNIC", "mono"),
            Col("designation", "Designation"),
            Col("remarks",     "Remarks"),
            Col("stage",       "Stage", "status", searchable: false),
            Col("waiting",     "Waiting"),
            Col("date",        "Since", "date", searchable: false),
        };

        var filters = byStage
            ? new DrilldownFilterDto[]
              {
                  Select("status", "Workflow stage",
                      Opt("all", "All"),
                      Opt("approval", "Awaiting verification"),
                      Opt("printing", "Awaiting printing")),
                  DateRange("Waiting since"),
              }
            : new DrilldownFilterDto[]
              {
                  DateRange("Waiting since"),
              };

        var spec = new Spec(
            Definition: definition,
            SourceTable: "dbo.CardRequestProcess",
            BreakdownLabel: breakdownLabel,
            Columns: columns,
            Filters: filters,
            OrdinalBuckets: !byStage,
            Reconciliation: reconciliation);

        return (spec, rows);
    }

    /* ==================================================== tile 1 active staff */

    private async Task<(Spec, List<Rec>)> ActiveStaffCardsAsync(
        DrilldownDimension dimension, CancellationToken ct)
    {
        var joined = await (
            from card in _db.PersonalRfids.AsNoTracking()
            where card.IsActive == true
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on card.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new
            {
                card.RegId,
                card.Cnic,
                card.SmartCardNo,
                card.ActivationDate,
                card.FullAccess,
                Name = emp != null ? emp.Name : null,
                Designation = emp != null ? emp.Designation : null,
                CardCat = emp != null ? emp.CardCat : null,
                Opicode = emp != null ? emp.Opicode : null,
            }).ToListAsync(ct);

        var byOpi = dimension == DrilldownDimension.Opicode;

        var rows = joined.Select(r =>
        {
            var code = byOpi ? r.Opicode : r.CardCat;
            var label = byOpi
                ? CardCodeLookup.LabelOpicode(r.Opicode)
                : CardCodeLookup.LabelCardCat(r.CardCat);
            var full = r.FullAccess == 1;

            return new Rec(
                r.RegId.ToString(),
                code?.ToString() ?? "none",
                label,
                r.ActivationDate,
                full ? "full" : "escorted",
                "success",
                new Dictionary<string, string?>
                {
                    ["holder"]      = r.Name ?? "Unknown holder",
                    ["cnic"]        = r.Cnic,
                    ["cardNo"]      = r.SmartCardNo,
                    ["designation"] = r.Designation,
                    ["category"]    = label,
                    ["access"]      = full ? "Full access" : "Escorted / restricted",
                    ["status"]      = "Active",
                    ["activated"]   = Iso(r.ActivationDate),
                });
        }).ToList();

        var columns = new DrilldownColumnDto[]
        {
            Col("holder",      "Holder"),
            Col("cnic",        "CNIC",     "mono"),
            Col("cardNo",      "Card no.", "mono"),
            Col("designation", "Designation"),
            Col("category",    "Category"),
            Col("access",      "Access level"),
            Col("status",      "Status",    "status", searchable: false),
            Col("activated",   "Activated", "date",   searchable: false),
        };

        var filters = new DrilldownFilterDto[]
        {
            Select("status", "Access level",
                Opt("all", "All"),
                Opt("full", "Full access"),
                Opt("escorted", "Escorted / restricted")),
            DateRange("Activated between"),
        };

        var spec = new Spec(
            Definition: "SELECT COUNT(*) FROM dbo.PersonalRFID WHERE IsActive = 1",
            SourceTable: "dbo.PersonalRFID",
            BreakdownLabel: byOpi ? "By OPI code" : "By card category",
            Columns: columns,
            Filters: filters,
            SupportsDimensionToggle: true,
            Reconciliation: "'Active' is a property of the CARD row, not the employee profile. A "
                + "serving employee can hold a reissued card while their previous card row stays "
                + "inactive, so this will not always equal the headcount.");

        return (spec, rows);
    }

    /* ============================================== tile 2 deactivated staff */

    private async Task<(Spec, List<Rec>)> DeactivatedStaffCardsAsync(CancellationToken ct)
    {
        // ---- the 3-vs-2 fix ------------------------------------------------
        // This previously also required Remarks to contain the "[BLOCK:" marker,
        // so a card deactivated for an ordinary reason (surrendered on
        // resignation) was counted by SQL Server but not by the dashboard.
        //
        // The population is now the plain condition IsDeactive = 1, which
        // matches SSMS exactly. Cards carrying a block marker still get their
        // specific reason bucket; the rest fall into "Withdrawn", and the status
        // filter narrows to the security-blocked subset when that is what is
        // actually wanted.
        var joined = await (
            from card in _db.PersonalRfids.AsNoTracking()
            where card.IsDeactive == true
            join emp in _db.PersonalSmartCards.AsNoTracking()
                on card.Cnic equals emp.Cnic into empJoin
            from emp in empJoin.DefaultIfEmpty()
            select new
            {
                card.RegId,
                card.Cnic,
                card.SmartCardNo,
                card.Remarks,
                card.DeactiveDate,
                Name = emp != null ? emp.Name : null,
                Designation = emp != null ? emp.Designation : null,
            }).ToListAsync(ct);

        var rows = joined.Select(r =>
        {
            var isBlock = r.Remarks != null
                       && r.Remarks.Contains(BlockReasons.Marker, StringComparison.Ordinal);

            var code = isBlock ? BlockReasons.Parse(r.Remarks) : "Withdrawn";

            string label;
            if (!isBlock)
                label = "Withdrawn (no block reason recorded)";
            else if (BlockReasons.Labels.TryGetValue(code, out var known))
                label = known;
            else
                label = code;

            return new Rec(
                r.RegId.ToString(),
                code,
                label,
                r.DeactiveDate,
                isBlock ? "blocked" : "withdrawn",
                isBlock ? "danger" : "neutral",
                new Dictionary<string, string?>
                {
                    ["holder"]      = r.Name ?? "Unknown holder",
                    ["cnic"]        = r.Cnic,
                    ["cardNo"]      = r.SmartCardNo,
                    ["designation"] = r.Designation,
                    ["reason"]      = label,
                    ["remarks"]     = StripMarker(r.Remarks),
                    ["status"]      = isBlock ? "Blocked" : "Withdrawn",
                    ["deactivated"] = Iso(r.DeactiveDate),
                });
        }).ToList();

        var blocked = rows.Count(r => r.StatusCode == "blocked");

        var columns = new DrilldownColumnDto[]
        {
            Col("holder",      "Holder"),
            Col("cnic",        "CNIC",     "mono"),
            Col("cardNo",      "Card no.", "mono"),
            Col("designation", "Designation"),
            Col("reason",      "Reason"),
            Col("remarks",     "Remarks"),
            Col("status",      "Status",      "status", searchable: false),
            Col("deactivated", "Deactivated", "date",   searchable: false),
        };

        var filters = new DrilldownFilterDto[]
        {
            Select("status", "Deactivation type",
                Opt("all", "All"),
                Opt("blocked", "Security block"),
                Opt("withdrawn", "Routine withdrawal")),
            DateRange("Deactivated between"),
        };

        var spec = new Spec(
            Definition: "SELECT COUNT(*) FROM dbo.PersonalRFID WHERE IsDeactive = 1",
            SourceTable: "dbo.PersonalRFID",
            BreakdownLabel: "By reason",
            Columns: columns,
            Filters: filters,
            Reconciliation: $"{rows.Count} card(s) are deactivated in total, of which {blocked} "
                + "carry an explicit security block reason. The Personal RFID screen's 'Blocked' "
                + $"filter shows that {blocked} - choose 'Security block' above to match it.");

        return (spec, rows);
    }

    /* =============================================== tile 5 visitors today */

    private async Task<(Spec, List<Rec>)> VisitorsTodayAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var visitors = await _db.VisitorInfos.AsNoTracking()
            .Where(v => v.EntryDate != null && v.EntryDate.Value.Date == today)
            .Select(v => new
            {
                v.Id, v.Cnic, v.Name, v.CompanyName, v.Designation,
                v.ContactNo, v.EntryDate, v.ExitDate, v.CardSerialNumber,
            })
            .ToListAsync(ct);

        var rows = visitors.Select(v =>
        {
            var company = string.IsNullOrWhiteSpace(v.CompanyName)
                ? "Unspecified"
                : v.CompanyName!.Trim();
            var checkedOut = v.ExitDate != null;

            return new Rec(
                v.Id.ToString(), company, company, v.EntryDate,
                checkedOut ? "out" : "in",
                checkedOut ? "neutral" : "success",
                new Dictionary<string, string?>
                {
                    ["name"]        = v.Name ?? "Unnamed visitor",
                    ["cnic"]        = v.Cnic,
                    ["company"]     = company,
                    ["designation"] = v.Designation,
                    ["contact"]     = v.ContactNo,
                    ["cardNo"]      = v.CardSerialNumber,
                    ["status"]      = checkedOut ? "Checked out" : "On site",
                    ["entry"]       = Iso(v.EntryDate),
                });
        }).ToList();

        var columns = new DrilldownColumnDto[]
        {
            Col("name",        "Visitor"),
            Col("cnic",        "CNIC",     "mono"),
            Col("company",     "Company"),
            Col("designation", "Designation"),
            Col("contact",     "Contact",  "mono"),
            Col("cardNo",      "Pass no.", "mono"),
            Col("status",      "Status",     "status", searchable: false),
            Col("entry",       "Checked in", "date",   searchable: false),
        };

        var filters = new DrilldownFilterDto[]
        {
            Select("status", "Presence",
                Opt("all", "All"),
                Opt("in", "Still on site"),
                Opt("out", "Checked out")),
            DateRange("Checked in between"),
        };

        var spec = new Spec(
            Definition: "SELECT COUNT(*) FROM dbo.VisitorInfo "
                      + "WHERE CAST(EntryDate AS date) = CAST(GETUTCDATE() AS date)",
            SourceTable: "dbo.VisitorInfo",
            BreakdownLabel: "By visiting company",
            Columns: columns,
            Filters: filters,
            Reconciliation: "VisitorInfo has no Department column. A visitor belongs to a visiting "
                + "company rather than a NASTP division, so CompanyName is the grouping field - "
                + "confirm with the supervisor that this is what 'department-wise' meant. Dates are "
                + "compared in UTC, matching how the API writes them.");

        return (spec, rows);
    }

    /* =============================================================== utils */

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

    private static string Cell(Rec r, string key) =>
        r.Cells.TryGetValue(key, out var v) ? v ?? string.Empty : string.Empty;

    /// <summary>
    /// EF Core returns SQL Server <c>datetime</c> with Kind=Unspecified, and
    /// System.Text.Json then serialises it with no trailing Z. The browser reads
    /// that as local time and shows Pakistan timestamps five hours out. The API
    /// writes these columns in UTC, so the Kind is stated explicitly here and
    /// the round-trip format carries the Z through to the client.
    /// </summary>
    private static string? Iso(DateTime? d) =>
        d is null ? null : DateTime.SpecifyKind(d.Value, DateTimeKind.Utc).ToString("o");

    private static string? StripMarker(string? remarks)
    {
        if (string.IsNullOrWhiteSpace(remarks)) return remarks;
        if (!remarks.StartsWith(BlockReasons.Marker, StringComparison.Ordinal)) return remarks;

        var close = remarks.IndexOf(']');
        return close >= 0 ? remarks[(close + 1)..].Trim() : remarks;
    }

    private static string AgeBucket(DateTime? date, DateTime now)
    {
        if (date is null) return "Unknown";

        return (now - date.Value).TotalHours switch
        {
            < 24 => "Under 24h",
            < 72 => "1-3 days",
            < 168 => "3-7 days",
            _ => "Over 7 days",
        };
    }

    private static int AgeBucketOrder(string bucket) => bucket switch
    {
        "Under 24h" => 0,
        "1-3 days" => 1,
        "3-7 days" => 2,
        "Over 7 days" => 3,
        _ => 4,
    };
}