using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionFundingProfile
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public int ProjectRevisionFK { get; set; }
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
        [Required]
        [MaxLength(5)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        public bool IsWalletDraw { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        public int? UpdatedBy { get; set; }
        public int? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
