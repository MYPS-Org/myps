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

namespace WebAPI.Controllers.Programs
{
    public class ShowProjectDTO : EnumPagination
    {
        public ShowProjectFilterDTO Filters { get; set; } = new ShowProjectFilterDTO();
        public string SortField { get; set; } = "Id";
    }
    public class ShowProjectFilterDTO
    {
        public string? ProgramId { get; set; }
        public string? ReferenceId { get; set; }
    }
    public class AddProjectDTO : ProjectDetails
    {
    }
    public class ProjectDetailsDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
    }
    public class UpdateProjectDetailsDTO
    {
        public ProjectDetails ProjectDetails { get; set; } = new ProjectDetails();
        public List<ProjectComponentCostDTO> ComponentCosts { get; set; } = new List<ProjectComponentCostDTO>();
        public List<ProjectComponentCostYearDTO> ComponentCostYear { get; set; } = new List<ProjectComponentCostYearDTO>();
        public List<ProjectMajorItemOfWorks> MajorItemOfWorks { get; set; } = new List<ProjectMajorItemOfWorks>();
        public List<ProjectNotes> ProjectNotes { get; set; } = new List<ProjectNotes>();
        public List<ProjectFundingProfile> FundingProfile { get; set; } = new List<ProjectFundingProfile>();
    }
    public class ProjectComponentCostDTO
    {
        [Required]
        public long Id { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(400)]
        public string Description { get; set; } = string.Empty;
        [Required]
        public Double Total { get; set; }
    }
    public class ProjectComponentCostYearDTO
    {
        [Required]
        public long Id { get; set; }
        [Required]
        public long ParentId { get; set; }
        [Required]
        public int CostYear { get; set; }
        [Required]
        public Double Cost { get; set; }
        public DateTime? ApprovalDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string PAPCode { get; set; } = string.Empty;
        [Required]
        public DateTime StartDate { get; set; }
        [Required]
        public DateTime EndDate { get; set; }
    }
    public class AddNotesDTO : ProjectDetailsDTO
    {
        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;
        [Required]
        public FileUpload File { get; set; } = new FileUpload();
    }
    public class DeleteNotesDTO
    {
        [Required]
        public int Id { get; set; }
    }
}
