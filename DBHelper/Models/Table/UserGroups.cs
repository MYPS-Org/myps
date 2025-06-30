using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models
{
    public class UserGroups
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(100)]
        public string? GroupName { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? Description { get; set; } = string.Empty;
        [MaxLength(50)]
        public string? CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
    }
}
