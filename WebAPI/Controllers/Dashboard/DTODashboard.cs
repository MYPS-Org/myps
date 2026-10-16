using System.ComponentModel.DataAnnotations;
using DBHelper.Models.Enums;

namespace WebAPI.Controllers.Dashboard
{
    public class DashboardRequestDTO
    {
        [Range(2000, 2200)]
        public int? Year { get; set; }

        /// <summary>
        /// tOptionProjectCategory.CategoryId to narrow every section to; null means all
        /// categories.
        /// </summary>
        public int? CategoryId { get; set; }

        /// <summary>
        /// tOptionProgramType.NameId (the EnumProgramType value tPrograms.Type stores) to narrow
        /// every section to; null means all program types.
        /// </summary>
        public int? ProgramType { get; set; }

        /// <summary>
        /// tOptionProgramStage.Name of the project stage to narrow every section to, one of the
        /// budget stages Dashboard/FilterOptions lists; null means all of them.
        /// </summary>
        [MaxLength(50)]
        public string? StageName { get; set; }
    }

    /// <summary>The header's Program Type and Program Stage Name dropdowns.</summary>
    public class DashboardFilterOptionsResponseDTO
    {
        public List<DashboardProgramTypeOptionDTO> ProgramTypes { get; set; } = new();
        /// <summary>The budget stages only, in stage order.</summary>
        public List<DashboardStageOptionDTO> Stages { get; set; } = new();
    }

    public class DashboardProgramTypeOptionDTO
    {
        /// <summary>tOptionProgramType.NameId: the value to send back as ProgramType.</summary>
        public int ProgramType { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class DashboardStageOptionDTO
    {
        /// <summary>tOptionProgramStage.Name, e.g. "NEP-E": the value to send back as StageName.</summary>
        public string StageName { get; set; } = string.Empty;
        /// <summary>e.g. "National Expenditure Program with Errata".</summary>
        public string FullName { get; set; } = string.Empty;
    }

    /// <summary>Category picker query: empty for every category, otherwise a substring of the name.</summary>
    public class DashboardCategorySearchDTO
    {
        public string? Query { get; set; }
    }

    public class DashboardCategoryDTO
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        /// <summary>
        /// False for a retired category. It is still offered (older projects carry it) and
        /// is labelled, because some retired names nearly repeat a current one.
        /// </summary>
        public bool IsActive { get; set; }
    }

    public class DashboardCategoriesResponseDTO
    {
        public List<DashboardCategoryDTO> Categories { get; set; } = new();
    }

    public class DashboardKpisResponseDTO
    {
        public int SelectedYear { get; set; }
        public int[] AvailableYears { get; set; } = Array.Empty<int>();
        public DashboardKpiDTO Kpis { get; set; } = new();
    }

    public class DashboardTrendResponseDTO
    {
        public List<DashboardTrendDTO> AnnualTrend { get; set; } = new();
    }

    public class DashboardBudgetBreakdownResponseDTO
    {
        public List<DashboardBudgetBreakdownDTO> BudgetBreakdown { get; set; } = new();
    }

    public class DashboardStatusesResponseDTO
    {
        public List<DashboardStatusDTO> Statuses { get; set; } = new();
        public List<DashboardIslandDTO> Islands { get; set; } = new();
        /// <summary>Projects per category in the fiscal year, most projects first.</summary>
        public List<DashboardCategoryShareDTO> Categories { get; set; } = new();
    }

    public class DashboardCategoryShareDTO
    {
        /// <summary>tOptionProjectCategory.CategoryId: the value the Category filter takes.</summary>
        public int CategoryId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int ProjectCount { get; set; }
        public decimal Budget { get; set; }
    }

    public class DashboardRegionalBreakdownDTO
    {
        public string Region { get; set; } = string.Empty;
        public string Island { get; set; } = string.Empty;
        /// <summary>
        /// tOptionAdminAreaRegion.Hierarchy, DPWH's region order (NCR 10101 … BARMM 10317). The map's
        /// region tables sort on it; null for a region code that matches no region.
        /// </summary>
        public string? Hierarchy { get; set; }
        public decimal Budget { get; set; }
        public int ProjectCount { get; set; }
    }

