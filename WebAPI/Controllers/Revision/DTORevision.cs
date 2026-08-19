using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Functions.Project;
using DBHelper.Models.Table;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebAPI.Controllers.Revision
{
    public class RevisionRequestsFilter
    {
        public string? TransactionId { get; set; }
        public string? ProjectId { get; set; }
        public string? RevisionType { get; set; }
        public string? RevisionStatus { get; set; }
        public string? CurrentStage { get; set; }
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
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(100)]
        public string ComponentType { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ComponentName { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
        [MaxLength(20)]
        public string? ConstructionStatusCode { get; set; }
        [MaxLength(50)]
        public string? ConstructionStatusName { get; set; }
        public bool? IsPackaged { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [Required]
        public bool IsDeleted { get; set; }
    }
    public class RevisionComponentCostPerYearDTO
    {
        [Key]
        public int Id { get; set; }
        [Required]
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
        public DateTime? DateOfApproval { get; set; }
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
    public class RevisionMajorWorkItemDTO
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        public int? ComponentCostFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int WorkTypeFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string InfraTypeFK { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
    public class RevisionMajorWorkLocationsDTO
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        public int WorkItemFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        [MaxLength(50)]
        public string InfraId { get; set; } = string.Empty;
        public string? DetailedScope { get; set; }
        [Required]
        public int TargetUnitId { get; set; }
        [Required]
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        public Double? StartX { get; set; }
        public Double? StartY { get; set; }
        public Double? EndX { get; set; }
        public Double? EndY { get; set; }
        public Double? PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public Double? StartChainage { get; set; }
        public Double? EndChainage { get; set; }
        public Double? Length { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
    public class RevisionFundingProfileDTO
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        public int? ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(100)]
        public string SourceOrg { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string AgreementCode { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public Double Percentage { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        public bool? IsWalletDraw { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
    #endregion
    public class UpdateRevisionStatusDTO
    {
        [Required]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        public int Status { get; set; }
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
