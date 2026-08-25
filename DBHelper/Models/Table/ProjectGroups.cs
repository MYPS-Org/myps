using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class ProjectGroups
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        public int UserGroup { get; set; }

        [Required]
        public bool IsDeleted { get; set; }

        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        [Required]
        public DateTime CreatedDate { get; set; }

        [MaxLength(100)]
        public string? UpdatedBy { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}
