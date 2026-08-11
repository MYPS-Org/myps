using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionProjectFundingProfile
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string SourceOrg { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string AgreementCode { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public double Percentage { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
    }
}