    public class DashboardRegionalBreakdownResponseDTO
    {
        public List<DashboardRegionalBreakdownDTO> Regions { get; set; } = new();
    }

    public class DashboardLsProjectsResponseDTO
    {
        public List<DashboardLsProjectDTO> LsProjects { get; set; } = new();
    }

    /// <summary>Pagination filters for the Projects endpoint (search + status/island narrowing).</summary>
    public class ShowDashboardProjectsFilterDTO
    {
        public string? Search { get; set; }
        public string? Island { get; set; }
        public string? Status { get; set; }

        /// <summary>
        /// tPrograms.ProgramPK: list one program's projects (a KPI detail's per-program view).
        /// Its rows then carry Program Details' values, SubProgram and OperatingUnit included.
        /// </summary>
        [MaxLength(200)]
        public string? ProgramPK { get; set; }

        /// <summary>"published", or "forpublish" (publishable, not yet published); null for all.</summary>
        [MaxLength(20)]
        public string? Publication { get; set; }
    }

    /// <summary>One program's share of a KPI figure (the Programs endpoint).</summary>
    public class DashboardProgramDTO
    {
        public string ProgramPK { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        /// <summary>The program's current stage (vProgramLatest).</summary>
        public string StageName { get; set; } = string.Empty;
        /// <summary>Every project in the program at its stage (vProgramLatest.NumberOfProjects).</summary>
        public int ProgramProjectCount { get; set; }
        /// <summary>The program's projects counted in the fiscal year, and their FY amount.</summary>
        public int ProjectCount { get; set; }
        public decimal Budget { get; set; }
        public int PublishedCount { get; set; }
        public decimal PublishedBudget { get; set; }
        /// <summary>Publishable but not yet published.</summary>
        public int ForPublishCount { get; set; }
        public decimal ForPublishBudget { get; set; }
    }

    public class DashboardProgramsResponseDTO
    {
        public List<DashboardProgramDTO> Programs { get; set; } = new();
    }

    public class ShowDashboardProjectsDTO : EnumPagination<ShowDashboardProjectsFilterDTO>
    {
        // The watchlist is scoped to the same fiscal year as the rest of the dashboard.
        // Null falls back to the current year, or the latest program year (see
        // DashboardController.ResolveYearAsync).
        [Range(2000, 2200)]
        public int? Year { get; set; }

        /// <summary>Same meaning as <see cref="DashboardRequestDTO.CategoryId"/>.</summary>
        public int? CategoryId { get; set; }

        /// <summary>Same meaning as <see cref="DashboardRequestDTO.ProgramType"/>.</summary>
        public int? ProgramType { get; set; }

        /// <summary>Same meaning as <see cref="DashboardRequestDTO.StageName"/>.</summary>
        [MaxLength(50)]
        public string? StageName { get; set; }
    }

    public class DashboardSummaryDTO
    {
        public int SelectedYear { get; set; }
        public int[] AvailableYears { get; set; } = Array.Empty<int>();
        public DashboardKpiDTO Kpis { get; set; } = new();
        public List<DashboardTrendDTO> AnnualTrend { get; set; } = new();
        public List<DashboardBudgetBreakdownDTO> BudgetBreakdown { get; set; } = new();
        public List<DashboardStatusDTO> Statuses { get; set; } = new();
        public List<DashboardIslandDTO> Islands { get; set; } = new();
        public List<DashboardProjectDTO> Projects { get; set; } = new();
        public List<DashboardLsProjectDTO> LsProjects { get; set; } = new();
        public List<DashboardActivityDTO> Activities { get; set; } = new();
        public DashboardRevisionSummaryDTO Revisions { get; set; } = new();
    }

    public class DashboardKpiDTO
    {
        public decimal TotalBudget { get; set; }
        public int ActiveProjects { get; set; }
        public int PublishedProjects { get; set; }
        public int PublishableProjects { get; set; }
        public int RevisedProjects { get; set; }
        public decimal LsWalletReleased { get; set; }
        public decimal LsWalletTotal { get; set; }
        public decimal PublicationRate { get; set; }
    }

