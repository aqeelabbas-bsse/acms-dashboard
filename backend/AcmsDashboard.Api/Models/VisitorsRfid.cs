using System;
using System.Collections.Generic;

namespace AcmsDashboard.Api.Models;

public partial class VisitorsRfid
{
    public int? SrNo { get; set; }

    public string SmartCardNo { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime? ActiveDate { get; set; }

    public bool? CheckStatus { get; set; }

    public DateTime? CheckDate { get; set; }

    public DateTime? CheckOutDate { get; set; }

    public bool? IsBlocked { get; set; }

    public DateTime? BlockedDate { get; set; }
}
