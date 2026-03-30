using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.Settings.UserManagement
{
    public class UsersPaginationDto : EnumPagination<UserFilterDTO> { }
    public class UserFilterDTO
    {
        public string? EmployeeId { get; set; }
        public string? UserId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        public bool? IsActive { get; set; }
    }
}
