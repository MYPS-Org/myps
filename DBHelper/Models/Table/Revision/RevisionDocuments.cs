using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionDocuments
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string DocumentName { get; set; } = string.Empty;
        [Required]
        public string DocumentPath { get; set; } = string.Empty;
        [Required]
        public bool IsApprovedDocument { get; set; }
    }
}
