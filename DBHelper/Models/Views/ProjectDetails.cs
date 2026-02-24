using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Views
{
    public class ProjectDetails
    {
        [Key]
        public int Id { get; set; }
        public string? TransactionId { get; set; }
        public EnumProgramStage StageId { get; set; }
        public string? StageName { get; set; }
        public string? ProgramId { get; set; }
        public string? ReferenceId { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string? AlternateId { get; set; }
        public string? ExternalId { get; set; }
        public string? MYId { get; set; }
        public string? UACS { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        public int RevisionId { get; set; }
        public string Description { get; set; } = string.Empty;
        public int Category { get; set; }
        public int? Thrust { get; set; }
        public int Origin { get; set; }
        public string City { get; set; } = string.Empty;
        public string Province { get; set; } = string.Empty;
        public string LegislativeDistrict { get; set; } = string.Empty;
        public string OperatingUnit { get; set; } = string.Empty;
        public string ImplementingOffice { get; set; } = string.Empty;
        public string DEO { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public int? Agency { get; set; }
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        public string? IslandCode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }
        public int RegionWide { get; set; }
        public int Tier { get; set; }
        public Double? Rank { get; set; }
        public bool IsRevised { get; set; }
        public int? RevisedNumber { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
        public bool IsPublishable { get; set; } = false;
        public bool IsDeleted { get; set; } = false;
    }
}
