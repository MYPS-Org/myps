using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    /// <summary>
    /// dbo.vLSWalletLatest — source for the LS Wallet list grid.
    /// Keyed on Id so Helpers.QueryPaginationExtensions.FilterDataCursor can
    /// keyset-paginate it, the same way vProgramLatest is used by ShowProgram.
    ///
    /// Program display fields and the Total/Used/Available balance are joined in
    /// by the view, so they can never go stale against tLSWallets.
    ///
    /// The old flat Amount/FundingSource/FundingAgreement/FundingPercentage/
    /// ComponentYear/ComponentUACS/ComponentStartDate/ComponentEndDate/
    /// ComponentType properties are gone — funding is now multi-line
    /// (dbo.tLSWalletFundingProfile) and component cost is multi-row
    /// (dbo.tLSWalletComponentCost/PerYear); <see cref="Total"/> already
    /// carries what Amount used to represent. See
    /// documents/plans/lswallet-backend-schema-normalization.md.
    /// </summary>
    public class LSWalletLatest
    {
        [Key]
        public int Id { get; set; }

        // ── Program (denormalized for display) ──────────────────────────────
        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string? ProgramName { get; set; }
        public string? TypeName { get; set; }
        public int YearStart { get; set; }
        /// <summary>The parent program's current stage — informational only.
        /// The wallet's own workflow state is <see cref="CurrentStage"/>.</summary>
        public string? ProgramStageName { get; set; }

        // ── Classification ──────────────────────────────────────────────────
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public int? SubCategoryFK { get; set; }
        public string? SubCategoryName { get; set; }
        public string? OperatingUnit { get; set; }

        // ── Wallet ──────────────────────────────────────────────────────────
        /// <summary>The wallet's own lifecycle stage (BP/NEP/HGAB/GAA/GAA-R).</summary>
        public string? CurrentStage { get; set; }
        /// <summary>False only for a wallet untouched since creation (WF-7 delete tier).</summary>
        public bool HasStageData { get; set; }

        // ── Wallet detail ───────────────────────────────────────────────────
        public string? MYId { get; set; }
        public string? AlternateId { get; set; }
        public string? ExternalId { get; set; }
        /// <summary>Wallet-level UACS, distinct from ComponentUACS.</summary>
        public string? UACS { get; set; }
        public int? Tier { get; set; }
        public double? Rank { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        public string? Description { get; set; }

        public string? Province { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }

        public string? DEO { get; set; }
        public string? Region { get; set; }
        public string? ImplementingOffice { get; set; }
        public int? RegionWide { get; set; }

        public int? Origin { get; set; }
        public int? Agency { get; set; }

        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }

        // ── Balance (from dbo.vLSWalletBalance) ─────────────────────────────
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Used { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Available { get; set; }

        /// <summary>Count of active itemized projects. Non-zero blocks deletion
        /// of the wallet (flow doc §6).</summary>
        public long ProjectCount { get; set; }

        // ── Audit ───────────────────────────────────────────────────────────
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
