using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class PermissionViews
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string RoutePath { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Description { get; set; }
    }
}
