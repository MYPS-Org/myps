using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class Programs
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public EnumProgramType Type { get; set; }
        [Required]
        public int UserGroup { get; set; }
        [Required]
        [MaxLength(10)]
        public string RegionCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        public bool IsPublished { get; set; }
    }
}
