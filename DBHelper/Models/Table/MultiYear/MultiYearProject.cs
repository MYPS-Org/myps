using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.MultiYear
{
    /// <summary>
    /// The one lasting record of a multi-year project, across every year, stage and portfolio
    /// (MY-PRJ-01). Portfolios hold it through memberships; it is never copied. OriginalCost is set
    /// when the record is made and never changes (MY-PRJ-07).
    /// </summary>
    public class MultiYearProject
    {
        [Key]
        public int Id { get; set; }
        /// <summary>The MY-prefixed id (MY-PRJ-04), from ProjectHelper.GenerateProjectID.</summary>
        [Required]
        [MaxLength(20)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string Description { get; set; } = string.Empty;
        public int Category { get; set; }
        public int? Thrust { get; set; }
        [MaxLength(20)]
        public string? Region { get; set; }
        [MaxLength(20)]
        public string? Province { get; set; }
        [MaxLength(20)]
        public string? City { get; set; }
        [MaxLength(20)]
        public string? LegislativeDistrict { get; set; }
        [MaxLength(20)]
        public string? DEO { get; set; }
        [MaxLength(20)]
        public string? ImplementingOffice { get; set; }
        [MaxLength(20)]
        public string? ReportingRegion { get; set; }
        public int? RegionWide { get; set; }
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
        // FK -> dbo.tOptionMultiYearType(Id)
        public int HorizonTypeFK { get; set; }
        public int StartYear { get; set; }
        public int? EndYear { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal OriginalCost { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal CurrentCost { get; set; }
        /// <summary>The approved GAA / GAA-R program (tPrograms.ProgramPK) the portfolio update made this
        /// record from (MY-PFL-21); null for a project added or imported in a portfolio.</summary>
        [MaxLength(200)]
        public string? OriginProgramFK { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }

    /// <summary>A component of a multi-year project. A planning project has one: CW1, with one
    /// major item (MY-PFL-16).</summary>
    public class MultiYearComponent
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearProject(Id)
        public int MultiYearProjectFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ComponentType { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>tOptionInfraType.InfraCode, as tProjectMajorWorkItem.InfraTypeFK.</summary>
        [MaxLength(10)]
        public string? InfraTypeFK { get; set; }
        /// <summary>tOptionScopeOfWork.Enum, as tProjectMajorWorkItem.WorkTypeFK.</summary>
        public int? WorkTypeFK { get; set; }
        public double? PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? TargetUnit { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }

    /// <summary>
    /// One year of a component in the shared yearly cost stream. Phase 1 writes Planned rows only
    /// (MY-PRJ-11); only one non-superseded row exists per component and year (MY-PRJ-25).
    /// </summary>
    public class MultiYearComponentCostPerYear
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearComponent(Id)
        public int MultiYearComponentFK { get; set; }
        public int Year { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        public EnumCostStreamStatus Status { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
