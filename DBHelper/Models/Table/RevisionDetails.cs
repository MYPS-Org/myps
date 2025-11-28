using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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
        public bool? RegionApproveStatus { get; set; }
        [MaxLength(100)]
        public string? RegionApprover { get; set; }
        public DateTime? RegionApprovedDate { get; set; }
        public bool? COApproveStatus { get; set; }
        [MaxLength(100)]
        public string? COApprover { get; set; }
        public DateTime? COApprovedDate { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
