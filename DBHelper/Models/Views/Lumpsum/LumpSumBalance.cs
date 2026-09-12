using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    /// <summary>
    /// dbo.vLumpSumBalance — Total / Itemized / Remaining for one Lump Sum Project.
    ///
    /// Total is the LS component's Total — the full allocation, kept equal to the
    /// parent's funding lines. Remaining is the LS component's per-year Amount —
    /// deducted by imports, restored by child deletes, raised by Replenish
    /// (2026-09-06). Itemized is the children's costs. Total = Remaining + Itemized
    /// is a check the SQL verification blocks report on, not an identity.
    ///
    /// Keyless — registered via HasNoKey().ToView() in MYPSDbContext.
    /// </summary>
    public class LumpSumBalance
    {
        /// <summary>The Lump Sum Project's tProjects.Id.</summary>
        public int WalletId { get; set; }

        /// <summary>
        /// Nullable to match the view: the underlying sum is NULL-able in SQL
        /// Server's inference, and declaring a nullable view column non-nullable
        /// fails the whole read with "expected type was System.Decimal but the
        /// actual value was null".
        /// </summary>
        [Column(TypeName = "decimal(18,5)")]
        public decimal? Total { get; set; }

        [Column(TypeName = "decimal(18,5)")]
        public decimal Itemized { get; set; }

        [Column(TypeName = "decimal(18,5)")]
        public decimal Remaining { get; set; }
    }
}
