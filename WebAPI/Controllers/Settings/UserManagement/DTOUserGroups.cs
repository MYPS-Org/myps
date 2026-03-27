using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.Settings.UserManagement
{
    public class UserGroupsPaginationDto : EnumPagination<UserGroupFilterDTO> { }
    public class UserGroupFilterDTO
    {
        public string? GroupName { get; set; }
        public int[]? PermissionActionIds { get; set; }
    }
    public class DeleteUserGroupDto
    {
        public int Id { get; set; }
    }
    public class AddUserGroupDTO
    {
        public string? GroupName { get; set; }
        public string? Description { get; set; }
        public int[] ActionIds { get; set; } = Array.Empty<int>();
    }
    public class UpdateUserGroupDTO : DBHelper.Models.Views.UserGroups { }
}
