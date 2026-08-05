using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lumpsum
{
    /// <summary>
    /// dbo.tLSWalletComponentCostPerYear — the fiscal-year breakdown of a
    /// wallet component-cost row, mirroring dbo.tProjectComponentCostPerYear.
    /// </summary>
    public class LSWalletComponentCostPerYear
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tLSWalletComponentCost(Id)
        public int ComponentCostFK { get; set; }
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
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [Required]
        public bool IsDeleted { get; set; }
        public LSWalletComponentCost ComponentCost { get; set; } = null!;
    }
}
