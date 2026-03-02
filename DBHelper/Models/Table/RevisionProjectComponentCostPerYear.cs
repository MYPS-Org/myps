using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionProjectComponentCostPerYear
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(255)]
        public string? TransactionId { get; set; }
        [Required]
        [MaxLength(100)]
        public string ComponentCostId { get; set; } = string.Empty;
        [Required]
        public Double Amount { get; set; }
        [Required]
        public int Year { get; set; }
        [Required]
        public DateTime StartDate { get; set; }
        [Required]
        public DateTime EndDate { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
}
