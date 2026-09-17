using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Project
{
    public class ProjectRevisions
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        // FK -> dbo.tProjects(ProjectPK)
        public string ProjectFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        // FK -> dbo.tPrograms(ProgramPK)
        public string ProgramFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(400)]
        public string? AlternateId { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        [Required]
        public string Description { get; set; } = string.Empty;
        [MaxLength(20)]
        /*  Nullable since LumpSum.Baseline.sql §2b widened these columns: the V2
            field spec makes Region, DEO and Implementing Office OPTIONAL, and a
            Lump Sum Project is program-wide with no geography at all. The model
            must match the column or EF throws SqlNullValueException on read. */
        public string? Region { get; set; }
        [MaxLength(20)]
        public string? Province { get; set; }
        [MaxLength(20)]
        public string? City { get; set; }
        [MaxLength(20)]
        public string? LegislativeDistrict { get; set; }
        [MaxLength(20)]
        public string? DEO { get; set; }
        [Required]
        [MaxLength(20)]
        public string OperatingUnit { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? ImplementingOffice { get; set; }
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
        public Double? Rank { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(200)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
