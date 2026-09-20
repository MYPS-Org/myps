using DBHelper.Models.Enums;
using Microsoft.AspNetCore.Http;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Lumpsum
{
    #region Lump Sum list

    public class ShowLumpSumDTO : EnumPagination<ShowLumpSumFilterDTO> { }

    public class ShowLumpSumFilterDTO
    {
        /// <summary>Program natural key (tPrograms.ProgramPK).</summary>
        [MaxLength(200)]
        public string? ProgramFK { get; set; }
        /// <summary>Free-text match on the program's display name.</summary>
        [MaxLength(200)]
        public string? ProgramName { get; set; }
        /// <summary>Stage, mirrored from the program: BP / NEP / HGAB / GAA / GAA-R.</summary>
        [MaxLength(20)]
        public string? CurrentStage { get; set; }
        [MaxLength(20)]
        public string? OperatingUnit { get; set; }
        public int? CategoryId { get; set; }
        public int? YearStart { get; set; }
    }

    #endregion

    #region Lump Sum detail / balance

    // [Required] on a non-nullable int is a no-op — 0 satisfies it — so an
    // omitted or default LumpSumId used to fall through to the lookup and come
    // back as the misleading "Lump Sum Project not found." Range makes the distinction
    // explicit: 0/negative is a bad request, a positive id that isn't there is
    // genuinely missing.
    public class LumpSumDetailsDTO
    {
        /// <summary>tProjects.Id of the Lump Sum Project. Sample value only — these are
        /// IDENTITY values, so run SELECT Id FROM vLumpSumSet for real ones.</summary>
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        [DefaultValue(10)]
        public int LumpSumId { get; set; }
    }

    /// <summary>Which Lump Sum Project's activity timeline to assemble.</summary>
    public class LumpSumActivityDTO
    {
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        public int LumpSumId { get; set; }
    }

    public class LumpSumBalanceDTO
    {
        /// <summary>tProjects.Id of the Lump Sum Project. Sample value only — these are
        /// IDENTITY values, so run SELECT Id FROM vLumpSumSet for real ones.</summary>
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        [DefaultValue(10)]
        public int LumpSumId { get; set; }
    }

    #endregion

    #region Itemized projects

    public class ShowItemizedProjectsDTO : EnumPagination<ShowItemizedProjectsFilterDTO> { }

    public class ShowItemizedProjectsFilterDTO
    {
        /// <summary>tProjects.Id of the Lump Sum Project. Sample value only — these are
        /// IDENTITY values, so run SELECT Id FROM vLumpSumSet for real ones.</summary>
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        [DefaultValue(10)]
        public int LumpSumId { get; set; }
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        /// <summary>Null = both; true = published only; false = unpublished only.</summary>
        public bool? IsPublished { get; set; }
    }

    #endregion

    #region Lump Sum write — shared child-row shapes

    /* The frontend posts its own view-model types verbatim (PascalCase members
       inside the arrays, camelCase at the envelope level). System.Text.Json binds
       case-insensitively by default, so one DTO shape covers both. Names here
       mirror FE/src/pages/LumpSum/Model.d.ts rather than the SQL columns —
       Source/Agreement map to SourceOrg/AgreementCode on the way in. */

    /// <summary>One funding line on the Lump Sum Project's active revision.</summary>
    public class LumpSumFundingProfileDTO
    {
        /// <summary>0 for a row the client has not persisted yet.</summary>
        public int Id { get; set; }
        /// <summary>tOptionFundingSource.Organization.</summary>
        [Required]
        [MaxLength(100)]
        public string Source { get; set; } = string.Empty;
        /// <summary>tOptionFundingAgreement.Code.</summary>
        [MaxLength(50)]
        public string? Agreement { get; set; }
        public decimal Amount { get; set; }
        public double Percentage { get; set; }
        /// <summary>True marks an existing row for soft-delete on this save.</summary>
        public bool IsDeleted { get; set; }
    }

    /// <summary>One component-cost row on the Lump Sum Project's active revision.</summary>
    public class LumpSumComponentCostDTO
    {
        public int Id { get; set; }
        /// <summary>Client-side correlation key linking this row to its
        /// per-year rows before either has a database Id.</summary>
        [MaxLength(100)]
        public string? CostId { get; set; }
        /// <summary>
        /// The component type's CODE — tOptionProjectComponentType.ComponentId
        /// ('CW', 'ROW', 'LS'). The display name is accepted too and resolved to
        /// its code server-side; see ResolveComponentTypeAsync.
        ///
        /// Deliberately NOT [MaxLength(10)]: the destination column is
        /// nvarchar(10), but a client sending the name instead ('Civil Works',
        /// 11 chars) deserves "not a valid component type", not a string-length
        /// complaint about a field it thought it filled in correctly.
        /// </summary>
        [MaxLength(100)]
        public string? ComponentType { get; set; }
        /// <summary>
        /// IGNORED ON SAVE (2026-09-20). Kept so the page can round-trip what it
        /// read, but the server writes the code it resolved from ComponentType
        /// instead: program cost finds a Lump Sum parent's appropriation by
        /// tProjectComponentCost.ComponentId, and nothing validated this field.
        /// See SaveLumpSumChildrenAsync, "THE COMPONENT ID IS NOT THE PAYLOAD'S
        /// EITHER".
        /// </summary>
        [MaxLength(10)]
        public string? ComponentId { get; set; }
        public string? Description { get; set; }
        public decimal Total { get; set; }
        public bool IsDeleted { get; set; }
    }

    /// <summary>Fiscal-year breakdown of a component-cost row.</summary>
    public class LumpSumComponentCostPerYearDTO
    {
        public int Id { get; set; }
        /// <summary>Matches LumpSumComponentCostDTO.CostId.</summary>
        [MaxLength(100)]
        public string? ComponentCostId { get; set; }
        public decimal? Amount { get; set; }
        public int? Year { get; set; }
        [MaxLength(50)]
        public string? UACS { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public bool IsDeleted { get; set; }
    }

    /// <summary>
    /// Everything that lives on the project revision, shared by create and
    /// update so the two paths cannot drift apart field-by-field.
    /// </summary>
    public abstract class LumpSumDetailFieldsDTO
    {
        /// <summary>tPrograms.ProgramPK — the readable program key, NOT the GUID
        /// ProgramId. The frontend's LumpSum.ProgramId carries this value.</summary>
        [Required]
        [MaxLength(200)]
        public string ProgramId { get; set; } = string.Empty;

        public int? CategoryId { get; set; }
        /// <summary>Thrust — tOptionProjectThrustList.PAPKey.</summary>
        public int? SubCategoryId { get; set; }
        [MaxLength(20)]
        public string? OperatingUnit { get; set; }

        /// <summary>
        /// Stage. ACCEPTED BUT NEVER WRITTEN — a Lump Sum Project is an ordinary
        /// project, so its stage lives in tProjectStages and follows its program
        /// like any other project. The server resolves it on read and ignores
        /// whatever the client sends, so a user can never put a project out of
        /// step with its program.
        /// </summary>
        [MaxLength(20)]
        public string? CurrentStage { get; set; }

        // ── General Information ──
        [MaxLength(200)]
        public string? MyId { get; set; }
        [MaxLength(400)]
        public string? AlternateId { get; set; }
        [MaxLength(200)]
        public string? ExternalId { get; set; }
        /// <summary>
        /// The project's OA Project Code, typed once on Project Details (2026-09-06).
        ///
        /// THERE IS NO PROJECT-LEVEL UACS COLUMN. The only storage is
        /// tProjectComponentCostPerYear.UACS, so the server fans this value out
        /// across every non-deleted per-year row of the project's revision, and
        /// vLumpSumSet.UACS reads it back. On update it is TRI-STATE:
        ///   absent / null   keep every row as it is (the caller did not speak to UACS)
        ///   "" / whitespace clear every row to NULL
        ///   text            set every row to the trimmed value
        /// The 50 here matches the column; a longer value is refused by model
        /// validation before the controller runs.
        /// </summary>
        [MaxLength(50)]
        public string? Uacs { get; set; }
        public int? Tier { get; set; }
        public double? Rank { get; set; }
        public DateTime? MycaApprovalDate { get; set; }
        public string? Description { get; set; }

        // ── Location Details ──
        [MaxLength(20)]
        public string? Province { get; set; }
        [MaxLength(20)]
        public string? City { get; set; }
        [MaxLength(20)]
        public string? LegislativeDistrict { get; set; }

        // ── Organizational Responsibilities ──
        [MaxLength(20)]
        public string? Deo { get; set; }
        [MaxLength(20)]
        public string? Region { get; set; }
        [MaxLength(20)]
        public string? ImplementingOffice { get; set; }
        public int? RegionWide { get; set; }

        // ── Project Source ──
        public int? Origin { get; set; }
        public int? Agency { get; set; }

        // ── Implementation Readiness and Modality ──
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }

        public List<LumpSumFundingProfileDTO> FundingProfiles { get; set; } = new();
        public List<LumpSumComponentCostDTO> ComponentCosts { get; set; } = new();
        public List<LumpSumComponentCostPerYearDTO> ComponentCostPerYear { get; set; } = new();
    }

    #endregion

    #region Lump Sum write — actions

    /// <summary>WF-1 Create Lump Sum Project.</summary>
    public class CreateLumpSumDTO : LumpSumDetailFieldsDTO
    {
        /// <summary>
        /// The Lump Sum allocation - becomes the cost of the project's LS
        /// component, and is what itemization draws down.
        /// </summary>
        public decimal Allocation { get; set; }

        /*  THE FUNDING LINE THE ALLOCATION COMES FROM.

            A Lump Sum Project used to be created with an LS component cost and NO
            funding profile. That is not merely incomplete: the project form
            derives Component Cost's ceiling ("Max Cost") from the funding total,
            so a new Lump Sum Project opened at /projects/project-details showed
            its whole allocation sitting against a ceiling of zero - "No remaining
            budget" - and its own funding-percentage rule (the lines must total
            100%) could not be satisfied by an empty table.

            One line, for the whole allocation, written in the same transaction as
            the component. Source and Agreement are collected rather than defaulted
            because tProjectFundingProfile.AgreementCode is a foreign key onto
            tOptionFundingAgreement: a guessed code is a save failure, and a blank
            one is a raw constraint violation in the user's face. */
        [MaxLength(100)]
        public string? FundingSource { get; set; }
        [MaxLength(50)]
        public string? FundingAgreement { get; set; }
    }

    /// <summary>
    /// Composite save of an existing Lump Sum Project — revision detail + full
    /// replacement child arrays, in one transaction.
    /// </summary>
    public class UpdateLumpSumDTO : LumpSumDetailFieldsDTO
    {
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        public int LumpSumId { get; set; }
    }

    /// <summary>WF-3 Replenish — appends a funding line, never edits existing ones.</summary>
    public class ReplenishLumpSumDTO
    {
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        public int LumpSumId { get; set; }
        /// <summary>The new TOTAL allocation, not the delta. Must exceed the current total.</summary>
        public decimal NewAmount { get; set; }
        /// <summary>Funding source for the top-up line. Left out with Agreement, both
        /// are copied from the project's FIRST funding line — the earliest live line.
        /// Given without Agreement, the first line's agreement is used only if the
        /// first line is under this source; otherwise the request is refused and the
        /// agreement must be named.</summary>
        [MaxLength(100)]
        public string? Source { get; set; }
        [MaxLength(50)]
        public string? Agreement { get; set; }
    }

    public class DeleteLumpSumDTO
    {
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        public int LumpSumId { get; set; }
    }
    #endregion

    #region Itemized project write

    public class ValidateLumpSumForItemizationDTO
    {
        [Range(1, int.MaxValue, ErrorMessage = "LumpSumId is required and must be greater than 0.")]
        public int LumpSumId { get; set; }
    }

    /// <summary>One funding line on an itemized project. The project's
    /// CurrentDrawAmount is SUM(Amount) over these — never sent directly.</summary>
    public class ItemizedFundingLineDTO
    {
        public int Id { get; set; }
        [MaxLength(100)]
        public string? Source { get; set; }
        [MaxLength(50)]
        public string? Agreement { get; set; }
        public decimal Amount { get; set; }
        public double Percentage { get; set; }
    }

    /*  THERE IS NO ItemizeProjectDTO, AND NO UpdateDrawAmountDTO.

        Itemizing an EXISTING project is not permitted: the client's hard rule is
        that a Lump Sum Project is itemized into NEW projects only. Children are
        created by ImportItemizedProjects, under the parent, and cannot pre-exist —
        so there is no request shape for "attach this project to that one".

        UpdateDrawAmount is discarded too: it existed to edit an itemized child's
        draw lines after the fact, and its published-project refusal pointed at
        WF-6, which has left the module. ItemizedFundingLineDTO stays — the
        import still uses it to write those lines in the first place. */

    public class ItemizedProjectIdDTO
    {
        /// <summary>tProjects.ProjectPK of the itemized project.</summary>
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
    }

    /// <summary>
    /// The itemization import. The request is the import WORKBOOK itself — the file
    /// <c>GET /api/Importing/DownloadTemplate</c> hands out, filled in — not rows the browser
    /// parsed out of it. The server reads the four sheets with the Program importer's own
    /// readers and validates them with the same rules, so the two imports cannot disagree
    /// about what a workbook means. The parsed-JSON shape this replaced
    /// (<c>ImportItemizedProjectsDTO</c> and its five nested row DTOs) discarded Target Unit,
    /// per-row Infrastructure/Work Type and the cells' own text before the server ever saw them.
    /// </summary>
    public class ImportItemizedProjectsFormDTO
    {
        [Required]
        public IFormFile File { get; set; } = default!;
        [Range(1, int.MaxValue, ErrorMessage = "ParentLumpSumId is required and must be greater than 0.")]
        public int ParentLumpSumId { get; set; }
        /// <summary>tPrograms.ProgramPK — cross-checked against the parent's own program, never trusted alone.</summary>
        [Required]
        [MaxLength(200)]
        public string ProgramId { get; set; } = string.Empty;
    }

    #endregion
}
