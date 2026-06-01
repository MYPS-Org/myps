using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class RevisionDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramRevisionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProgramUniqueId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        public int RevisionGroupId { get; set; }
        public int? CategoryId { get; set; }
        [Required]
        public int ReasonId { get; set; }
        public DateTime? IODocApprovalDate { get; set; }
        [Required]
        public Enums.EnumRevisionStatus RegionStatus { get; set; } = Enums.EnumRevisionStatus.Pending;
        public string? RegionDescription { get; set; }
        [MaxLength(100)]
        public string? RegionApprover { get; set; }
        public DateTime? RegionApprovedDate { get; set; }
        public DateTime? RegionLastUpdatedDate { get; set; }
        [Required]
        public Enums.EnumRevisionStatus COStatus { get; set; } = Enums.EnumRevisionStatus.Pending;
        public DateTime? CODocApprovalDate { get; set; }
        public string? CODescription { get; set; }
        [MaxLength(100)]
        public string? COApprover { get; set; }
        public DateTime? COApprovedDate { get; set; }
        public DateTime? COLastUpdatedDate { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
