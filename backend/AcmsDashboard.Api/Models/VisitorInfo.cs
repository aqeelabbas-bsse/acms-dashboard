using System;
using System.Collections.Generic;

namespace AcmsDashboard.Api.Models;

public partial class VisitorInfo
{
    public long Id { get; set; }

    public string Cnic { get; set; } = null!;

    public string? Name { get; set; }

    public string? Designation { get; set; }

    public string? Email { get; set; }

    public string? CompanyName { get; set; }

    public string? ContactNo { get; set; }

    public int? CityCode { get; set; }

    public int? LocationCode { get; set; }

    public int? DivisionCode { get; set; }

    public byte[]? Picture { get; set; }

    public DateTime? EntryDate { get; set; }

    public DateTime? ExitDate { get; set; }

    public string? CardSerialNumber { get; set; }

    public bool? CardStatus { get; set; }

    public DateTime? CardActivationDate { get; set; }

    public DateTime? CardDeactivationDate { get; set; }

    public string? LoginId { get; set; }

    public string? Action { get; set; }

    public DateTime? LastAccessed { get; set; }

    public int? IsTrigger { get; set; }
}
