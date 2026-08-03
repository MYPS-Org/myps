using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Project
{
    public class ProjectFundingProfile
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectRevisions(Id)
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(100)]
        // FK -> dbo.tOptionFundingSource(Organization)
        public string SourceOrg { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        // FK -> dbo.tOptionFundingAgreement(Code)
        public string AgreementCode { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public Double Percentage { get; set; }
        [Required]
        public bool IsWalletDraw { get; set; }
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
    }
}
