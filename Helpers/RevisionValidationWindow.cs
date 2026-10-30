using DBHelper.Data;
using DBHelper.Models.Table.Revision;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Helpers
{
    /// <summary>
    /// Validation Dates (Code Tables → Revisions, UAT S04-TC016, 2026-10-30): for a funding year, the
    /// dates between which a revision of that year's projects can be requested. The funding year is the
    /// program's year, the GAA the project was appropriated in. A year with no active row has no window.
    /// </summary>
    /// <remarks>
    /// The table is created by Migration.RevisionValidationDates.2026-10-30.sql. Until it exists the
    /// reads below answer "no windows" (SQL error 208), so the Code Tables page and revision requests
    /// keep working whichever is deployed first.
    /// </remarks>
    public static class RevisionValidationWindow
    {
        /// <summary>True when <paramref name="today"/> falls inside the window, both end dates included.</summary>
        public static bool IsOpen(DateTime today, DateTime start, DateTime end) =>
            today.Date >= start.Date && today.Date <= end.Date;

        /// <summary>The active window of <paramref name="fundingYear"/>, or null when it has none.</summary>
        public static async Task<OptionRevisionValidationDate?> FindActiveValidationWindowAsync(
            this MYPSDbContext db, int fundingYear, CancellationToken cancellationToken)
        {
            try
            {
                return await db.tOptionRevisionValidationDate.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.FundingYear == fundingYear && x.IsActive, cancellationToken);
            }
            catch (SqlException ex) when (ex.Number == 208)
            {
                return null;
            }
        }

        /// <summary>Every row, newest funding year first; empty when the table is not created yet.</summary>
        public static async Task<List<OptionRevisionValidationDate>> ListValidationWindowsAsync(
            this MYPSDbContext db, CancellationToken cancellationToken)
        {
            try
            {
                return await db.tOptionRevisionValidationDate.AsNoTracking()
                    .OrderByDescending(x => x.FundingYear)
                    .ToListAsync(cancellationToken);
            }
            catch (SqlException ex) when (ex.Number == 208)
            {
                return new List<OptionRevisionValidationDate>();
            }
        }
    }
}
