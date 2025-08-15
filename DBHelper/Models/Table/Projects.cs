using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class Projects
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? AlternateId { get; set; }
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
