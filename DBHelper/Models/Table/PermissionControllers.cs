using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class PermissionControllers
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string ControllerName { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Description { get; set; }
    }
}
