namespace AcmsDashboard.Api.Lookups;

/// <summary>
/// Label maps for the two coded fields on PersonalSmartCard that the drill-down
/// histograms group by: CardCat and OPICode.
///
/// Neither field's meaning is documented anywhere in the SRS, Database Design
/// Document, or the supervisor's handwritten notes — OPICode's own name was
/// unknown even to the intern at time of writing. Rather than block the whole
/// requirement 6 drill-down on that, this maps every code actually present in
/// the seed data to a neutral placeholder label ("Category 1", "OPI code 3",
/// etc.) so the histogram renders real, correct COUNTS today, with obviously
/// placeholder LABELS that are safe to relabel later.
///
/// Action needed: ask the supervisor what each code means, then edit the two
/// dictionaries below. Nothing else in the drill-down feature changes — every
/// query groups by the raw integer code; this file only supplies display text.
/// </summary>
public static class CardCodeLookup
{
    public static readonly IReadOnlyDictionary<int, string> CardCat = new Dictionary<int, string>
    {
        [1] = "Category 1",
        [2] = "Category 2",
        [3] = "Category 3",
    };

    public static readonly IReadOnlyDictionary<int, string> Opicode = new Dictionary<int, string>
    {
        // Empty on purpose — OPICode is NULL on every seeded row today, so
        // there is nothing to label yet. Populate once real values exist.
    };

    public static string LabelCardCat(int? code) =>
        code is int c ? (CardCat.TryGetValue(c, out var l) ? l : $"Category {c} (unlabelled)")
                       : "Uncategorised";

    public static string LabelOpicode(int? code) =>
        code is int c ? (Opicode.TryGetValue(c, out var l) ? l : $"OPI code {c} (unlabelled)")
                       : "No OPI code";
}