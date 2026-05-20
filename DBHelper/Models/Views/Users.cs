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
        [Required]
        public string EmployeeId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        [Required]
        public string Name { get; set; } = string.Empty;
        [Required]
        public string? Email { get; set; }
        [Required]
        public string RegCode { get; set; } = string.Empty;
        [Required]
        public string RegName { get; set; } = string.Empty;
        [Required]
        public string? PlantillaOffice { get; set; }
        [Required]
        public string? PlantillaOfficeName { get; set; }
        public bool IsActive { get; set; }
    }
}
