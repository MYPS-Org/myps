using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class PCMARevisionDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string RevisionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RevisionDetailsId { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string RevisionType { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RevisionCategory { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RevisionReason { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        public int RegionApproveStatus { get; set; }
        [MaxLength(100)]
        public string? RegionApprover { get; set; }
        public DateTime? RegionApprovedDate { get; set; }
        [Required]
        public int COApproveStatus { get; set; }
        [MaxLength(100)]
        public string? COApprover { get; set; }
        public DateTime? COApprovedDate { get; set; }
    }
}
