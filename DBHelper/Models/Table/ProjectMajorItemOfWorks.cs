using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectMajorItemOfWorks
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public int ComponentId { get; set; }
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int TypeOfWork { get; set; }
        [Required]
        public Double PhysicalTarget { get; set; }
        [Required]
        [MaxLength(400)]
        public string Description { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string InfraId { get; set; } = string.Empty;
        [Required]
        public Double StartStationLimit { get; set; }
        [Required]
        public Double EndStationLimi { get; set; }
        [Required]
        public Double StartFrom { get; set; }
        [Required]
        public Double EndFrom { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string UpdatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime UpdatedDate { get; set; }
    }
}
