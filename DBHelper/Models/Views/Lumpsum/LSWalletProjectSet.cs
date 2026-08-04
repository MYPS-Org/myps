using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    /// <summary>
    /// dbo.vLSWalletProjectSet — the set of active itemized projects belonging to
    /// an LS Wallet. Replaces the proposed physical tProjectSet table:
    /// tProjects.ParentWalletId already IS the membership link.
    ///
    /// Only ProjectType = 'LS' rows with a live (non-deleted) revision appear.
    /// Detail fields come from that latest revision, not from tProjects.
    /// </summary>
    public class LSWalletProjectSet
    {
        [Key]
        public int Id { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public int ParentWalletId { get; set; }
        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string ProjectType { get; set; } = string.Empty;

        // ── Latest revision detail ──────────────────────────────────────────
        public int RevisionId { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string? AlternateId { get; set; }
        public string? Description { get; set; }
        public string? Region { get; set; }
        public string? Province { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }
        public string? DEO { get; set; }
        public string? OperatingUnit { get; set; }
        public string? ImplementingOffice { get; set; }
        public int Category { get; set; }
        public string? CategoryName { get; set; }
        public int? Thrust { get; set; }
        public int Tier { get; set; }
        public double? Rank { get; set; }
        public string? StageName { get; set; }

        // ── Remaining detail (identity from tProjects, rest from the revision) ──
        public string? MYId { get; set; }
        public string? ExternalId { get; set; }
        /// <summary>First non-null UACS on the current revision's component costs.</summary>
        public string? UACS { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        public int RegionWide { get; set; }
        public int Origin { get; set; }
        public int Agency { get; set; }
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }

        // ── Publish state and wallet draw ───────────────────────────────────
        public bool IsPublished { get; set; }
        public bool IsRevised { get; set; }
        /// <summary>Draw frozen at publish time. Null until published.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? WalletDrawFrozen { get; set; }
        /// <summary>Live wallet-draw funding line on the latest revision.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentDrawAmount { get; set; }
        /// <summary>What this project actually consumes from the wallet right now:
        /// the frozen draw once published, otherwise the live draw. Summing this
        /// across a wallet always equals vLSWalletBalance.Used.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal EffectiveDraw { get; set; }

        // ── Audit ───────────────────────────────────────────────────────────
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
