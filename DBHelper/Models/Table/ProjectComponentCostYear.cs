using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectComponentCostYear
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ParentId { get; set; } = string.Empty;
        [Required]
        public int CostYear { get; set; }
        [Required]
        public Double Cost { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
