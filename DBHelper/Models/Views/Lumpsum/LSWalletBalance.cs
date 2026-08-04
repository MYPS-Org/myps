using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    /// <summary>
    /// dbo.vLSWalletBalance — live Total / Used / Available for a wallet.
    ///
    /// There is deliberately no stored balance counter: Used is recomputed from
    /// the wallet's active itemized projects on every read, so a deleted project
    /// returns its funds automatically and the figures can never drift.
    ///
    /// Keyless — registered via HasNoKey().ToView() in MYPSDbContext.
    /// </summary>
    public class LSWalletBalance
    {
        public int WalletId { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Used { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Available { get; set; }
    }
}
