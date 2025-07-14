using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class Programs
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        public int Stage { get; set; }
        [Required]
        public int Status { get; set; }
        [Required]
        public int Type { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public double Cost { get; set; }
        [Required]
        public int YearStart { get; set; }
        [Required]
        public int YearEnd { get; set; }
        [Required]
        public int UserGroup { get; set; }
        [Required]
        [MaxLength(10)]
        public string RegionCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(50)]
        public string? UpdateBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsPublished { get; set; }
    }
}
