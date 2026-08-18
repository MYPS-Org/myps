using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Program
{
    public class ProgramDetails
    {
        [Key]
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
        public int RevisionId { get; set; }
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public int Status { get; set; }
        [MaxLength(50)]
        public string? StatusName { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Cost { get; set; }
        [Required]
        public int Type { get; set; }
        [MaxLength(50)]
        public string? ProgramType { get; set; }
        [Required]
        public int StartYear { get; set; }
        [Required]
        [MaxLength(1000)]
        public int[] UserGroup { get; set; } = Array.Empty<int>();
        [Required]
        [MaxLength(1000)]
        public string[] DataSecurityGroup { get; set; } = Array.Empty<string>();
        [Required]
        public bool IsPublished { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
        [Required]
        public bool IsSkipped { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        //public string RevisionCreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        //public DateTime RevisionCreatedDate { get; set; }
    }
}
