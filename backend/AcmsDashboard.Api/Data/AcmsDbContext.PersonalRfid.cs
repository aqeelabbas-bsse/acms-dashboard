using AcmsDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AcmsDashboard.Api.Data;

/// <summary>
/// PersonalRFID registration, deliberately kept OUT of the scaffolded
/// AcmsDbContext.cs.
///
/// Why: `dotnet ef dbcontext scaffold` overwrites AcmsDbContext.cs wholesale.
/// Anything added by hand to that file is lost on the next scaffold — the same
/// class of problem that made AppIdentityDbContext a separate context. Because
/// the scaffolded context is declared `partial` and already calls
/// OnModelCreatingPartial(modelBuilder) as its last statement, this file hooks
/// in cleanly and survives every re-scaffold untouched.
/// </summary>
public partial class AcmsDbContext
{
    public virtual DbSet<PersonalRfid> PersonalRfids { get; set; } = null!;

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PersonalRfid>(entity =>
        {
            entity.HasKey(e => e.RegId);

            entity.ToTable("PersonalRFID");

            // RegID is the PK but is NOT IDENTITY in the DDL — EF must not try
            // to let the database generate it, or every insert fails.
            entity.Property(e => e.RegId)
                .ValueGeneratedNever()
                .HasColumnName("RegID");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd()
                .HasColumnName("ID");

            entity.Property(e => e.Cnic)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CNIC");

            entity.Property(e => e.SmartCardNo)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.Property(e => e.Remarks)
                .HasMaxLength(1500)
                .IsUnicode(false);

            entity.Property(e => e.AccessRemarks).IsUnicode(false);

            entity.Property(e => e.ActivationDate).HasColumnType("datetime");
            entity.Property(e => e.DeactiveDate).HasColumnType("datetime");
            entity.Property(e => e.ReactivateDate).HasColumnType("datetime");
            entity.Property(e => e.ActionDate).HasColumnType("datetime");
        });
    }
}