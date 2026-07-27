using DBHelper.Models.Enums;
using DBHelper.Models.Table.Permission;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Settings.UserManagement
{
    public class ShowViewPermissionsDTO : EnumPagination<ShowViewPermissionsFilterDTO> { }
    public class ShowViewPermissionsFilterDTO
    {
        public string? RoutePath { get; set; }
    }
    public class SyncViewPermissionsDTO
    {
        public List<AddViewPermissionDTO> RoutesAvailable { get; set; } = new List<AddViewPermissionDTO>();
    }
    public class AddViewPermissionDTO
    {
        public string RouteName { get; set; } = string.Empty;
        public string path { get; set; } = string.Empty;
    }
    public class UpdateViewPermissionDetailsDTO : AppViews { }
    public class ShowPermissionsDTO : EnumPagination<ShowPermissionFilterDTO> { }
    public class ShowPermissionFilterDTO
    {
        public string? ControllerName { get; set; }
        public string? ActionName { get; set; }
        public string? ControllerDescription { get; set; }
    }
    public class UpdatePermissionControllerDetailsDTO : ApiControllers { }
    public class UpdatePermissionActionDetailsDTO : ApiActions { }
    public class DeletePermissionActionDetailsDTO : ApiActions { }
}