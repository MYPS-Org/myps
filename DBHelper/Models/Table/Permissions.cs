using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class Permissions
    {
        [Required]
        public int Id { get; set; }
        [Required]
        public int PermissionGroupId { get; set; }
        [Required]
        [MaxLength(100)]
        public string ModuleFunction { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
