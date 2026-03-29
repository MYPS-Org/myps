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
        public int[] PermissionActionIds { get; set; } = Array.Empty<int>();
        public int[] PermissionViewIds { get; set; } = Array.Empty<int>();
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
