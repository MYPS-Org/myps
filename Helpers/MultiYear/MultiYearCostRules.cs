namespace Helpers.MultiYear
{
    /// <summary>
    /// Planned yearly costs of a multi-year project (MY-PRJ-05, -06, -10, -26). Errors refuse the
    /// save; warnings are reported and the save goes ahead: the horizon drives warnings, not limits.
    /// Pure: no database.
    /// </summary>
    public static class MultiYearCostRules
    {
        public const int FirstYear = 1990;
        public const int LastYear = 2100;

        public sealed record YearAmount(int Year, decimal Amount);

        public sealed record Result(IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings)
        {
            public bool IsValid => Errors.Count == 0;
        }

        /// <summary>The project's start and end years: start in range, end not before start.</summary>
        public static string? YearsRefusal(int startYear, int? endYear)
        {
            if (startYear < FirstYear || startYear > LastYear)
                return $"Start Year must be between {FirstYear} and {LastYear}.";
            if (endYear != null && (endYear < startYear || endYear > LastYear))
                return $"End Year must be between the Start Year ({startYear}) and {LastYear}.";
            return null;
        }

        /// <param name="horizonYears">Years of the horizon type; null for the open-ended long term.</param>
        /// <param name="horizonName">Its name, for the warning ("Medium term").</param>
        public static Result Check(int startYear, int? endYear, int? horizonYears, string horizonName, IReadOnlyList<YearAmount> years)
        {
            var errors = new List<string>();
            var warnings = new List<string>();

            if (years.Count == 0)
            {
                errors.Add("Enter at least one planned yearly cost.");
                return new Result(errors, warnings);
            }

            foreach (int year in years.GroupBy(y => y.Year).Where(g => g.Count() > 1).Select(g => g.Key).OrderBy(y => y))
                errors.Add($"{year} is entered more than once.");

            foreach (var row in years.OrderBy(y => y.Year))
            {
                if (row.Amount <= 0)
                    errors.Add($"The planned cost for {row.Year} must be more than zero.");
                if (row.Year < startYear)
                    errors.Add($"{row.Year} is before the Start Year ({startYear}).");
                else if (endYear != null && row.Year > endYear)
                    errors.Add($"{row.Year} is after the End Year ({endYear}).");
                else if (row.Year > LastYear)
                    errors.Add($"{row.Year} is after {LastYear}.");
            }

            if (horizonYears != null)
            {
                int lastInHorizon = startYear + horizonYears.Value - 1;
                var beyond = years.Select(y => y.Year).Where(y => y > lastInHorizon).Distinct().OrderBy(y => y).ToList();
                if (beyond.Count > 0)
                    warnings.Add($"{string.Join(", ", beyond)} {(beyond.Count == 1 ? "is" : "are")} beyond the {horizonName} horizon ({startYear}–{lastInHorizon}). Saved anyway.");
            }

            return new Result(errors.Distinct().ToList(), warnings);
        }
    }
}
