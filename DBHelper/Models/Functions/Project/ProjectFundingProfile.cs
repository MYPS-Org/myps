using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Project
{
    public class ProjectFundingProfile
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string SourceOrg { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string AgreementCode { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public Double Percentage { get; set; }
        public bool? IsWalletDraw { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
