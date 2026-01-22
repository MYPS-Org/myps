using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class RevisionDetailsComponentsStatus
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(100)]
        public string? TransactionId { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int ConstructionStatusCode { get; set; }
        [Required]
        [MaxLength(20)]
        public string ConstructionStatusName { get; set; } = string.Empty;
        [Required]
        public bool IsPackaged { get; set; }
    }
}
