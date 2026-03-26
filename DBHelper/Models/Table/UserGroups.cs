using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class UserGroups
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string UserId { get; set; } = string.Empty;
        [Required]
        public int[] GroupIds { get; set; } = Array.Empty<int>();
        [MaxLength(50)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
