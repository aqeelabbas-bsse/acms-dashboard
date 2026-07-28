using System;
using System.Collections.Generic;

namespace AcmsDashboard.Api.Models;

public partial class PersonalSmartCard
{
    public int Id { get; set; }

    public string Cnic { get; set; } = null!;

    public string? Name { get; set; }

    public string? FatherName { get; set; }

    public string? ServiceNo { get; set; }

    public string? Email { get; set; }

    public DateTime? Dob { get; set; }

    public int? CardCat { get; set; }

    public int? NastpcityCode { get; set; }

    public int? NastplocationCode { get; set; }

    public int? NastpdivisionCode { get; set; }

    public string? Designation { get; set; }

    public string? Rank { get; set; }

    public string? PresentAddress { get; set; }

    public string? PermanentAddress { get; set; }

    public string? ContactNo { get; set; }

    public byte[]? Picture { get; set; }

    public int? Bloodgroup { get; set; }

    public int? Opicode { get; set; }

    public string? Discription { get; set; }

    public bool? IsActiveFlag { get; set; }

    public string? Fpenroll { get; set; }

    public string? EditByUserId { get; set; }

    public DateTime? EditDate { get; set; }

    public string? RecievedRemarks { get; set; }

    public byte[]? AttachmentBlob { get; set; }

    public byte[]? Cnicblob { get; set; }

    public byte[]? PoliceVerificationBlob { get; set; }

    public byte[]? Firblob { get; set; }

    public int? ParentSystemId { get; set; }

    public int? RequestType { get; set; }

    public byte[]? Qrcode { get; set; }

    public int? EmploymentType { get; set; }

    public string? CompanyName { get; set; }

    public DateTime? ExpiryDate { get; set; }

    public string? EmergencyContactNo { get; set; }

    public string? ServiceStatus { get; set; }

    public bool? PictureUploaded { get; set; }

    public int? PersonnelCategory { get; set; }

    public int? HrtypeCode { get; set; }

    public int? ReqStatus { get; set; }
}
