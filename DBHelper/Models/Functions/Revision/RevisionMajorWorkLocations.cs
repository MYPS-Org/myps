using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionMajorWorkLocations
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [Required]
        public int ProjectRevisionFK { get; set; }
        [Required]
        public int RevisionWorkItemFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int WorkTypeFK { get; set; }
        [MaxLength(50)]
        public string? WorkCategory { get; set; }
        [MaxLength(400)]
        public string? WorkTypeDescription { get; set; }
        [MaxLength(100)]
        public string? WorkTypeMeasure { get; set; }
        [Required]
        [MaxLength(10)]
        public string InfraTypeFK { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? InfraTypeName { get; set; }
        [Required]
        public bool WorkItemIsDeleted { get; set; }
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
        [Required]
        public bool IsDeleted { get; set; }
    }
}
