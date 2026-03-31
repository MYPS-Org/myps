using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Views
{
    public class Users
    {
        [Key]
        public int Id { get; set; }
        public int[] UserGroupIds { get; set; } = Array.Empty<int>();
        public string[] UserGroupNames { get; set; } = Array.Empty<string>();
        public bool ApplyFilter { get; set; } = false;
        public string? EmployeeId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string RegCode { get; set; } = string.Empty;
        public string? RegName { get; set; }
        public string? PlantillaOffice { get; set; }
        public string? PlantillaOfficeName { get; set; }
        public bool IsActive { get; set; }
    }
}
