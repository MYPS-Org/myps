using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lumpsum
{
    /// <summary>
    /// dbo.tLSWallets — the LS (Lumpsum) Wallet header: identity + lifecycle
    /// fields only. A budget container owned by a Program, drawn down by the
    /// itemized projects linked to it through tProjects.ParentWalletId.
    ///
    /// SUPERSEDES the old flat design (one funding source, one fiscal year,
    /// 24 detail columns directly on this table). Category/Thrust/OperatingUnit
    /// and all General Information / Location / Organizational Responsibilities /
    /// Project Source / Implementation Readiness fields now live on the wallet's
    /// active revision (<see cref="LSWalletRevisions"/>), mirroring the
    /// tProjects/tProjectRevisions split — MYId/ExternalId stay on the header
    /// here, same as tProjects keeps them off tProjectRevisions. Funding is
    /// <see cref="LSWalletFundingProfile"/> (multi-line); component cost is
    /// <see cref="LSWalletComponentCost"/>/<see cref="LSWalletComponentCostPerYear"/>
    /// (multi-row). Amount is no longer stored — it's derived as
    /// SUM(LSWalletFundingProfile.Amount) for the active revision, computed in
    /// dbo.vLSWalletBalance/vLSWalletLatest. See
    /// documents/plans/lswallet-backend-schema-normalization.md.
    /// </summary>
    public class LSWallets
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        // FK -> dbo.tPrograms(ProgramPK)
        public string ProgramFK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? MYId { get; set; }
        [MaxLength(200)]
        public string? ExternalId { get; set; }
        /// <summary>The wallet's own lifecycle stage (BP / NEP / HGAB / GAA / GAA-R).
        /// Distinct from the parent program's current stage.</summary>
        [MaxLength(20)]
        public string? CurrentStage { get; set; }
        /// <summary>False only for a wallet untouched since creation. Drives the
        /// WF-7 delete tier: false = hard delete allowed, true = soft delete only.</summary>
        [Required]
        public bool HasStageData { get; set; }
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
