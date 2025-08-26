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
        [Required]
        public int Thrust { get; set; }
        [Required]
        public int Origin { get; set; }
        [Required]
        public int City { get; set; }
        [Required]
        public int Province { get; set; }
        [Required]
        public int LegislativeDistrict { get; set; }
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
        [Required]
        public int ImplementationMode { get; set; }
        [Required]
        public bool EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public bool? DetailedDesign { get; set; }
        public bool? RowAvailable { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
