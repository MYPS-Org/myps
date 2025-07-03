using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class Permissions
    {
        public int Id { get; set; }
        public int PermissionGroupId { get; set; }
        public string? PermissionGroupName { get; set; }
        public string ModuleFunction { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
    }
}
