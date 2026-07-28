using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Project
{
    public class ProjectDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ProjectType { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProgramName { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [MaxLength(400)]
        public string? AlternateId { get; set; }
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
        public int Feasibility { get; set; }
        [MaxLength(50)]
        public string? FeasibilityName { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int DetailedDesign { get; set; }
        [MaxLength(50)]
        public string? DetailedDesignName { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int RowAvailable { get; set; }
        [MaxLength(50)]
        public string? RowAvailableName { get; set; }
        [Required]
        public int Tier { get; set; }
        [MaxLength(50)]
        public string? TierName { get; set; }
        public Double? Rank { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(200)]
        public string? LastUpdatedBy { get; set; }
        public DateTime? LastUpdatedDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string RevisionCreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime RevisionCreatedDate { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
    }
}
