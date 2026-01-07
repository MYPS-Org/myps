using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionTransactionLog
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string TypeOfTransaction { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string AffectedTable { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string AffectedColumn { get; set; } = string.Empty;
        [Required]
        public string OldValue { get; set; } = string.Empty;
        [Required]
        public string NewValue { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
