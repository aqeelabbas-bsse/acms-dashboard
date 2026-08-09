using System;

namespace AcmsDashboard.Api.Models;

/// <summary>
/// dbo.PersonalRFID — the EMPLOYEE card-to-personnel mapping.
///
/// Not to be confused with <see cref="PersonalVisitorRfid"/> (dbo.PersonalVisitorRFID),
/// which is the VISITOR mapping. The two tables coexist by design and are never
/// merged: this one holds staff smart cards issued off the back of a
/// CardRequestProcess approval, the other holds temporary visitor RFID passes.
///
/// Written by hand rather than scaffolded so that re-running
/// `dotnet ef dbcontext scaffold` cannot silently drop it. See
/// AcmsDbContext.PersonalRfid.cs for the matching Fluent API configuration.
/// </summary>
public partial class PersonalRfid
{
    public int Id { get; set; }

    /// <summary>Primary key. NOT an identity column — assign explicitly on insert.</summary>
    public int RegId { get; set; }

    /// <summary>Links to PersonalSmartCard.CNIC (by convention — no declared FK).</summary>
    public string? Cnic { get; set; }

    public DateTime? ActivationDate { get; set; }

    public string? SmartCardNo { get; set; }

    public bool? IsActive { get; set; }

    public bool? IsDeactive { get; set; }

    public DateTime? DeactiveDate { get; set; }

    /// <summary>
    /// Free text. Also the de facto block-reason store, since there is no
    /// dedicated reason column — see PersonalRfidController.Block.
    /// </summary>
    public string? Remarks { get; set; }

    public DateTime? ReactivateDate { get; set; }

    /// <summary>0 = escorted / restricted, 1 = full access.</summary>
    public int? FullAccess { get; set; }

    public string? AccessRemarks { get; set; }

    /// <summary>Present only on PersonalRFID, not on PersonalVisitorRFID.</summary>
    public int? ExportStatus { get; set; }

    /// <summary>Present only on PersonalRFID. Coded card state (see CardStatusCode).</summary>
    public int? CardStatus { get; set; }

    /// <summary>User ID that performed the last state change.</summary>
    public int? ActionBy { get; set; }

    /// <summary>Timestamp of the last state change.</summary>
    public DateTime? ActionDate { get; set; }
}