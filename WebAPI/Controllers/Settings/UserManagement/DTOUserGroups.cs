using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.Settings.UserManagement
{
    public class UserGroupsPaginationDto : EnumPagination
    {
        public UserGroupFilterDTO Filters { get; set; } = new UserGroupFilterDTO();
        public string? SortField { get; set; }
    }
    public class UserGroupFilterDTO
    {
        public string? GroupName { get; set; }
        public string? PermissionNames { get; set; }
    }
    public class DeleteUserGroupDto
    {
        public int Id { get; set; }
    }
    public class AddUserGroupsDTO
    {
        public string? GroupName { get; set; }
        public string? Description { get; set; }
        public int[] PermissionIds { get; set; } = Array.Empty<int>();
    }
}
