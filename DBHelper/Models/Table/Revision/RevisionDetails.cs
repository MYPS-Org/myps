using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionDetails
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
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public int RevisionGroupId { get; set; }
        public int? CategoryId { get; set; }
        [Required]
        public int ReasonId { get; set; }
        public DateTime? IODocApprovalDate { get; set; }
        [MaxLength(500)]
        public string? IODocPath { get; set; }
        [Required]
        public bool IsCertified { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
