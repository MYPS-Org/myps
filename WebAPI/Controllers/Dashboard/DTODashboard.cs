using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Dashboard
{
    public class DashboardRequestDTO
    {
        [Range(2000, 2200)]
        public int? Year { get; set; }
    }

    public class DashboardSummaryDTO
    {
        public int SelectedYear { get; set; }
        public int[] AvailableYears { get; set; } = Array.Empty<int>();
        public DashboardKpiDTO Kpis { get; set; } = new();
        public List<DashboardTrendDTO> AnnualTrend { get; set; } = new();
        public List<DashboardStatusDTO> Statuses { get; set; } = new();
        public List<DashboardIslandDTO> Islands { get; set; } = new();
        public List<DashboardProjectDTO> Projects { get; set; } = new();
        public List<DashboardLsProjectDTO> LsProjects { get; set; } = new();
        public List<DashboardActivityDTO> Activities { get; set; } = new();
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
        public string FundingSource { get; set; } = string.Empty;
        public decimal AllocatedBudget { get; set; }
        public bool IsPublished { get; set; }
        public bool IsPublishable { get; set; }
        public bool IsRevised { get; set; }
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
}
