using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Permission
{
    public class AppViews
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(50)]
        public string? ModuleName { get; set; }
        [Required]
        [MaxLength(50)]
        public string RouteName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RoutePath { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Description { get; set; }
    }
}
