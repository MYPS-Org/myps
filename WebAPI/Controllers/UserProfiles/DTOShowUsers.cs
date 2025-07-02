using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.UserProfile
{
    public class UsersPaginationDto : EnumPagination
    {
        public UserFilterDTO Filters { get; set; } = new UserFilterDTO();
        public string? SortField { get; set; }
    }
    public class UserFilterDTO
    {
        public string? Name { get; set; }
        public string? UserGroup { get; set; }
        public bool? IsActive { get; set; }
    }
}
