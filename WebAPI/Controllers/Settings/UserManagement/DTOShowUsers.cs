using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.Settings.UserManagement
{
    public class UsersPaginationDto : EnumPagination<UserFilterDTO> { }
    public class UserFilterDTO
    {
        public string? Name { get; set; }
        public string? UserGroup { get; set; }
        public bool? IsActive { get; set; }
    }
}
