using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Importing
{
    public class ImportProgramDetails
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public string StageName { get; set; } = string.Empty;
    }
    public class ImportProjectDetails
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        public string? ExternalId { get; set; }
        public string? MYId { get; set; }
        public string? UACS { get; set; }
        public string? MYCAApprovalDate { get; set; }
        public string? Description { get; set; }
        [Required]
        public string Province { get; set; } = string.Empty;
        [Required]
        public string City { get; set; } = string.Empty;
        [Required]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [Required]
        public string OperatingUnit { get; set; } = string.Empty;
        [Required]
        public string ImplementingOffice { get; set; } = string.Empty;
        [Required]
        public string DEO { get; set; } = string.Empty;
        [Required]
        public string Region { get; set; } = string.Empty;
        [Required]
        public string Category { get; set; } = string.Empty;
        [Required]
        public string Thrust { get; set; } = string.Empty;
        [Required]
        public string Origin { get; set; } = string.Empty;
        [Required]
        public string Agency { get; set; } = string.Empty;
        [Required]
        public string ImplementationMode { get; set; } = string.Empty;
        [Required]
        public string EmergencyMode { get; set; } = string.Empty;
        [Required]
        public string Feasibility { get; set; } = string.Empty;
        public string? FeasibilityDate { get; set; }
        [Required]
        public string DetailedDesign { get; set; } = string.Empty;
        public string? DetailedDesignDate { get; set; }
        [Required]
        public string RowAvailable { get; set; } = string.Empty;
        [Required]
        public string RegionWide { get; set; } = string.Empty;
        [Required]
        public string Tier { get; set; } = string.Empty;
    }
    public class ImportFundingProfile
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string Source { get; set; } = string.Empty;
        [Required]
        public string Agreement { get; set; } = string.Empty;
        [Required]
        public Double Percentage { get; set; }
        [Required]
        public Double Amount { get; set; }
    }
    public class ImportComponentCost
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string CostId { get; set; } = string.Empty;
        [Required]
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        public string ComponentId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        [Required]
        public Double Total { get; set; }
    }
    public class ImportComponentCostPerYear
    {
        [Required]
        public string ComponentCostId { get; set; } = string.Empty;
        [Required]
        public Double Amount { get; set; }
        [Required]
        public int Year { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
    }
    public class ImportMajorItemOfWork
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public string InfraType { get; set; } = string.Empty;
        [Required]
        public string WorkTypeId { get; set; } = string.Empty;
        [Required]
        public string TargetUnitId { get; set; } = string.Empty;
        [Required]
        public string TargetUnit { get; set; } = string.Empty;
    }
    public class ImportMajorItemLocation
    {
        [Required]
        public string ParentId { get; set; } = string.Empty;
        [Required]
        public string InfraId { get; set; } = string.Empty;
        public string? DetailedScope { get; set; }
        [Required]
        public string TargetUnitId { get; set; } = string.Empty;
        [Required]
        public string TargetUnit { get; set; } = string.Empty;
        [Required]
        public Double PhysicalTarget { get; set; }
        public Double? Length { get; set; }
        public Double? StartChainage { get; set; }
        public Double? EndChainage { get; set; }
        public Double? StartX { get; set; }
        public Double? StartY { get; set; }
        public Double? EndX { get; set; }
        public Double? EndY { get; set; }
        public string? StartStationLimit { get; set; }
        public string? EndStationLimit { get; set; }
    }
    public class ImportProjectReference
    {
        public string OldProjectId { get; set; } = string.Empty;
        public string NewProjectId { get; set; } = string.Empty;
        public string ThirdSegment { get; set; } = string.Empty;
        public string MaxId { get; set; } = string.Empty;
    }
    public class ImportProjectDTO
    {
        [Required]
        public ImportProgramDetails ProgramDetails { get; set; } = new ImportProgramDetails();
        [Required]
        public List<ImportProjectDetails> ProjectDetails { get; set; } = new List<ImportProjectDetails>();
        [Required]
        public List<ImportFundingProfile> FundingProfile { get; set; } = new List<ImportFundingProfile>();
        [Required]
        public List<ImportComponentCost> ComponentCosts { get; set; } = new List<ImportComponentCost>();
        [Required]
        public List<ImportComponentCostPerYear> ComponentCostPerYear { get; set; } = new List<ImportComponentCostPerYear>();
        [Required]
        public List<ImportMajorItemOfWork> MajorItemOfWorks { get; set; } = new List<ImportMajorItemOfWork>();
        [Required]
        public List<ImportMajorItemLocation> MajorItemLocations { get; set; } = new List<ImportMajorItemLocation>();
    }
}