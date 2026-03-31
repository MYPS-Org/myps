using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views
{
    public class APIPermissions
    {
        [Key]
        public int Id { get; set; }
        public string? ModuleName { get; set; }
        [Required]
        public string ControllerName { get; set; } = string.Empty;
        public string? ControllerDescription { get; set; }
        [NotMapped]
        public List<APIPermissionActionModel> Actions { get; set; } = new List<APIPermissionActionModel>();
    }

    public class APIPermissionActionModel
    {
        public int Id { get; set; }
        public string ActionName { get; set; } = string.Empty;
    }
}