using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    /// <summary>
    /// dbo.vLumpSumChildSet — the itemized projects belonging to a Lump Sum Project.
    ///
    /// Membership is by PARENT PROJECT: tProjects.ParentProjectId -> the parent's
    /// ProjectId. Not "any project of a program that has a Lump Sum Project", and
    /// not the retired ParentWalletId — the design report ties an itemized project
    /// to exactly ONE Lump Sum Project.
    ///
    /// ConstructionStatus reduces the PCMA per-component statuses to one
    /// project-level answer using the same precedence RevisionController applies
    /// (On-Going wins outright; Terminated only when it is the only status; then
    /// Not Yet Started; then Completed). Kept identical deliberately — two
    /// different answers to "what is this project's construction status" is the
    /// bug that avoids.
    /// </summary>
    public class LumpSumChild
    {
        [Key]
        public int Id { get; set; }
        public string ProjectPK { get; set; } = string.Empty;

        /// <summary>The live link to the parent Lump Sum Project's ProjectId.</summary>
        public string? ParentProjectId { get; set; }

        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string ProjectType { get; set; } = string.Empty;

        /// <summary>Proj-1: 'Itemized' or 'Additional'.</summary>
        public string? ItemizationType { get; set; }

        /// <summary>Proj-9 lifecycle: 'potential' then 'scheduled'.</summary>
        public string ProjectStatus { get; set; } = string.Empty;

        // ── Latest revision detail ──────────────────────────────────────────
        public int RevisionId { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string? AlternateId { get; set; }
        public string Description { get; set; } = string.Empty;

        /// <summary>Nullable: the V2 field spec makes Region optional, and baseline §2b
        /// widened the column to match. A Lump Sum Project created without one
        /// returns NULL here.</summary>
        public string? Region { get; set; }
        public string? Province { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }
        public string? DEO { get; set; }
        public string OperatingUnit { get; set; } = string.Empty;
        public string? ImplementingOffice { get; set; }

        public int Category { get; set; }
        public string? CategoryName { get; set; }
        public int? Thrust { get; set; }
        public int Tier { get; set; }
        public double? Rank { get; set; }
        public string? StageName { get; set; }

        public string? MYId { get; set; }
        public string? ExternalId { get; set; }
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

        /// <summary>
        /// Read only. Publishing belongs to the Programs module — Lump Sum never
        /// writes this.
        /// </summary>
        public bool IsPublished { get; set; }
        public bool IsRevised { get; set; }

        public string ConstructionStatus { get; set; } = string.Empty;
        public bool? IsPackaged { get; set; }

        // ── Money ───────────────────────────────────────────────────────────
        [Column(TypeName = "decimal(18,5)")]
        public decimal FundingTotal { get; set; }

        [Column(TypeName = "decimal(18,5)")]
        public decimal ComponentCostTotal { get; set; }

        /// <summary>
        /// What this child drew from its parent — its whole cost. Deleting it
        /// returns exactly this to the parent's LS component.
        /// </summary>
        [Column(TypeName = "decimal(18,5)")]
        public decimal DrawnFromParent { get; set; }

        /// <summary>
        /// The wallet-draw line on this child's funding profile. UpdateDrawAmount
        /// guards a change at CurrentDrawAmount + Available.
        /// </summary>
        [Column(TypeName = "decimal(18,5)")]
        public decimal CurrentDrawAmount { get; set; }

        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
