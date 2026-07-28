using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Project
{
    public class ProjectComponentCost
    {
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentType { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ComponentName { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }
        public byte? ConstructionStatusCode { get; set; }
        [MaxLength(300)]
        public string? ConstructionStatusName { get; set; }
        public byte? IsPackaged { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
