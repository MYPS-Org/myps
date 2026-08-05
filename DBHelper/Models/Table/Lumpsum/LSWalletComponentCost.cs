using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lumpsum
{
    /// <summary>
    /// dbo.tLSWalletComponentCost — a multi-row component-cost line on a
    /// wallet's active revision, mirroring dbo.tProjectComponentCost.
    /// ComponentType defaults to 'LS' — the wallet's own component-cost dialog
    /// is the one place 'LS' is selectable (itemized projects exclude it via
    /// WALLET_EXCLUSIVE_COMPONENT_TYPES on the frontend).
    /// </summary>
    public class LSWalletComponentCost
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tLSWalletRevisions(Id)
        public int WalletRevisionFK { get; set; }
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionProjectComponentType(ComponentId)
        public string ComponentType { get; set; } = "LS";
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
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
        public ICollection<LSWalletComponentCostPerYear> CostsPerYear { get; set; } = new List<LSWalletComponentCostPerYear>();
    }
}
