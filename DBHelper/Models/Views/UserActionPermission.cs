using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Views
{
    public class UserActionPermission
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string PermissionController { get; set; } = string.Empty;
        public string PermissionAction { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
