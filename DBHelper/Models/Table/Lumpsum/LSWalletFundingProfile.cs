using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lumpsum
{
    /// <summary>
    /// dbo.tLSWalletFundingProfile — a multi-line funding line on a wallet's
    /// active revision, mirroring dbo.tProjectFundingProfile. No IsWalletDraw
    /// column: that flag marks the draw-line on an ITEMIZED PROJECT's funding
    /// profile (tProjectFundingProfile.IsWalletDraw); it has no meaning on the
    /// wallet's own funding lines.
    /// </summary>
    public class LSWalletFundingProfile
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tLSWalletRevisions(Id)
        public int WalletRevisionFK { get; set; }
        [Required]
        [MaxLength(100)]
        // FK -> dbo.tOptionFundingSource(Organization)
        public string SourceOrg { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        // FK -> dbo.tOptionFundingAgreement(Code)
        public string AgreementCode { get; set; } = string.Empty;
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        public double Percentage { get; set; }
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
    }
}
