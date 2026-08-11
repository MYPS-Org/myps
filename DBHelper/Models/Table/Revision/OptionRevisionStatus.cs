using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class OptionRevisionStatus
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [Required]
        public EnumRevisionStatus Enum { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Description { get; set; }
    }
}
