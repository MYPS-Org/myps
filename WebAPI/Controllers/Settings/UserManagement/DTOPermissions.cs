using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Models.Enums;

namespace WebAPI.Controllers.Settings.UserManagement
{
    public class ShowPermissionsDTO : EnumPagination<ShowPermissionFilterDTO> { }
    public class ShowPermissionFilterDTO
    {
        public string? PermissionGroupName { get; set; }
        public string? ModuleFunction { get; set; }
        public string? Description { get; set; }
    }
    public class  AddPermissionsDTO
    {
        public int PermissionGroupId { get; set; }
        public string ModuleFunction { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }
}