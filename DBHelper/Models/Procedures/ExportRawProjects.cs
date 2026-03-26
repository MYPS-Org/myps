using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class ExportRawProjects
    {
        [Key]
        [Required]
        public int Id { get; set; }
        public string? ProgramId { get; set; }
        public string? ReferenceId { get; set; }
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        public string? AlternateId { get; set; }
        public string? ExternalId { get; set; }
        public string? MYId { get; set; }
        public string? UACS { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        [Required]
        public int RevisionNumber { get; set; }
        [Required]
        public string StageName { get; set; } = string.Empty;
        [Required]
        public string Description { get; set; } = string.Empty;
        public string? Category { get; set; }
        [Required]
        public string Thrust { get; set; } = string.Empty;
        public string? Origin { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        [Required]
        public string LegislativeDistrict { get; set; } = string.Empty;
        public string? OperatingUnit { get; set; }
        public string? ImplementingOffice { get; set; }
        [Required]
        public string DEO { get; set; } = string.Empty;
        [Required]
        public string Region { get; set; } = string.Empty;
        public string? Agency { get; set; }
        public string? ImplementationMode { get; set; }
        public string? EmergencyMode { get; set; }
        public string? IslandCode { get; set; }
        public string? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public string? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public string? RowAvailable { get; set; }
        public string? RegionWide { get; set; }
        [Required]
        public int Tier { get; set; }
        public Double? Rank { get; set; }
        [Required]
        public bool IsRevised { get; set; }
        public int? RevisedNumber { get; set; }
        [Required]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        public bool IsPublishable { get; set; }
        [Required]
        public bool IsPublished { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
