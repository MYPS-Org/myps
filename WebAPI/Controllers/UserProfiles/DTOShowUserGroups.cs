using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.UserProfile
{
    public class UserGroupsPaginationDto : EnumPagination
    {
        public UserGroupFilterDTO Filters { get; set; } = new UserGroupFilterDTO();
        public string? SortField { get; set; }
    }
    public class UserGroupFilterDTO
    {
        public string? GroupName { get; set; }
    }
}
