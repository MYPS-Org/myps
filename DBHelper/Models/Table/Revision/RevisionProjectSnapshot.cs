using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionProjectSnapshot
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(400)]
        public string? AlternateId { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
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
        public int? Thrust { get; set; }
        [Required]
        public int Origin { get; set; }
        [Required]
        public int Agency { get; set; }
        public int? ImplementationMode { get; set; }
        public int? EmergencyMode { get; set; }
        [Required]
        public int RegionWide { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int? RowAvailable { get; set; }
        [Required]
        public int Tier { get; set; }
        public double? Rank { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
