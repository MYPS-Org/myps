using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectCategoryEnum
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int Enum { get; set; }
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public int Minimum { get; set; }
        [Required]
        public int Maximum { get; set; }
        [Required]
        public int ValidUntil { get; set; }
    }
}
