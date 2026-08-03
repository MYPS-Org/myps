using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Project
{
    public class ProjectMajorWorkItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectComponentCost(Id)
        public int ComponentCostFK { get; set; }
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        // FK -> dbo.tOptionScopeOfWork(Enum)
        public int WorkTypeFK { get; set; }
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionInfraType(InfraCode)
        public string InfraTypeFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
        public ProjectComponentCost ComponentCost { get; set; } = null!;
        public ICollection<ProjectMajorWorkLocations> WorkLocations { get; set; } = new List<ProjectMajorWorkLocations>();
    }
}
