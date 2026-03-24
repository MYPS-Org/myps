using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectRevisions
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? AlternateId { get; set; }
        [MaxLength(200)]
        public string? ExternalId { get; set; }
        public string? UACS { get; set; }
        [MaxLength(200)]
        public string? MYId { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        [Required]
        public int RevisionNumber { get; set; }
        [Required]
        public string Description { get; set; } = string.Empty;
        [Required]
        public int Category { get; set; }
        public int? Thrust { get; set; }
        [Required]
        public int Origin { get; set; }
        [Required]
        public string City { get; set; } = string.Empty;
        [Required]
        public string Province { get; set; } = string.Empty;
        [Required]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string OperatingUnit { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string ImplementingOffice { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string DEO { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string Region { get; set; } = string.Empty;
        [Required]
        public int Agency { get; set; }
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
        public int? ImplementationMode { get; set; }
        [Required]
        public int EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public int RowAvailable { get; set; }
        [Required]
        public int RegionWide { get; set; } = 0;
        [Required]
        public int Tier { get; set; } = 1;
        public Double? Rank { get; set; }
        public bool IsRevised { get; set; } = false;
        public int? RevisedNumber { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
        [Required]
        public bool IsPublishable { get; set; } = false;
    }
}
