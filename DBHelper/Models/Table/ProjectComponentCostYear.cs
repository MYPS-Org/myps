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
        public int ParentId { get; set; }
        [Required]
        public int CostYear { get; set; }
        [Required]
        public Double Cost { get; set; }
        public DateTime? ApprovalDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string PAPCode { get; set; } = string.Empty;
        [Required]
        public DateTime StartDate { get; set; }
        [Required]
        public DateTime EndDate { get; set; }
    }
}
