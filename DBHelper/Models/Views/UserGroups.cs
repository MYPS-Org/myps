using System.ComponentModel.DataAnnotations;
namespace DBHelper.Models.Views
{
    public class UserGroups
    {
        [Key]
        public int Id { get; set; }
        public string? GroupName { get; set; }
        public string? Description { get; set; }
        public int? NumberOfUsers { get; set; }
        public List<ModulePermissionModel>? ModulePermissions { get; set; } = new List<ModulePermissionModel>();
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }

    public class ModulePermissionModel
    {
        public string ModuleName { get; set; } = string.Empty;
        public List<UserGroupAPIPermissionModel> APIPermissions { get; set; } = new List<UserGroupAPIPermissionModel>();
        public List<UserGroupViewAccessModel> ViewAccess { get; set; } = new List<UserGroupViewAccessModel>();
    }

    public class UserGroupAPIPermissionModel
    {
        [Required]
        public string ControllerName { get; set; } = string.Empty;
        [Required]
        public List<UserGroupAPIActionModel> Actions { get; set; } = new List<UserGroupAPIActionModel>();
        public bool IsGranted { get; set; } = false;
    }

    public class UserGroupAPIActionModel
    {
        [Required]
        public string ActionName { get; set; } = string.Empty;
        public bool IsGranted { get; set; } = false;
    }

    public class UserGroupViewAccessModel
    {
        [Required]
        public string RouteName { get; set; } = string.Empty;
        [Required]
        public string RoutePath { get; set; } = string.Empty;
        public bool IsGranted { get; set; } = false;
    }
}