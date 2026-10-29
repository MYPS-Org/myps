using DBHelper.Data;
using Microsoft.EntityFrameworkCore;

namespace Helpers
{
    /// <summary>
    /// The one way the application asks the database to recompute a program's Cost:
    /// dbo.pRecomputeProgramCost, which writes tProgramRevisions.Cost for the
    /// revision of the program's current stage (what Program Details shows).
    /// </summary>
    /// <remarks>
    /// Five callers used to inline the same EXEC. The rule it applies lives in the
    /// procedure: Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql,
    /// section 11. Call it inside the caller's transaction, after its last flush, so
    /// the recompute reads the rows that transaction just wrote.
    /// </remarks>
    public static class ProgramCostRecompute
    {
        /// <returns>
        /// The NewCost the procedure reported, or null if it returned no row.
        /// </returns>
        public static async Task<decimal?> RecomputeProgramCostAsync(
            this MYPSDbContext db,
            string programPK,
            CancellationToken cancellationToken)
        {
            // ToListAsync, not FirstOrDefaultAsync: EF cannot compose TOP(1) over an EXEC.
            var Rows = await db.pRecomputeProgramCost
                .FromSqlInterpolated($"EXEC dbo.pRecomputeProgramCost @ProgramPK={programPK}")
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            return Rows.FirstOrDefault()?.NewCost;
        }
    }
}
