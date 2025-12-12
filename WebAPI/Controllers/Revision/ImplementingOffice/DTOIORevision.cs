using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Revision.ImplementingOffice
{
    public class RequstRevisionsDTO
    {
        public RevisionDetailsDTO RevisionDetails { get; set; } = new RevisionDetailsDTO();
        public ProjectDetails ProjectDetails { get; set; } = new ProjectDetails();
        public List<RevisionComponentCostDTO> ComponentCosts { get; set; } = new List<RevisionComponentCostDTO>();
        public List<RevisionComponentCostYearDTO> ComponentCostYear { get; set; } = new List<RevisionComponentCostYearDTO>();
        public List<RevisionMajorWorkItemDTO> MajorItemOfWorks { get; set; } = new List<RevisionMajorWorkItemDTO>();
        public List<RevisionMajorWorkLocationsDTO> MajorItemLocations { get; set; } = new List<RevisionMajorWorkLocationsDTO>();
        public List<RevisionFundingProfileDTO> FundingProfile { get; set; } = new List<RevisionFundingProfileDTO>();
    }
    public class RevisionDetailsDTO
    {
        //[Required]
        //public string RevisionName { get; set; } = string.Empty;
        [Required]
        public int ReasonId { get; set; }
        [Required]
        public DateTime ApprovalDate { get; set; } = DateTime.UtcNow;
        [Required]
        public FileUpload ApprovedDocument { get; set; } = new FileUpload();
    }
    public class RevisionComponentCostDTO
    {
        [Required]
        public long Id { get; set; }
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; } = string.Empty;
        [Required]
        public double Total { get; set; }
    }
    public class RevisionComponentCostYearDTO
    {
        [Required]
        public long Id { get; set; }
        public string ParentId { get; set; } = string.Empty;
        [Required]
        public int CostYear { get; set; }
        [Required]
        public double Cost { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
    public class RevisionMajorWorkItemDTO
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
    }
    public class RevisionMajorWorkLocationsDTO
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ParentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string InfraId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string DetailedScope { get; set; } = string.Empty;
        [Required]
        public int TargetUnitId { get; set; }
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? StartX { get; set; }
        [MaxLength(100)]
        public string? StartY { get; set; }
        [MaxLength(100)]
        public string? EndX { get; set; }
        [MaxLength(100)]
        public string? EndY { get; set; }
        [Required]
        public double? PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public double? EndChainage { get; set; }
        public double? StartChainage { get; set; }
    }
    public class RevisionFundingProfileDTO
    {
        public int Id { get; set; }
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string Source { get; set; } = string.Empty;
        [Required]
        public int Agreement { get; set; }
        [Required]
        public double Amount { get; set; }
        [Required]
        public double Percentage { get; set; }
    }
}
