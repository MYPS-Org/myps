using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lumpsum
{
    /// <summary>
    /// dbo.tLSWallets — the LS (Lumpsum) Wallet header: a budget container owned
    /// by a Program, drawn down by the itemized projects linked to it through
    /// tProjects.ParentWalletId.
    ///
    /// Funding and component cost are FLAT here (one source, one fiscal year per
    /// wallet) by design decision. Multi-row funding/component data would need
    /// child tables mirroring tProjectFundingProfile / tProjectComponentCost.
    /// </summary>
    public class LSWallets
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        // FK -> dbo.tPrograms(ProgramPK)
        public string ProgramFK { get; set; } = string.Empty;
        // FK -> dbo.tOptionProjectCategory(CategoryId)
        public int? CategoryId { get; set; }
        // Thrust. FK -> dbo.tOptionProjectThrustList(PAPKey)
        public int? SubCategoryFK { get; set; }
        [MaxLength(20)]
        public string? OperatingUnit { get; set; }
        [MaxLength(100)]
        public string? FundingSource { get; set; }
        [MaxLength(50)]
        public string? FundingAgreement { get; set; }
        /// <summary>Total allocation of the wallet. Fixed — the available balance
        /// is recomputed live by dbo.vLSWalletBalance rather than stored.</summary>
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }
        public double? FundingPercentage { get; set; }
        /// <summary>The wallet's own lifecycle stage (BP / NEP / HGAB / GAA / GAA-R).
        /// Distinct from the parent program's current stage.</summary>
        [MaxLength(20)]
        public string? CurrentStage { get; set; }
        public int? ComponentYear { get; set; }
        [MaxLength(50)]
        public string? ComponentUACS { get; set; }
        public DateTime? ComponentStartDate { get; set; }
        public DateTime? ComponentEndDate { get; set; }
        /// <summary>Always 'LS' — locked at creation.</summary>
        [Required]
        [MaxLength(10)]
        public string ComponentType { get; set; } = "LS";
        /// <summary>False only for a wallet untouched since creation. Drives the
        /// WF-7 delete tier: false = hard delete allowed, true = soft delete only.</summary>
        [Required]
        public bool HasStageData { get; set; }

        #region General Information

        [MaxLength(200)]
        public string? MYId { get; set; }
        [MaxLength(400)]
        public string? AlternateId { get; set; }
        [MaxLength(200)]
        public string? ExternalId { get; set; }
        /// <summary>Wallet-level UACS. Distinct from <see cref="ComponentUACS"/>,
        /// which belongs to the component / fiscal-year row.</summary>
        [MaxLength(50)]
        public string? UACS { get; set; }
        /// <summary>1 = Tier I, 2 = Tier II.</summary>
        public int? Tier { get; set; }
        public double? Rank { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        public string? Description { get; set; }

        #endregion

        #region Location Details

        // GdbId references
        [MaxLength(20)]
        public string? Province { get; set; }
        [MaxLength(20)]
        public string? City { get; set; }
        [MaxLength(20)]
        public string? LegislativeDistrict { get; set; }

        #endregion

        #region Organizational Responsibilities

        // ParticipantId references
        [MaxLength(20)]
        public string? DEO { get; set; }
        [MaxLength(20)]
        public string? Region { get; set; }
        [MaxLength(20)]
        public string? ImplementingOffice { get; set; }
        /// <summary>1 = Region Wide, 2 = Non-Region Wide, 3 = Region Wide AIP ignores DEO.</summary>
        public int? RegionWide { get; set; }

        #endregion

        #region Project Source

        public int? Origin { get; set; }
        public int? Agency { get; set; }

        #endregion

        #region Implementation Readiness and Modality

        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }

        #endregion

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
