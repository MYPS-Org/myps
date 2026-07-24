using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups.Project
{
    [Table("dbo.tOptionProjectComponentType")]
    public class OptionProjectComponentType
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public EnumComponentTypeModule[] ComponentModuleScope { get; set; } = Array.Empty<EnumComponentTypeModule>();
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string ComponentName { get; set; } = string.Empty;
        [Required]
        public bool ExportToPCMA { get; set; } = false;
        [Required]
        public bool IsActive { get; set; } = true;
    }
}
