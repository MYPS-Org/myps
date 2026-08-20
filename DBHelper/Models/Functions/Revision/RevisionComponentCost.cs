using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionComponentCost
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        [MaxLength(5)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [Required]
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
        [MaxLength(20)]
        public string? ConstructionStatusCode { get; set; }
        [Required]
        [MaxLength(50)]
        public string ConstructionStatusName { get; set; } = string.Empty;
        [Required]
        public bool IsPackaged { get; set; }
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
