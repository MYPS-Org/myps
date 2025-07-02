using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class UserGroupPermissions
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(100)]
        public string? GroupName { get; set; }
        [MaxLength(200)]
        public string? Description { get; set; }
        [MaxLength(50)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
