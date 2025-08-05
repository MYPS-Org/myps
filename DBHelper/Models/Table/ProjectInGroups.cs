using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class ProjectInGroups
    {
        [Key]
        public int Id { get; set; }
        public string GroupId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
