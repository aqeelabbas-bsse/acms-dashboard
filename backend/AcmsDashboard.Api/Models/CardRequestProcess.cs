using System;
using System.Collections.Generic;

namespace AcmsDashboard.Api.Models;

public partial class CardRequestProcess
{
    public int Crid { get; set; }

    public int? RegId { get; set; }

    public string? Cnic { get; set; }

    public int? ForwardedBy { get; set; }

    public int? ProcessedBy { get; set; }

    public DateTime? ProcessDate { get; set; }

    public int? MarkedTo { get; set; }

    public DateTime? MarkedOn { get; set; }

    public string? Remarks { get; set; }

    public bool? IsVerified { get; set; }

    public bool? IsForward { get; set; }

    public bool? IsPrinted { get; set; }

    public DateTime? PrintingDate { get; set; }

    public string? PrintBy { get; set; }
}
