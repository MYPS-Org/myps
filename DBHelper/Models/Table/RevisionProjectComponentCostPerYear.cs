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
        public Double Amount { get; set; }
        public int Year { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
}
