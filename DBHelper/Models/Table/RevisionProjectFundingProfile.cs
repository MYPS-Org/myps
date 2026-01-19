using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionProjectFundingProfile
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Source { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Agreement { get; set; } = string.Empty;
        [Required]
        public Double Amount { get; set; }
        [Required]
        public Double Percentage { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
