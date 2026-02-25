using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
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
    public class AddProjectDTO : ProjectDetails
    {
        public bool IsAllowedToProceed { get; set; } = false;
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
        public List<ProjectComponentCostDTO> ComponentCosts { get; set; } = new List<ProjectComponentCostDTO>();
        public List<ProjectComponentCostPerYearDTO> ComponentCostPerYear { get; set; } = new List<ProjectComponentCostPerYearDTO>();
        public List<ProjectMajorWorkItemDTO> MajorItemOfWorks { get; set; } = new List<ProjectMajorWorkItemDTO>();
        public List<ProjectMajorWorkLocationsDTO> MajorItemLocations { get; set; } = new List<ProjectMajorWorkLocationsDTO>();
        public List<ProjectNotes> ProjectNotes { get; set; } = new List<ProjectNotes>();
        public List<ProjectSupportingDocs> Docs { get; set; } = new List<ProjectSupportingDocs>();
        public List<FundingProfileDTO> FundingProfile { get; set; } = new List<FundingProfileDTO>();
        public bool IsAllowedToProceed { get; set; } = false;
    }
    public class ProjectComponentCostDTO
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CostId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        public Double Total { get; set; }
        [Required]
        [MaxLength(10)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
    public class ProjectComponentCostPerYearDTO
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ComponentCostId { get; set; } = string.Empty;
        public Double? Amount { get; set; }
        public int? Year { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? StageName { get; set; } = string.Empty;
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string UpdatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
    //public class ProjectComponentCostYearDTO
    //{
    //    [Required]
    //    public long Id { get; set; }
    //    public string ParentId { get; set; } = string.Empty;
    //    [Required]
    //    public int CostYear { get; set; }
    //    [Required]
    //    public Double Cost { get; set; }
    //    public DateTime? StartDate { get; set; }
    //    public DateTime? EndDate { get; set; }
    //}
    public class ProjectMajorWorkItemDTO
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int WorkTypeId { get; set; }
        [Required]
        [MaxLength(50)]
        public string InfraType { get; set; } = string.Empty;
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
    public class ProjectMajorWorkLocationsDTO
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ParentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string InfraId { get; set; } = string.Empty;
        public string? DetailedScope { get; set; }
        [Required]
        public int TargetUnitId { get; set; }               
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        public Double? StartX { get; set; }
        public Double? StartY { get; set; }
        public Double? EndX { get; set; }
        public Double? EndY { get; set; }
        [Required]
        public Double? PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public Double? EndChainage { get; set; }
        public Double? StartChainage { get; set; }
        public Double? Length { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
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
    public class FundingProfileDTO
    {
        public int Id { get; set; }
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string Source { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Agreement { get; set; } = string.Empty;
        [Required]
        public Double Amount { get; set; }
        [Required]
        public Double Percentage { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
