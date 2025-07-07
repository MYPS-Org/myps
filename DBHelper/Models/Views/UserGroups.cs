using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class UserGroups
    {
        public int Id { get; set; }
        public string? GroupName { get; set; }
        public int? NumberOfUsers { get; set; }
        public string? Description { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? PermissionIds { get; set; }
    }
}
