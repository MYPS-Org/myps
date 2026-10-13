namespace WebAPI.Controllers.Dashboard
{
    /// <summary>One project's budget in the watchlist ranking.</summary>
    public sealed class DashboardProjectBudget
    {
        public string ProjectPK { get; set; } = string.Empty;
        public string? RegionCode { get; set; }
        public decimal Budget { get; set; }
    }

    /// <summary>
    /// Places a short in-memory list of projects into one page of a long ranking that is paged
    /// in SQL. The watchlist needs this because the projects that read their cost from an
    /// approved formal revision cannot share the SQL statement with the rest: in a UNION ALL
    /// with them, SQL Server picked plans five times slower for the island and search filters.
    ///
    /// Ranking: budget descending, then ProjectPK ascending. With E extra projects, the page
    /// that starts at global position <c>offset</c> can only hold SQL rows from position
    /// <c>offset - E</c> onwards, because at most E extra projects rank ahead of them; so the
    /// caller fetches that window (<see cref="WindowStart"/>) and this places both lists.
    /// Ties are broken with an ordinal comparison here and by the database collation in SQL,
    /// so only an extra project tied on budget with a SQL row at a page edge could be ordered
    /// differently from a single sorted list.
    /// </summary>
    public static class DashboardPageMerge
    {
        /// <summary>First SQL ranking position to fetch for the page starting at <paramref name="offset"/>.</summary>
        public static int WindowStart(int offset, int extraCount) => Math.Max(0, offset - extraCount);

        /// <summary>
        /// The page [<paramref name="offset"/>, <paramref name="offset"/> + <paramref name="limit"/>)
        /// of the ranking that merges <paramref name="window"/> (SQL positions from
        /// <paramref name="windowStart"/> up to offset + limit, or fewer at the end of the ranking)
        /// with every one of the <paramref name="extra"/> projects.
        /// </summary>
        public static List<DashboardProjectBudget> Page(
            IReadOnlyList<DashboardProjectBudget> window,
            int windowStart,
            IReadOnlyList<DashboardProjectBudget> extra,
            int offset,
            int limit)
        {
            var sortedExtra = extra
                .OrderByDescending(item => item.Budget)
                .ThenBy(item => item.ProjectPK, StringComparer.Ordinal)
                .ToList();

            var placed = new List<(int Position, DashboardProjectBudget Item)>(window.Count + sortedExtra.Count);

            // A SQL row's position is exact: its SQL position plus the extra projects ahead of it.
            for (var index = 0; index < window.Count; index++)
            {
                var item = window[index];
                placed.Add((windowStart + index + sortedExtra.Count(other => RanksBefore(other, item)), item));
            }

            // An extra project's position is exact when it falls inside the window. Outside it
            // the count of SQL rows ahead is only bounded, and the bound alone already puts it
            // off this page: ahead of the window it lands below `offset`, past a full window it
            // lands at or after `offset + limit`.
            for (var index = 0; index < sortedExtra.Count; index++)
            {
                var item = sortedExtra[index];
                placed.Add((index + windowStart + window.Count(other => RanksBefore(other, item)), item));
            }

            return placed
                .Where(entry => entry.Position >= offset && entry.Position < offset + limit)
                .OrderBy(entry => entry.Position)
                .Select(entry => entry.Item)
                .ToList();
        }

        private static bool RanksBefore(DashboardProjectBudget first, DashboardProjectBudget second) =>
            first.Budget > second.Budget
            || (first.Budget == second.Budget
                && string.CompareOrdinal(first.ProjectPK, second.ProjectPK) < 0);
    }
}
