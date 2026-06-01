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
    public class ProjectComponentCostPerYear
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ComponentCostId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProgramUniqueId { get; set; } = string.Empty;
        public Double? Amount { get; set; }
        public int? Year { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        [Required]
        [MaxLength(10)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
