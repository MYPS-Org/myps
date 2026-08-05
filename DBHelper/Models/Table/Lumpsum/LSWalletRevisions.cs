using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lumpsum
{
    /// <summary>
    /// dbo.tLSWalletRevisions — the wallet's revision-ready detail row, mirroring
    /// dbo.tProjectRevisions. Geo/org/readiness/category fields are nullable
    /// (unlike their tProjectRevisions NOT NULL equivalents) because a wallet is
    /// program-wide, not site-specific.
    ///
    /// Revision-ready, not revision-active: the schema supports multiple
    /// revision rows per wallet (same FK-chain shape as tProjectRevisions), but
    /// no revisioning workflow exists yet — exactly one non-deleted revision row
    /// is maintained per wallet, resolved the same "latest non-deleted revision"
    /// way vLSWalletLatest/vLSWalletProjectSet already resolve Projects.
    /// </summary>
    public class LSWalletRevisions
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tLSWallets(Id)
        public int WalletFK { get; set; }
        // FK -> dbo.tOptionProjectCategory(CategoryId)
        public int? CategoryId { get; set; }
        // Thrust. FK -> dbo.tOptionProjectThrustList(PAPKey)
        public int? SubCategoryFK { get; set; }
        [MaxLength(20)]
        public string? OperatingUnit { get; set; }
        [MaxLength(400)]
        public string? AlternateId { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        public string? Description { get; set; }
        [MaxLength(20)]
        public string? Region { get; set; }
        [MaxLength(20)]
        public string? Province { get; set; }
        [MaxLength(20)]
        public string? City { get; set; }
        [MaxLength(20)]
        public string? LegislativeDistrict { get; set; }
        [MaxLength(20)]
        public string? DEO { get; set; }
        [MaxLength(20)]
        public string? ImplementingOffice { get; set; }
        public int? Origin { get; set; }
        public int? Agency { get; set; }
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? RegionWide { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }
        /// <summary>1 = Tier I, 2 = Tier II.</summary>
        public int? Tier { get; set; }
        public double? Rank { get; set; }
        /// <summary>Wallet-level UACS. Project has no equivalent column — it derives
        /// UACS per component-cost-year row; kept here since the wallet form
        /// collects it as a single field.</summary>
        [MaxLength(50)]
        public string? UACS { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
