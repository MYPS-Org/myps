namespace Helpers.MultiYear
{
    /// <summary>
    /// Saved totals of a portfolio (MY-PFL-24): per project and term year, the year's cost counts in
    /// exactly one column -- Approved when an approved GAA / GAA-R of that year holds it, else Proposed
    /// when an annual program of that year holds it, else Planned from the shared stream. Pure: the
    /// figures are read by SavedTotalsWriter.
    /// </summary>
    public static class SavedTotalsRules
    {
        /// <summary>What is known about one project-year; null = no entry.</summary>
        public sealed record YearFigures(decimal? Approved, decimal? Proposed, decimal? Planned);

        /// <summary>One saved line: a project's year, or (MultiYearProjectFK null) the portfolio's.</summary>
        public sealed record Line(int? MultiYearProjectFK, int Year, decimal Planned, decimal Proposed, decimal Approved, decimal? Ceiling);

        public static (decimal Planned, decimal Proposed, decimal Approved) Classify(YearFigures figures) =>
            figures.Approved is decimal approved ? (0m, 0m, approved)
            : figures.Proposed is decimal proposed ? (0m, proposed, 0m)
            : (figures.Planned ?? 0m, 0m, 0m);

        /// <summary>
        /// The project lines (zero years left out) followed by one portfolio line per term year with
        /// the sums and that year's budget ceiling.
        /// </summary>
        public static List<Line> Build(IReadOnlyDictionary<(int ProjectFK, int Year), YearFigures> figures,
            IEnumerable<int> termYears, IReadOnlyDictionary<int, decimal> ceilings)
        {
            var lines = new List<Line>();
            foreach (var ((projectFK, year), f) in figures.OrderBy(x => x.Key.ProjectFK).ThenBy(x => x.Key.Year))
            {
                var (planned, proposed, approved) = Classify(f);
                if (planned != 0 || proposed != 0 || approved != 0)
                    lines.Add(new Line(projectFK, year, planned, proposed, approved, null));
            }
            foreach (int year in termYears.OrderBy(y => y))
            {
                var ofYear = lines.Where(l => l.Year == year).ToList();
                lines.Add(new Line(null, year, ofYear.Sum(l => l.Planned), ofYear.Sum(l => l.Proposed), ofYear.Sum(l => l.Approved),
                    ceilings.TryGetValue(year, out var ceiling) ? ceiling : null));
            }
            return lines;
        }

        /// <summary>True when both hold the same lines, in any order: a second identical snapshot is not saved.</summary>
        public static bool Same(IReadOnlyCollection<Line> a, IReadOnlyCollection<Line> b) =>
            a.Count == b.Count && a.ToHashSet().SetEquals(b);
    }
}
