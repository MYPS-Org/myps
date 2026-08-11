using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionProjectComponentCostPerYear
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
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
        public bool IsDeleted { get; set; } = false;
        public DateTime? DateOfApproval { get; set; }
    }
}
