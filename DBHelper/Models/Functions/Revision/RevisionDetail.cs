using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionDetail
    {
        [Key]
        public int Id { get; set; }
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
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string RevisionType { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RevisionReason { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? CategoryName { get; set; }
        [Required]
        [MaxLength(11)]
        public string CurrentStage { get; set; } = string.Empty;
        public DateTime? IODocApprovalDate { get; set; }
        [MaxLength(500)]
        public string? IODocPath { get; set; }
        public bool IsCertified { get; set; }
        [Required]
        [MaxLength(100)]
        public string RevisionCreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime RevisionDate { get; set; }
    }
}
