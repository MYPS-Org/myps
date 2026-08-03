using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.User
{
    public class GroupRoles
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int GroupId { get; set; }
        [Required]
        public int[] ActionIds { get; set; } = Array.Empty<int>();
        [Required]
        public int[] ViewIds { get; set; } = Array.Empty<int>();
    }
}
