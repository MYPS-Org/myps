using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Revision
{
    public class PendingProjectComponentCost
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int ProjectRevisionFK { get; set; }
        [MaxLength(100)]
        public string? ComponentType { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
