using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectMajorWorkItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string DetailedScope { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int WorkTypeId { get; set; }
        [Required]
        [MaxLength(100)]
        public string InfraId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string InfraType { get; set; } = string.Empty;
        [Required]
        public int TargetUnitId { get; set; }
        [Required]
        public Double StartX { get; set; }
        [Required]
        public Double StartY { get; set; }
        [Required]
        public Double EndX { get; set; }
        [Required]
        public Double EndY { get; set; }
        [Required]
        public Double TargetAmount { get; set; }
        [Required]
        public Double StartStationLimit { get; set; }
        [Required]
        public Double EndStationLimit { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
