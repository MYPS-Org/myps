using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectMajorWorkLocations
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ParentId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProgramUniqueId { get; set; }
        [MaxLength(10)]
        public string? StageName { get; set; } = string.Empty;
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
        [Required]
        public Double PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public Double? EndChainage { get; set; }
        public Double? StartChainage { get; set; }
        public Double? Length { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
