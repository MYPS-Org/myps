using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System.ComponentModel.DataAnnotations;
namespace WebAPI.Controllers.Settings.UserManagement
{
    public class UserGroupsPaginationDTO : EnumPagination<UserGroupFilterDTO> { }
    public class UserGroupFilterDTO
    {
        public string? GroupName { get; set; }
        public string? PermissionNames { get; set; }
        public int[]? PermissionActionIds { get; set; }
        public int[]? PermissionViewIds { get; set; }
    }
    public class DeleteUserGroupDTO
    {
        public int Id { get; set; }
    }
    public class AddUserGroupDTO
    {
        [Required]
        public string? GroupName { get; set; }
        public string? Description { get; set; }
        [Required]
        public bool ApplyFilter { get; set; } = true;
        /// <summary>Project visibility (Helpers.GroupProjectScope); null keeps the default, DataSecurity.</summary>
        public int? ProjectScope { get; set; }
    }
    public class UpdateUserGroupDTO {

        [Required]
        public int Id { get; set; }
        [Required]
        public string GroupName { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        public bool ApplyFilter { get; set; } = true;
        /// <summary>Project visibility (Helpers.GroupProjectScope); null leaves it unchanged.</summary>
        public int? ProjectScope { get; set; }
        public int[] PermissionActionIds { get; set; } = [];
        public int[] PermissionViewIds { get; set; } = [];
    }
}
