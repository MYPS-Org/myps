using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class RevisionDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        public int ModificationCategory { get; set; }
        [Required]
        public int ModificationReason { get; set; }
        public Enums.EnumRevisionStatus RegionApproveStatus { get; set; } = Enums.EnumRevisionStatus.Pending;
        [MaxLength(100)]
        public string? RegionApprover { get; set; }
        public DateTime? RegionApprovedDate { get; set; }
        public DateTime? RegionLastUpdatedDate { get; set; }
        public Enums.EnumRevisionStatus COApproveStatus { get; set; } = Enums.EnumRevisionStatus.Pending;
        [MaxLength(100)]
        public string? COApprover { get; set; }
        public DateTime? COApprovedDate { get; set; }
        public DateTime? COLastUpdatedDate { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
