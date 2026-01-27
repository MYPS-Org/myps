using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionProjectMajorWorkLocations
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ParentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string InfraId { get; set; } = string.Empty;
        public string? DetailedScope { get; set; }
        [Required]
        public int TargetUnitId { get; set; }
        [Required]
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        public string? StartX { get; set; }
        public string? StartY { get; set; }
        public string? EndX { get; set; }
        public string? EndY { get; set; }
        public Double? PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public Double? EndChainage { get; set; }
        public Double? StartChainage { get; set; }
    }
}
