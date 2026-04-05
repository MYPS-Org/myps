using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using System.Text.Json.Serialization;
namespace DBHelper.Models.Views
{
    public class UserGroups
    {
        [Key]
        public int Id { get; set; }
        public string? GroupName { get; set; }
        public bool ApplyFilter { get; set; } = false;
        public string? Description { get; set; }
        public int? NumberOfUsers { get; set; }

        [Column("ModulePermissions")]
        public string? ModulePermissionsJson { get; set; }

        [NotMapped]
        public List<ModulePermissionModel> ModulePermissions
        {
            get => string.IsNullOrWhiteSpace(ModulePermissionsJson)
                ? new List<ModulePermissionModel>()
                : JsonSerializer.Deserialize<List<ModulePermissionModel>>(ModulePermissionsJson) ?? new List<ModulePermissionModel>();
            set => ModulePermissionsJson = JsonSerializer.Serialize(value);
        }

        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }

    public class ModulePermissionModel
    {
        [JsonPropertyName("ModuleName")]
        public string ModuleName { get; set; } = string.Empty;

        [JsonPropertyName("APIPermissions")]
        public List<UserGroupAPIPermissionModel> APIPermissions { get; set; } = new List<UserGroupAPIPermissionModel>();

        [JsonPropertyName("ViewAccess")]
        public List<UserGroupViewAccessModel> ViewAccess { get; set; } = new List<UserGroupViewAccessModel>();
    }

    public class UserGroupAPIPermissionModel
    {
        [Required]
        [JsonPropertyName("ControllerName")]
        public string ControllerName { get; set; } = string.Empty;

        [Required]
        [JsonPropertyName("Actions")]
        public List<UserGroupAPIActionModel> Actions { get; set; } = new List<UserGroupAPIActionModel>();

        [JsonPropertyName("IsGranted")]
        public bool IsGranted { get; set; } = false;
    }

    public class UserGroupAPIActionModel
    {
        [Required]
        [JsonPropertyName("ActionName")]
        public string ActionName { get; set; } = string.Empty;

        [JsonPropertyName("IsGranted")]
        public bool IsGranted { get; set; } = false;
    }

    public class UserGroupViewAccessModel
    {
        [Required]
        [JsonPropertyName("RouteName")]
        public string RouteName { get; set; } = string.Empty;

        [Required]
        [JsonPropertyName("RoutePath")]
        public string RoutePath { get; set; } = string.Empty;

        [JsonPropertyName("IsGranted")]
        public bool IsGranted { get; set; } = false;
    }
}