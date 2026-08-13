using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class ExportRawProjects
    {
        [Key]
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(400)]
        public string? AlternateId { get; set; }
        [MaxLength(200)]
        public string? ExternalId { get; set; }
        [MaxLength(200)]
        public string? MYId { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        public string Description { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Category { get; set; }
        [Required]
        [MaxLength(400)]
        public string Thrust { get; set; } = string.Empty;
        [MaxLength(50)]
        public string? Origin { get; set; }
        [MaxLength(255)]
        public string? City { get; set; }
        [MaxLength(255)]
        public string? Province { get; set; }
        [Required]
        [MaxLength(255)]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [MaxLength(255)]
        public string? OperatingUnit { get; set; }
        [MaxLength(255)]
        public string? ImplementingOffice { get; set; }
        [Required]
        [MaxLength(255)]
        public string DEO { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Region { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Agency { get; set; }
        [MaxLength(50)]
        public string? ImplementationMode { get; set; }
        [MaxLength(50)]
        public string? EmergencyMode { get; set; }
        [MaxLength(2)]
        public string? IslandCode { get; set; }
        [MaxLength(50)]
        public string? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        [MaxLength(50)]
        public string? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        [MaxLength(50)]
        public string? RowAvailable { get; set; }
        [MaxLength(200)]
        public string? RegionWide { get; set; }
        [Required]
        public int Tier { get; set; }
        public Double? Rank { get; set; }
        [Required]
        public bool IsRevised { get; set; }
        [Required]
        [MaxLength(100)]
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
