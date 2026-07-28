using System;
using System.Collections.Generic;
using AcmsDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Data;

public partial class AcmsDbContext : DbContext
{
    public AcmsDbContext(DbContextOptions<AcmsDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<CardRequestProcess> CardRequestProcesses { get; set; }

    public virtual DbSet<PersonalSmartCard> PersonalSmartCards { get; set; }

    public virtual DbSet<PersonalVisitorRfid> PersonalVisitorRfids { get; set; }

    public virtual DbSet<VisitorInfo> VisitorInfos { get; set; }

    public virtual DbSet<VisitorsRfid> VisitorsRfids { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CardRequestProcess>(entity =>
        {
            entity.HasKey(e => e.Crid);

            entity.ToTable("CardRequestProcess");

            entity.Property(e => e.Crid).HasColumnName("CRID");
            entity.Property(e => e.Cnic)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CNIC");
            entity.Property(e => e.IsForward).HasColumnName("isForward");
            entity.Property(e => e.IsPrinted).HasColumnName("isPrinted");
            entity.Property(e => e.IsVerified).HasColumnName("isVerified");
            entity.Property(e => e.MarkedOn).HasColumnType("datetime");
            entity.Property(e => e.PrintBy)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.PrintingDate).HasColumnType("datetime");
            entity.Property(e => e.ProcessDate).HasColumnType("datetime");
            entity.Property(e => e.RegId).HasColumnName("RegID");
            entity.Property(e => e.Remarks)
                .HasMaxLength(500)
                .IsUnicode(false);
        });

        modelBuilder.Entity<PersonalSmartCard>(entity =>
        {
            entity.HasKey(e => e.Cnic);

            entity.ToTable("PersonalSmartCard");

            entity.Property(e => e.Cnic)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CNIC");
            entity.Property(e => e.Cnicblob).HasColumnName("CNICBlob");
            entity.Property(e => e.CompanyName)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.ContactNo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Designation)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Discription)
                .HasMaxLength(1500)
                .IsUnicode(false);
            entity.Property(e => e.Dob)
                .HasColumnType("datetime")
                .HasColumnName("DOB");
            entity.Property(e => e.EditByUserId)
                .HasMaxLength(150)
                .HasColumnName("EditByUserID");
            entity.Property(e => e.EditDate).HasColumnType("datetime");
            entity.Property(e => e.Email)
                .HasMaxLength(250)
                .IsUnicode(false);
            entity.Property(e => e.EmergencyContactNo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ExpiryDate).HasColumnType("datetime");
            entity.Property(e => e.FatherName)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Firblob).HasColumnName("FIRBlob");
            entity.Property(e => e.Fpenroll)
                .IsUnicode(false)
                .HasColumnName("FPEnroll");
            entity.Property(e => e.HrtypeCode).HasColumnName("HRTypeCode");
            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd()
                .HasColumnName("ID");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.NastpcityCode).HasColumnName("NASTPCityCode");
            entity.Property(e => e.NastpdivisionCode).HasColumnName("NASTPDivisionCode");
            entity.Property(e => e.NastplocationCode).HasColumnName("NASTPLocationCode");
            entity.Property(e => e.Opicode).HasColumnName("OPICode");
            entity.Property(e => e.ParentSystemId).HasColumnName("ParentSystemID");
            entity.Property(e => e.PermanentAddress)
                .HasMaxLength(1500)
                .IsUnicode(false);
            entity.Property(e => e.Picture).HasColumnType("image");
            entity.Property(e => e.PictureUploaded).HasDefaultValue(false, "DF_PersonalSmartCard_PictureUploaded");
            entity.Property(e => e.PresentAddress)
                .HasMaxLength(1500)
                .IsUnicode(false);
            entity.Property(e => e.Qrcode)
                .HasColumnType("image")
                .HasColumnName("QRCode");
            entity.Property(e => e.Rank)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.RecievedRemarks).HasMaxLength(2000);
            entity.Property(e => e.ServiceNo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ServiceStatus)
                .HasMaxLength(50)
                .IsUnicode(false);
        });

        modelBuilder.Entity<PersonalVisitorRfid>(entity =>
        {
            entity.HasKey(e => e.RegId);

            entity.ToTable("PersonalVisitorRFID");

            entity.Property(e => e.RegId)
                .ValueGeneratedNever()
                .HasColumnName("RegID");
            entity.Property(e => e.AccessRemarks).IsUnicode(false);
            entity.Property(e => e.ActivationDate).HasColumnType("datetime");
            entity.Property(e => e.Cnic)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CNIC");
            entity.Property(e => e.DeactiveDate).HasColumnType("datetime");
            entity.Property(e => e.FullAccess).HasDefaultValue(0, "DF_PersonalVisitorRFID_FullAccess");
            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd()
                .HasColumnName("ID");
            entity.Property(e => e.IsActive).HasDefaultValue(false, "DF_PersonalVisitorRFID_IsActive");
            entity.Property(e => e.IsDeactive).HasDefaultValue(false, "DF_PersonalVisitorRFID_IsDeactive");
            entity.Property(e => e.ReactivateDate).HasColumnType("datetime");
            entity.Property(e => e.Remarks)
                .HasMaxLength(1500)
                .IsUnicode(false);
            entity.Property(e => e.SmartCardNo)
                .HasMaxLength(50)
                .IsUnicode(false);
        });

        modelBuilder.Entity<VisitorInfo>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_VisitorInfo_1");

            entity.ToTable("VisitorInfo");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.CardActivationDate).HasColumnType("datetime");
            entity.Property(e => e.CardDeactivationDate).HasColumnType("datetime");
            entity.Property(e => e.CardSerialNumber).HasMaxLength(50);
            entity.Property(e => e.Cnic)
                .HasMaxLength(50)
                .HasColumnName("CNIC");
            entity.Property(e => e.CompanyName).HasMaxLength(350);
            entity.Property(e => e.ContactNo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Designation)
                .HasMaxLength(250)
                .IsUnicode(false);
            entity.Property(e => e.Email).HasMaxLength(250);
            entity.Property(e => e.EntryDate).HasColumnType("datetime");
            entity.Property(e => e.ExitDate).HasColumnType("datetime");
            entity.Property(e => e.IsTrigger).HasColumnName("isTrigger");
            entity.Property(e => e.LastAccessed).HasColumnType("datetime");
            entity.Property(e => e.LoginId)
                .HasMaxLength(50)
                .HasColumnName("LoginID");
            entity.Property(e => e.Name).HasMaxLength(250);
            entity.Property(e => e.Picture).HasColumnType("image");
        });

        modelBuilder.Entity<VisitorsRfid>(entity =>
        {
            entity.HasKey(e => e.SmartCardNo);

            entity.ToTable("VisitorsRFID");

            entity.Property(e => e.SmartCardNo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ActiveDate).HasColumnType("datetime");
            entity.Property(e => e.BlockedDate).HasColumnType("datetime");
            entity.Property(e => e.CheckDate).HasColumnType("datetime");
            entity.Property(e => e.CheckOutDate).HasColumnType("datetime");
            entity.Property(e => e.CheckStatus).HasDefaultValue(false, "DF_VisitorsRFID_CheckStatus");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(false, "DF_VisitorsRFID_isActive")
                .HasColumnName("isActive");
            entity.Property(e => e.IsBlocked)
                .HasDefaultValue(false, "DF_VisitorsRFID_isBlocked")
                .HasColumnName("isBlocked");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
