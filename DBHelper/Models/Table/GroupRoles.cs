using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class GroupRoles
    {
        [Key]
        public int Id { get; set; }
        public int? GroupId { get; set; }
        [MaxLength(100)]
        public int PermissionId { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
