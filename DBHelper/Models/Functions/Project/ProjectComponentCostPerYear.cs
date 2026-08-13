using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Project
{
    public class ProjectComponentCostPerYear
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int ComponentCostFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public int Year { get; set; }
        [MaxLength(50)]
        public string? UACS { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
        public DateTime? DateOfApproval { get; set; }
        [MaxLength(50)]
        public string? DataImportProgramId { get; set; }
        [MaxLength(50)]
        public string? DataImportProjectId { get; set; }
        [MaxLength(50)]
        public string? DataImportComponentId { get; set; }
    }
}
