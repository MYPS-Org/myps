using DBHelper.Models.Enums;
using DBHelper.Models.Table.Lookups.Project;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups
{
    [Table("dbo.tOptionProjectComponentTypeModule")]
    public class OptionProjectComponentTypeModule
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public EnumComponentTypeModule NameId { get; set; }
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;
        [Required]
        public bool IsActive { get; set; } = false;
    }
}
