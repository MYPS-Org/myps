using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    [Table("dbo.tTransactionLog")]
    public class TransactionLog
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string TransactionType { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string AffectedTable { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string AffectedColumn { get; set; } = string.Empty;
        [Required]
        public string OldValue { get; set; } = string.Empty;
        [Required]
        public string NewValue { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Hostname { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
