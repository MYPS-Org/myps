using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionProjectMajorWorkLocations
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionWorkItemFK { get; set; }
        [Required]
        [MaxLength(50)]
        public string InfraId { get; set; } = string.Empty;
        public string? DetailedScope { get; set; }
        [Required]
        public int TargetUnitId { get; set; }
        [Required]
        [MaxLength(100)]
        public string TargetUnit { get; set; } = string.Empty;
        public double? StartX { get; set; }
        public double? StartY { get; set; }
        public double? EndX { get; set; }
        public double? EndY { get; set; }
        public double? PhysicalTarget { get; set; }
        [MaxLength(100)]
        public string? StartStationLimit { get; set; }
        [MaxLength(100)]
        public string? EndStationLimit { get; set; }
        public double? StartChainage { get; set; }
        public double? EndChainage { get; set; }
        public double? Length { get; set; }
        public bool IsDeleted { get; set; } = false;

        [NotMapped]
        public string ComponentId { get; set; } = string.Empty;

        [NotMapped]
        public string TransactionId { get; set; } = string.Empty;
    }
}
