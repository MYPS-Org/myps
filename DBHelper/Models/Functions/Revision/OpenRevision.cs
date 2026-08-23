using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Revision
{
    public class OpenRevision
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        public int RO_Status { get; set; }
        public int CO_Status { get; set; }
        public DateTime RevisionDate { get; set; }
    }
}
