using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectRODEOEnum
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string DeoCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string DeoName { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string ROCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ROName { get; set; } = string.Empty;
        [MaxLength(2)]
        public string? Island { get; set; }
    }
}
