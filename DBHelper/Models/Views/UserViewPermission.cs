using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Views
{
    public class UserViewPermission
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string RouteName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
