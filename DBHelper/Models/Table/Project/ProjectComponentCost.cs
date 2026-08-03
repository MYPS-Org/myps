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
    public class ProjectComponentCost
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectRevisions(Id)
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionProjectComponentType(ComponentId)
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
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
        public ICollection<ProjectComponentCostPerYear> CostsPerYear { get; set; } = new List<ProjectComponentCostPerYear>();
        public ICollection<ProjectMajorWorkItem> WorkItem { get; set; } = new List<ProjectMajorWorkItem>();
    }
}
