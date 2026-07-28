using System;
using System.Collections.Generic;

namespace AcmsDashboard.Api.Models;

public partial class PersonalVisitorRfid
{
    public int Id { get; set; }

    public int RegId { get; set; }

    public string? Cnic { get; set; }

    public DateTime? ActivationDate { get; set; }

    public string? SmartCardNo { get; set; }

    public bool? IsActive { get; set; }

    public bool? IsDeactive { get; set; }

    public DateTime? DeactiveDate { get; set; }

    public string? Remarks { get; set; }

    public DateTime? ReactivateDate { get; set; }

    public int? FullAccess { get; set; }

    public string? AccessRemarks { get; set; }
}
