using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionProjects
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? MYId { get; set; }
        [MaxLength(100)]
        public string? UACS { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        [Required]
        public string Description { get; set; } = string.Empty;
        [Required]
        public int Category { get; set; }
        public int? Thrust { get; set; }
        [Required]
        public int Origin { get; set; }
        [Required]
        [MaxLength(20)]
        public string City { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string OperatingUnit { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string ImplementingOffice { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string DEO { get; set; } = string.Empty;
        public int? ImplementationMode { get; set; }
        [Required]
        public bool EmergencyMode { get; set; }
    }
}
