using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionProjectComponent
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [MaxLength(10)]
        public string? ComponentId { get; set; }
        [MaxLength(200)]
        public string? ComponentName { get; set; }
        [Required]
        public bool ExportToPCMA { get; set; } = false;
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
