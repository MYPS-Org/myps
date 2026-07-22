using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Program
{
    public class ProgramDetailsInProject
    {
        [Required]
        public int StageFKId { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public int StageId { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public int Type { get; set; }
        [MaxLength(50)]
        public string? ProgramType { get; set; }
        [Required]
        public int StartYear { get; set; }
    }
}
