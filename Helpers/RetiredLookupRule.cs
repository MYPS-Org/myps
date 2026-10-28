namespace Helpers
{
    /// <summary>
    /// The save-time rule for code-table values that were retired (set Inactive, or past their
    /// validity) after records started using them -- #478. A retired value may not be picked for a
    /// new row, or written into an existing row, but a row that already holds it keeps it: the
    /// project forms post every row on every save, so checking unchanged rows would lock the whole
    /// project out of saving (#479). Component Type (UpdateProjectDetails, new IDs only) and Thrust
    /// (ValidateThrustForCategoryAsync, PreviousThrust) already follow this rule.
    /// </summary>
    public static class RetiredLookupRule
    {
        /// <summary>
        /// The rows whose lookup values still have to pass the "is it active" check: rows that are
        /// not being deleted and are either new (Id &lt;= 0, or an Id not found in
        /// <paramref name="storedById"/>) or whose <paramref name="key"/> differs from the stored one.
        /// Make the key every lookup value of the row together, so a row edited in one field has all
        /// of them checked.
        /// </summary>
        /// <param name="storedById">The row's saved key, by row Id, as currently in the database.</param>
        public static List<TRow> RowsRequiringActiveCheck<TRow, TKey>(
            IEnumerable<TRow> rows,
            Func<TRow, int> id,
            Func<TRow, bool> isDeleted,
            Func<TRow, TKey> key,
            IReadOnlyDictionary<int, TKey> storedById) where TKey : notnull
        {
            var result = new List<TRow>();
            foreach (var row in rows)
            {
                if (isDeleted(row))
                    continue;

                int rowId = id(row);
                if (rowId > 0 &&
                    storedById.TryGetValue(rowId, out var stored) &&
                    EqualityComparer<TKey>.Default.Equals(stored, key(row)))
                    continue;

                result.Add(row);
            }
            return result;
        }
    }
}
