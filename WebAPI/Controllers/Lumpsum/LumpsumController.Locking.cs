using System.Data;
using Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// Per-parent mutual exclusion for the Lump Sum module (2026-09-06).
    ///
    /// WHY. The itemization import reads the parent — its Remaining balance and the
    /// UACS every child will inherit — and only later writes the children. Between
    /// those two points a concurrent save, replenish or child delete could move the
    /// balance the overdraw check already used, or the UACS about to be copied.
    /// Every mutator of a parent therefore takes the same lock before it reads the
    /// parent, so two of them can never interleave on the same project.
    ///
    /// TWO LAYERS, deliberately different in kind:
    ///
    ///   1. THE GUARANTEE — a SQL Server application lock (sp_getapplock) keyed by the
    ///      parent's tProjects.Id and OWNED BY THE TRANSACTION. The server releases it
    ///      on commit, rollback or dispose, so it cannot go stale; it is server-wide,
    ///      so several API instances share it; it needs no schema. A second caller
    ///      waits up to LumpSumLockWaitMs, then is refused with 409 Busy.
    ///
    ///   2. THE COURTESY — tProjects.LockedBy / LockedDate, columns that existed
    ///      unused. The import stamps them for its duration so other users' screens
    ///      can say "being itemized by X" and disable the buttons. A crash can leave
    ///      a stamp behind, which is why one older than LumpSumStampTtl is ignored
    ///      everywhere. This layer is visible state, never the thing that keeps two
    ///      writers apart.
    ///
    /// LOCK ORDER. Every call site takes the applock right after BeginTransactionAsync
    /// and before touching any row, so the five mutators always acquire in the same
    /// order (applock, then rows) and cannot deadlock one another.
    /// </summary>
    public partial class LumpsumController
    {
        /// <summary>How long a second caller waits for the parent before 409 Busy.</summary>
        private const int LumpSumLockWaitMs = 5000;

        /// <summary>A visible stamp older than this is treated as a crash leftover.</summary>
        private static readonly TimeSpan LumpSumStampTtl = TimeSpan.FromMinutes(10);

        private static string LumpSumLockResource(int lumpSumId) => $"MYPS:LumpSum:{lumpSumId}";

        private static IActionResult BusyResult(string message) =>
            new ObjectResult(new { Message = message, Title = "Busy" }) { StatusCode = StatusCodes.Status409Conflict };

        /// <summary>
        /// Takes the parent's application lock for the CURRENT transaction, or returns
        /// the 409 to send back.
        ///
        /// Throws if there is no transaction: with @LockOwner = 'Transaction' the lock
        /// would be released the instant the statement completed, which is the same
        /// as not locking — a silent failure this method refuses to allow.
        /// </summary>
        private async Task<IActionResult?> AcquireLumpSumLockAsync(int lumpSumId, CancellationToken cancellationToken)
        {
            if (_db.Database.CurrentTransaction == null)
                throw new InvalidOperationException(
                    "AcquireLumpSumLockAsync must run inside the caller's transaction; the lock is owned by it.");

            /*  Return codes: 0 granted, 1 granted after waiting, -1 timed out,
                -2 cancelled, -3 chosen as a deadlock victim, -999 parameter error.
                Anything negative is "you do not hold the lock".

                ExecuteSqlRaw with an OUTPUT parameter, not SqlQueryRaw: EF wraps a
                SqlQueryRaw in `SELECT ... FROM (<sql>)`, which is not composable
                over EXEC ("EfNonComposableSql"). ExecuteSqlRaw sends the batch as
                is and, being an EF command, runs on the current transaction's
                connection — which is what @LockOwner = 'Transaction' needs. */
            var ReturnCode = new SqlParameter("@r", SqlDbType.Int) { Direction = ParameterDirection.Output };
            var Resource = new SqlParameter("@resource", SqlDbType.NVarChar, 255) { Value = LumpSumLockResource(lumpSumId) };
            var Wait = new SqlParameter("@wait", SqlDbType.Int) { Value = LumpSumLockWaitMs };

            await _db.Database.ExecuteSqlRawAsync(
                "EXEC @r = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', " +
                "@LockOwner = 'Transaction', @LockTimeout = @wait;",
                new object[] { ReturnCode, Resource, Wait },
                cancellationToken);

            int Result = ReturnCode.Value is int Code ? Code : -999;

            return Result >= 0
                ? null
                : BusyResult("This Lump Sum Project is being itemized or saved by someone else. Try again in a moment.");
        }

        /// <summary>The visible stamp on a parent, or null when absent or older than the TTL.</summary>
        private sealed record LumpSumStamp(string LockedBy, DateTime LockedDate);

        private async Task<LumpSumStamp?> ReadFreshStampAsync(int lumpSumId, CancellationToken cancellationToken)
        {
            var Row = await _db.tProjects
                .AsNoTracking()
                .Where(p => p.Id == lumpSumId)
                .Select(p => new { p.LockedBy, p.LockedDate })
                .FirstOrDefaultAsync(cancellationToken);

            if (Row?.LockedBy == null || Row.LockedDate == null) return null;
            if (Functions.CurrentDate() - Row.LockedDate.Value > LumpSumStampTtl) return null;

            return new LumpSumStamp(Row.LockedBy, Row.LockedDate.Value);
        }

        /*  BOTH STAMP WRITES BYPASS THE CHANGE TRACKER on purpose. The import stamps
            before its transaction and clears in its finally, after a commit OR a
            rollback. After a rollback the DbContext still tracks every child the
            import tried to add, in Added state; a SaveChangesAsync here would insert
            them all outside the transaction. ExecuteUpdateAsync issues one UPDATE
            and touches nothing tracked. The set runs in autocommit so other
            connections can see it while the import is still working. */

        private Task<int> StampLumpSumAsync(int lumpSumId, string userId, DateTime now, CancellationToken cancellationToken) =>
            _db.tProjects
                .Where(p => p.Id == lumpSumId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.LockedBy, userId)
                    .SetProperty(p => p.LockedDate, now), cancellationToken);

        /// <summary>
        /// Clears the stamp, but only if it is still ours — a later import that took
        /// over after our TTL expired must not have its stamp wiped by our finally.
        /// CancellationToken.None: a client that disconnected mid-import still gets
        /// its stamp cleared.
        /// </summary>
        private Task<int> ClearLumpSumStampAsync(int lumpSumId, string userId) =>
            _db.tProjects
                .Where(p => p.Id == lumpSumId && p.LockedBy == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.LockedBy, (string?)null)
                    .SetProperty(p => p.LockedDate, (DateTime?)null), CancellationToken.None);
    }
}
