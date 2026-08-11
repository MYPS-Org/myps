using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Functions.Project;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Project;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Projects
{
    public class ShowProjectDTO : EnumPagination<ShowProjectFilterDTO> { }
    public class ShowProjectFilterDTO
    {
        public string? ProgramId { get; set; }
        public string? ProjectId { get; set; }
    }
    public class ShowProjectStagesDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
    }
    public class AddProjectDTO : AddProjectDetails
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        public bool IsAllowedToProceed { get; set; } = false;
    }

    public class AddProjectDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        public string? ProjectType { get; set; }
        [Required]
        public string Description { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string Region { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? Province { get; set; }
        [MaxLength(20)]
        public string? City { get; set; }
        [MaxLength(20)]
        public string? LegislativeDistrict { get; set; }
        [Required]
        [MaxLength(20)]
        public string DEO { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string OperatingUnit { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string ImplementingOffice { get; set; } = string.Empty;
        [MaxLength(2)]
        public string? IslandCode { get; set; }
        [Required]
        public int Category { get; set; }
        [MaxLength(200)]
        public string? CategoryName { get; set; }
        public int? Thrust { get; set; }
        [MaxLength(400)]
        public string? ThrustName { get; set; }
        [Required]
        public int Origin { get; set; }
        [MaxLength(50)]
        public string? OriginName { get; set; }
        [Required]
        public int Agency { get; set; }
        [MaxLength(200)]
        public string? AgencyName { get; set; }
        public int ImplementationMode { get; set; }
        [MaxLength(50)]
        public string? ImplementationModeName { get; set; }
        public int EmergencyMode { get; set; }
        [MaxLength(50)]
        public string? EmergencyModeName { get; set; }
        [Required]
        public int RegionWide { get; set; }
        [MaxLength(200)]
        public string? RegionWideName { get; set; }
        public int? Feasibility { get; set; }
        [MaxLength(50)]
        public string? FeasibilityName { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        [MaxLength(50)]
        public string? DetailedDesignName { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }
        [MaxLength(50)]
        public string? RowAvailableName { get; set; }
        [Required]
        public int Tier { get; set; }
        [MaxLength(50)]
        public string? TierName { get; set; }
        public Double? Rank { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
    }
    public class SearchProgramDTO
    {
        [Required]
        public string Filter { get; set; } = string.Empty;
    }
    public class ProjectDetailsDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string StageName { get; set; } = string.Empty;
    }
    public class UpdateProjectDetailsDTO
    {
        public ProjectDetails ProjectDetails { get; set; } = new ProjectDetails();
        public List<FundingProfileDTO> FundingProfile { get; set; } = new List<FundingProfileDTO>();
        public List<ProjectComponentCostDTO> ComponentCosts { get; set; } = new List<ProjectComponentCostDTO>();
        public List<ProjectComponentCostPerYearDTO> ComponentCostPerYear { get; set; } = new List<ProjectComponentCostPerYearDTO>();
        public List<ProjectMajorWorkItemDTO> MajorItemOfWorks { get; set; } = new List<ProjectMajorWorkItemDTO>();
        public List<ProjectMajorWorkLocationsDTO> MajorItemLocations { get; set; } = new List<ProjectMajorWorkLocationsDTO>();
        public List<ProjectNotes> ProjectNotes { get; set; } = new List<ProjectNotes>();
        public List<ProjectSupportingDocs> Docs { get; set; } = new List<ProjectSupportingDocs>();
        public bool IsAllowedToProceed { get; set; } = false;
    }
    public class FundingProfileDTO
    {
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectRevisions(Id)
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(100)]
        // FK -> dbo.tOptionFundingSource(Organization)
        public string SourceOrg { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        // FK -> dbo.tOptionFundingAgreement(Code)
        public string AgreementCode { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public Double Percentage { get; set; }
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
    public class ProjectComponentCostDTO
    {
        /// <summary>
        /// Temporary client-generated identifier used to maintain
        /// parent-child relationships before database IDs exist.
        /// Not persisted to SQL Server.
        /// </summary>
        public Guid ClientId { get; init; } = Guid.NewGuid();
        [Required]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectRevisions(Id)
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(20)]
        // FK -> dbo.tOptionProjectComponentType(ComponentId)
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
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
        //public ICollection<ProjectComponentCostPerYearDTO> CostsPerYear { get; set; } = new List<ProjectComponentCostPerYearDTO>();
        //public ICollection<ProjectMajorWorkItemDTO> WorkItems { get; set; } = new List<ProjectMajorWorkItemDTO>();
    }
    public class ProjectComponentCostPerYearDTO
    {
        public Guid? ComponentClientId { get; set; }
        [Required]
        public int Id { get; set; }
        // FK -> dbo.tProjectComponentCost(Id)
        public int ComponentCostFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public int Year { get; set; }
        [MaxLength(50)]
        public string? UACS { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
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
        //public ProjectComponentCostDTO ComponentCost { get; set; } = null!;
    }
    public class ProjectMajorWorkItemDTO
    {
        /// <summary>
        /// Temporary client-generated identifier used to maintain
        /// parent-child relationships before database IDs exist.
        /// Not persisted to SQL Server.
        /// </summary>
        public Guid ClientId { get; init; } = Guid.NewGuid();
        public Guid? ComponentClientId { get; set; }
        [Required]
        public int Id { get; set; }
        // FK -> dbo.tProjectComponentCost(Id)
        public int ComponentCostFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        // FK -> dbo.tOptionScopeOfWork(Enum)
        public int WorkTypeFK { get; set; }
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionInfraType(InfraCode)
        public string InfraTypeFK { get; set; } = string.Empty;
        [Required]
        public bool IsDeleted { get; set; }
        //public ProjectComponentCostDTO ComponentCost { get; set; } = null!;
        //public ICollection<ProjectMajorWorkLocationsDTO> WorkLocations { get; set; } = new List<ProjectMajorWorkLocationsDTO>();
    }
    public class ProjectMajorWorkLocationsDTO
    {
        public Guid? WorkItemClientId { get; set; }
        [Required]
        public int Id { get; set; }
        // FK -> dbo.tProjectMajorWorkItem(Id)
        public int WorkItemFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string InfraId { get; set; } = string.Empty;
        public string? DetailedScope { get; set; }
        [Required]
        public int TargetUnitId { get; set; }
        [Required]
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        public double? StartX { get; set; }
        public double? StartY { get; set; }
        public double? EndX { get; set; }
        public double? EndY { get; set; }
        [Required]
        public double PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public double? StartChainage { get; set; }
        public double? EndChainage { get; set; }
        public double? Length { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
        //public ProjectMajorWorkItemDTO WorkItem { get; set; } = null!;
    }
    public class AddNotesDTO : ProjectDetailsDTO
    {
        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;
        [Required]
        public FileUpload File { get; set; } = new FileUpload();
    }
    public class AddSupportingDocsDTO : ProjectDetailsDTO
    {
        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string DocumentType { get; set; } = string.Empty;
        [Required]
        public FileUpload File { get; set; } = new FileUpload();
    }
    public class DeleteSupportingDocsDTO : ProjectDetailsDTO
    {
        [Required]
        public int Id { get; set; }
    }
    public class DeleteNotesDTO : ProjectDetailsDTO
    {
        [Required]
        public int Id { get; set; }
    }
}
