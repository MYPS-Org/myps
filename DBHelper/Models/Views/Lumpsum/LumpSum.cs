using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    /// <summary>
    /// dbo.vLumpSumSet — one row per Lump Sum Project, with its allocation figures.
    /// Backs the /lumpsum list, the detail header, and the ADR-055 program rollups.
    ///
    /// A Lump Sum Project is an ordinary tProjects row that HOLDS a component of
    /// type 'LS'. Membership is "has an LS component", not "its LS cost is
    /// non-zero" — a fully itemized project has Remaining 0 and must still list.
    ///
    /// THE ALLOCATION FIGURES (model of 2026-09-06)
    ///   OriginalAllocation the LS component's Total — the full allocation, = Σ funding lines
    ///   Remaining          the LS component's per-year Amount — what is left to itemize
    ///   ItemizedTotal      what the children have drawn out
    /// Both money figures are stored; Total = Remaining + Itemized is a check, not an
    /// identity. The SQL verification blocks report a mismatch as DRIFT.
    ///
    /// Keyless — registered via HasNoKey().ToView() in MYPSDbContext.
    /// </summary>
    public class LumpSum
    {
        /// <summary>tProjects.Id — the cursor key for keyset pagination.</summary>
        public int Id { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;

        /// <summary>From vProgramLatest. Null when the program has no revision.</summary>
        public string? ProgramName { get; set; }

        /// <summary>The program's budget year, backing the list's Year filter.</summary>
        public int? StartYear { get; set; }

        public string ProjectType { get; set; } = string.Empty;

        // ── Latest revision detail ──────────────────────────────────────────
        public int RevisionId { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string? AlternateId { get; set; }
        public string Description { get; set; } = string.Empty;
        public int Category { get; set; }
        public string? CategoryName { get; set; }
        public string OperatingUnit { get; set; } = string.Empty;
        /// <summary>Nullable: the V2 field spec makes Region optional, and baseline §2b
        /// widened the column to match. A Lump Sum Project created without one
        /// returns NULL here.</summary>
        public string? Region { get; set; }

        /// <summary>
        /// Resolved from tProjectStages, never accepted from the client — a Lump
        /// Sum Project follows its program's stage.
        /// </summary>
        public string? StageName { get; set; }

        /*  THE FULL DETAIL SET — what the edit form binds.

            The view originally carried only what the LIST needed, so
            LumpSumDetails could not populate the edit form: five of the eight
            REQUIRED fields were absent and UpdateLumpSum would then refuse a save
            for fields the user was never shown.

            Nullability mirrors the view exactly. Tier, RegionWide, Origin and
            Agency are NOT NULL because the field spec requires them; Thrust is
            nullable because Sub-Category is required by the CONTROLLER but the
            column allows null for ordinary projects. */
        public int? Thrust { get; set; }
        public int Tier { get; set; }
        public double? Rank { get; set; }
        public int RegionWide { get; set; }
        public int Origin { get; set; }
        public int Agency { get; set; }

        public string? Province { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }
        public string? DEO { get; set; }
        public string? ImplementingOffice { get; set; }

        public DateTime? MYCAApprovalDate { get; set; }
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }

        public string? MYId { get; set; }
        public string? ExternalId { get; set; }

        // ── Allocation ──────────────────────────────────────────────────────
        [Column(TypeName = "decimal(18,5)")]
        public decimal Remaining { get; set; }

        [Column(TypeName = "decimal(18,5)")]
        public decimal ItemizedTotal { get; set; }

        public int ItemizedCount { get; set; }

        /// <summary>
        /// Nullable to match the view. Declaring a nullable view column
        /// non-nullable aborts the whole read.
        /// </summary>
        [Column(TypeName = "decimal(18,5)")]
        public decimal? OriginalAllocation { get; set; }

        /// <summary>An itemized child's UACS must equal its parent's, so it is surfaced here.</summary>
        public string? UACS { get; set; }

        /// <summary>Read only. A Lump Sum Project is never published by this module.</summary>
        public bool IsPublished { get; set; }

        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
