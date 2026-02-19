using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectScopeOfWorkEnum
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int Enum { get; set; }
        [Required]
        [MaxLength(50)]
        public string[] InfraType { get; set; } = new string[] { };
        [Required]
        [MaxLength(50)]
        public string WorkCategory { get; set; } = string.Empty;
        [Required]
        [MaxLength(400)]
        public string Description { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Measure { get; set; } = string.Empty;
        [Required]
        public int MaxAmount { get; set; }
        [Required]
        public int MinAmount { get; set; }
    }
}