    public class DashboardTrendDTO
    {
        public int Year { get; set; }
        public decimal InfrastructureBudget { get; set; }
        public decimal LsItemized { get; set; }
        public int ProjectCount { get; set; }
    }

    public class DashboardBudgetBreakdownDTO
    {
        public string Name { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public int ProjectCount { get; set; }
    }

    public class DashboardStatusDTO
    {
        public string Name { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class DashboardIslandDTO
    {
        public string Name { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public int ProjectCount { get; set; }
    }

    public class DashboardProjectDTO
    {
        public int Id { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ProgramName { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Island { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string ImplementingOffice { get; set; } = string.Empty;
        /// <summary>Program Details' SubProgram (thrust); set only in a per-program list.</summary>
        public string? SubProgram { get; set; }
        /// <summary>Program Details' Operating Unit; set only in a per-program list.</summary>
        public string? OperatingUnit { get; set; }
        public string FundingSource { get; set; } = string.Empty;
        public decimal AllocatedBudget { get; set; }
        public bool IsPublished { get; set; }
        public bool IsPublishable { get; set; }
        public bool IsRevised { get; set; }
        /// <summary>
        /// A Lump Sum Project (tProjects.ProjectType 'LS' with no parent), which opens in the Lump
        /// Sum module at /lumpsum/{Id} rather than in the project form; the Project List applies
        /// the same rule. Itemized children are ordinary projects.
        /// </summary>
        public bool IsLumpSum { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class DashboardActivityDTO
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string User { get; set; } = string.Empty;
    }

    public class DashboardLsProjectDTO
    {
        public int Id { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ProgramName { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public decimal TotalAllocation { get; set; }
        public decimal ItemizedAmount { get; set; }
        public decimal RemainingAmount { get; set; }
        public int ItemizedCount { get; set; }
        public List<DashboardLsChildProjectDTO> Children { get; set; } = new();
    }

    public class DashboardLsChildProjectDTO
    {
        public int Id { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public decimal FundingTotal { get; set; }
        public decimal ComponentCostTotal { get; set; }
        public bool IsPublished { get; set; }
    }

    /// <summary>
    /// One row of dbo.fRevisionQueue, enriched with the Implementing Office name
    /// resolved through vAdminImplementingOffice (the same source that feeds the
    /// Implementing Office dropdown on the project details page).
    /// </summary>
    public class DashboardRevisionDTO
    {
        public int Id { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string RevisionType { get; set; } = string.Empty;
        public string RevisionReason { get; set; } = string.Empty;
        /// <summary>One of the five labels emitted by fRevisionQueue.</summary>
        public string RevisionStatus { get; set; } = string.Empty;
        /// <summary>Group currently holding the revision: RPC, PS Admin, or the creator's group.</summary>
        public string CurrentStage { get; set; } = string.Empty;
        public string ImplementingOffice { get; set; } = string.Empty;
        public string ImplementingOfficeId { get; set; } = string.Empty;
        public string ProgramName { get; set; } = string.Empty;
        public DateTime RevisionDate { get; set; }
        public int Age { get; set; }
    }

    public class DashboardRevisionSummaryDTO
    {
        /// <summary>fRevisionQueue "For Endorsement" - awaiting the RO/RPC tier.</summary>
        public int ForReview { get; set; }
        /// <summary>fRevisionQueue "For Approval of Central Office" - awaiting the CO/AUC tier.</summary>
        public int ForApproval { get; set; }
        public int ForCorrection { get; set; }
        public int Approved { get; set; }
        public int Disapproved { get; set; }
        public int Total { get; set; }
        /// <summary>Every status the queue returned, including any unmapped label.</summary>
        public List<DashboardStatusDTO> ByStatus { get; set; } = new();
        /// <summary>Pending revisions only, grouped by Implementing Office.</summary>
        public List<DashboardStatusDTO> ByImplementingOffice { get; set; } = new();
        /// <summary>Pending revisions only, grouped by the holding group (CurrentStage).</summary>
        public List<DashboardStatusDTO> ByGroup { get; set; } = new();
        public List<DashboardRevisionDTO> Items { get; set; } = new();
    }
}
