using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.MultiYear
{
    // Request bodies of MultiYearController. Field limits match the tables in
    // Main/Resources/MultiYear/SQL/Migration.MultiYear.Schema.2026-10-31.sql and the inputs' maxLength
    // in FE/src/pages/MultiYear.

    public class PortfolioIdDTO
    {
        public int PortfolioId { get; set; }
    }

    public class ShowPortfoliosDTO
    {
        public EnumPortfolioKind? Kind { get; set; }
        [MaxLength(20)]
        public string? OwnerParticipantId { get; set; }
        public EnumPortfolioStatus? Status { get; set; }
        /// <summary>Only the terms that include this year.</summary>
        public int? Year { get; set; }
    }

    public class CreatePortfolioDTO
    {
        public EnumPortfolioKind Kind { get; set; }
        [MaxLength(20)]
        public string? OwnerParticipantId { get; set; }
        public int TermStartYear { get; set; }
    }

    public class MemberFilterDTO
    {
        public int PortfolioId { get; set; }
        public EnumMembershipStatus? Status { get; set; }
        [MaxLength(100)]
        public string? Search { get; set; }
    }

    public class ShowPortfolioMembersDTO : EnumPagination<MemberFilterDTO> { }

    public class YearAmountDTO
    {
        public int Year { get; set; }
        public decimal Amount { get; set; }
    }

    public class SaveBudgetCeilingsDTO
    {
        public int PortfolioId { get; set; }
        public List<YearAmountDTO> Ceilings { get; set; } = new();
    }

    public class RdpPickDTO
    {
        public int OutcomeId { get; set; }
        public int OutputId { get; set; }
    }

    /// <summary>The planning fields a membership holds (MY-PFL-14).</summary>
    public class MembershipFieldsDTO
    {
        public int? BasisForImplementationId { get; set; }
        public int? NedaProjectStatusId { get; set; }
        public List<int> ReadinessLevelIds { get; set; } = new();
        public List<RdpPickDTO> RdpOutcomes { get; set; } = new();
        public int? Tier { get; set; }
        public decimal? McaScore { get; set; }
    }

    /// <summary>The planning project's one Civil Works component and its major item (MY-PFL-16).</summary>
    public class PlanningComponentDTO
    {
        [MaxLength(1000)]
        public string? Description { get; set; }
        [MaxLength(10)]
        public string InfraTypeFK { get; set; } = string.Empty;
        public int WorkTypeFK { get; set; }
        public double? PhysicalTarget { get; set; }
    }

    public class PlanningProjectFieldsDTO
    {
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;
        public int Category { get; set; }
        public int? Thrust { get; set; }
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
        [MaxLength(20)]
        public string? ReportingRegion { get; set; }
        public int? RegionWide { get; set; }
        public int HorizonTypeId { get; set; }
        public int StartYear { get; set; }
        public int? EndYear { get; set; }
        public PlanningComponentDTO Component { get; set; } = new();
        public List<YearAmountDTO> YearlyCosts { get; set; } = new();
    }

    public class AddPlanningProjectDTO : PlanningProjectFieldsDTO
    {
        public int PortfolioId { get; set; }
        public MembershipFieldsDTO Membership { get; set; } = new();
    }

    public class UpdatePlanningProjectDTO : PlanningProjectFieldsDTO
    {
        public int MultiYearProjectId { get; set; }
    }

    public class MultiYearProjectDetailsDTO
    {
        [MaxLength(20)]
        public string ProjectId { get; set; } = string.Empty;
    }

    public class UpdateMembershipDTO : MembershipFieldsDTO
    {
        public int MemberId { get; set; }
        /// <summary>Changeable only while the membership is new (MY-PFL-12), and not on the owner
        /// membership, whose start year is the project's.</summary>
        public int? StartYear { get; set; }
    }

    public class SetMembershipStatusDTO
    {
        public int MemberId { get; set; }
        public EnumMembershipStatus Status { get; set; }
        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    public class SaveCodeListItemDTO
    {
        /// <summary>BasisForImplementation, NedaProjectStatus, ReadinessLevel, RdpOutcome or RdpOutput.</summary>
        [MaxLength(50)]
        public string List { get; set; } = string.Empty;
        /// <summary>0 adds a value.</summary>
        public int Id { get; set; }
        [MaxLength(250)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(250)]
        public string? Description { get; set; }
        public int ValidFromYear { get; set; }
        public int ValidToYear { get; set; }
        public bool IsActive { get; set; } = true;
        /// <summary>RdpOutput only: its outcome.</summary>
        public int? OutcomeId { get; set; }
    }

    // ---------------------------------------------------------------- Phase 2

    public class MemberIdDTO
    {
        public int MemberId { get; set; }
    }

    /// <summary>Propose a planning project into an RBP / UBP (MY-PFL-20): the program, and the annual-project
    /// fields a planning project does not hold. Values are lookup NameIds, as Add Project takes them.</summary>
    public class ProposeToAnnualProgramDTO
    {
        public int MemberId { get; set; }
        /// <summary>tPrograms.ProgramPK of the RBP.</summary>
        [MaxLength(200)]
        public string ProgramPK { get; set; } = string.Empty;
        [MaxLength(20)]
        public string OperatingUnit { get; set; } = string.Empty;
        public int Origin { get; set; }
        public int Agency { get; set; }
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public int? RowAvailable { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int Tier { get; set; }
    }

    public class ShowPipCandidatesDTO
    {
        public int PortfolioId { get; set; }
        [MaxLength(100)]
        public string? Search { get; set; }
    }

    public class AddToPipDTO
    {
        /// <summary>The PIP.</summary>
        public int PortfolioId { get; set; }
        /// <summary>The RDIP / UDIP membership the project comes from.</summary>
        public int SourceMemberId { get; set; }
        public decimal? McaScore { get; set; }
    }

    public class SetPipCostDTO
    {
        public int MemberId { get; set; }
        public decimal Cost { get; set; }
        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    public class RunGaaUpdateDTO
    {
        public int Year { get; set; }
    }

    public class SaveTotalsDTO
    {
        public int PortfolioId { get; set; }
        [MaxLength(250)]
        public string? Note { get; set; }
    }

    public class SavedTotalsDetailsDTO
    {
        public int SnapshotId { get; set; }
    }

    public class ImportPlanningProjectsFormDTO
    {
        public int PortfolioId { get; set; }
        public Microsoft.AspNetCore.Http.IFormFile? File { get; set; }
    }
}
