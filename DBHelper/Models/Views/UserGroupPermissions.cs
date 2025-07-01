using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models
{
<<<<<<<< HEAD:DBHelper/Models/Table/Groups.cs
    public class Groups
========
    public class UserGroupPermissions
>>>>>>>> 2b09187e7b8ceeec4feb9a5ffc28fac3031f9b77:DBHelper/Models/Views/UserGroupPermissions.cs
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
