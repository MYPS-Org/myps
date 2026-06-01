using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Functions;
using DBHelper.Models.Table;
using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Revision
{
    public class RevisionRequestsFilter
    {
        public string? TransactionId { get; set; }
        public int? RevisionGroupId { get; set; }
        public int? CategoryId { get; set; }
        public int? ReasonId { get; set; }
        public EnumRevisionStatus? RegionStatus { get; set; }
        public EnumRevisionStatus? COStatus { get; set; }
    }
    public class RevisionRequestsDTO : EnumPagination<RevisionRequestsFilter> { }
    public class ViewReviseProjectDTO
    {
        public string TransactionId { get; set; } = string.Empty;
    }
    public class ReviseProjectDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public int RevisionHeader { get; set; }
        public int? RevisionCategory { get; set; }
        [Required]
        public int RevisionReason { get; set; }
    }
    #region RequstRevisions
    public class RequstRevisionsDTO
    {
        [Required]
        public RevisionDetailsDTO RevisionDetails { get; set; } = new RevisionDetailsDTO();
        [Required]
        public ProjectDetails ProjectDetails { get; set; } = new ProjectDetails();
        [Required]
        public List<RevisionComponentCostDTO> ComponentCosts { get; set; } = new List<RevisionComponentCostDTO>();
        public List<RevisionComponentCostPerYearDTO> ComponentCostPerYear { get; set; } = new List<RevisionComponentCostPerYearDTO>();
        [Required]
        public List<RevisionMajorWorkItemDTO> MajorItemOfWorks { get; set; } = new List<RevisionMajorWorkItemDTO>();
        [Required]
        public List<RevisionMajorWorkLocationsDTO> MajorItemLocations { get; set; } = new List<RevisionMajorWorkLocationsDTO>();
        [Required]
        public List<RevisionFundingProfileDTO> FundingProfile { get; set; } = new List<RevisionFundingProfileDTO>();
    }
    public class RevisionDetailsDTO
    {
        //[Required]
        //public string RevisionName { get; set; } = string.Empty;
        public int? CategoryId { get; set; }
        [Required]
        public int ReasonId { get; set; }
        [Required]
        public DateTime ApprovalDate { get; set; }
        [Required]
        public FileUpload ApprovedDocument { get; set; } = new FileUpload();
        [Required]
        public string ConstructionStatus { get; set; } = string.Empty;
        [Required]
        public string PackageStatus { get; set; } = string.Empty;
    }
    public class RevisionComponentCostDTO
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
        [MaxLength(10)]
        public string StageName { get; set; } = "GAA-R";
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
    public class RevisionComponentCostPerYearDTO
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ComponentCostId { get; set; } = string.Empty;
        [Required]
        public Double Amount { get; set; }
        [Required]
        public int Year { get; set; }
        [Required]
        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        [Required]
        public DateTime EndDate { get; set; } = DateTime.UtcNow;
        [Required]
        public bool IsDeleted { get; set; } = false;
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
        public string? StageName { get; set; } = string.Empty;
        public string? CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedDate { get; set; }
        public bool IsDeleted { get; set; } = false;
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
        public string? DetailedScope { get; set; }
        [Required]
        public int TargetUnitId { get; set; }
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        public double? StartX { get; set; }
        public double? StartY { get; set; }
        public double? EndX { get; set; }
        public double? EndY { get; set; }
        [Required]
        public Double PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public double? EndChainage { get; set; }
        public double? StartChainage { get; set; }
        public Double? Length { get; set; }
        public string? CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedDate { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
    public class RevisionFundingProfileDTO
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
        public double Amount { get; set; }
        [Required]
        public double Percentage { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
    #endregion
    public class UpdateRevisionStatusDTO
    {
        [Required]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        public EnumRevisionStatus Status { get; set; }
        public DateTime? ApprovalDate { get; set; }
        public string? Remarks { get; set; }
        public FileUpload? Document { get; set; } = new FileUpload();
    }
    public class ResubmitRevisionDTO
    {
        [Required]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        public RevisionDetailsDTO RevisionDetails { get; set; } = new RevisionDetailsDTO();
        [Required]
        public ProjectDetails ProjectDetails { get; set; } = new ProjectDetails();
        [Required]
        public List<RevisionComponentCostDTO> ComponentCosts { get; set; } = new List<RevisionComponentCostDTO>();
        [Required]
        public List<RevisionComponentCostPerYearDTO> ComponentCostPerYear { get; set; } = new List<RevisionComponentCostPerYearDTO>();
        [Required]
        public List<RevisionMajorWorkItemDTO> MajorItemOfWorks { get; set; } = new List<RevisionMajorWorkItemDTO>();
        [Required]
        public List<RevisionMajorWorkLocationsDTO> MajorItemLocations { get; set; } = new List<RevisionMajorWorkLocationsDTO>();
        [Required]
        public List<RevisionFundingProfileDTO> FundingProfile { get; set; } = new List<RevisionFundingProfileDTO>();
    }
    public class ProjectStatusDTO
    {
        [Required]
        public string ConstructionStatus { get; set; } = string.Empty;
        [Required]
        public string PackageStatus { get; set; } = string.Empty;
    }
}
