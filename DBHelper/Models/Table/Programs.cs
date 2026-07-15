using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table
{
    [Table("dbo.tPrograms")]
    public class Programs
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public int[] UserGroup { get; set; } = Array.Empty<int>();
        [Required]
        public string[] DataSecurityGroup { get; set; } = Array.Empty<string>();
        [Required]
        public EnumProgramType Type { get; set; }
        [Required]
        public int YearStart { get; set; }
        [Required]
        public bool IsPublished { get; set; } = false;
        [Required]
        public bool IsDeleted { get; set; } = false;
        [Required]
        public bool IsSkipped { get; set; } = false;
        [MaxLength(200)]
        public string? SkipReason { get; set; }
        [Required]
        public int PCMARevisionCount { get; set; } = 0;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
