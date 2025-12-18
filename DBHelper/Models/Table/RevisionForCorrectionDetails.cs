using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionForCorrectionDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;
        [MaxLength(500)]
        public string? ROComment { get; set; }
        public DateTime? ROForCorrectionDate { get; set; }
        [MaxLength(500)]
        public string? COComment { get; set; }
        public DateTime? COForCorrectionDate { get; set; }
    }
}
