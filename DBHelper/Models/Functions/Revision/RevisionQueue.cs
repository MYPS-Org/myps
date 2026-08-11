using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionQueue
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string RevisionType { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RevisionReason { get; set; } = string.Empty;
        [Required]
        [MaxLength(17)]
        public string RevisionStatus { get; set; } = string.Empty;
        [Required]
        [MaxLength(11)]
        public string CurrentStage { get; set; } = string.Empty;
        [Required]
        public DateTime RevisionDate { get; set; }
        public int? Age { get; set; }
    }
}
