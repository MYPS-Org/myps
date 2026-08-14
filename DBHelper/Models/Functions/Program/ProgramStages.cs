using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Program
{
    public class ProgramStages
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
        public int RevisionId { get; set; }
        [Required]
        public EnumProgramStage StageId { get; set; }
        [MaxLength(100)]
        public string StageDisplayName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(1000)]
        public int[] UserGroup { get; set; } = Array.Empty<int>();
        [Required]
        [MaxLength(1000)]
        public string[] DataSecurityGroup { get; set; } = Array.Empty<string>();
        [MaxLength(50)]
        public string? ProgramType { get; set; }
        [Required]
        public int StartYear { get; set; }
        public int? ProjectCount { get; set; }
        [Column(TypeName = "decimal(38,5)")]
        public decimal? Cost { get; set; }
    }
}
