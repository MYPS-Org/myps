using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.UserProfile
{
    public class UsersPaginationDto : EnumPagination
    {
        public User Filters { get; set; } = new User();
        public string? SortField { get; set; }
    }
}
