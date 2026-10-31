using System.Globalization;

namespace Helpers.MultiYear
{
    /// <summary>
    /// The planning-project import template (MY-PFL-17): its columns, and reading one row's cells.
    /// Pure: no database; MultiYearController.Import resolves the codes and runs the same checks as
    /// Add Planning Project. A row holds the fixed columns, then Amount 1 ... Amount N, where Amount k
    /// is the planned cost of Start Year + k - 1 and N is any number of columns.
    /// </summary>
    public static class PlanningImportRules
    {
        public const int MaxRows = 500;
        public const string ProjectsSheet = "Planning Projects";
        public const string ListsSheet = "Lists";
        public const string AmountHeaderPrefix = "Amount ";

        /// <summary>The fixed columns, in order. A name or a code from the Lists sheet is accepted in
        /// each list column; several Readiness Levels or RDP picks are separated by ";".</summary>
        public static readonly string[] Columns =
        {
            "Description", "Category", "Sub-Category", "Region", "Province", "City / Municipality",
            "Legislative District", "District Engineering Office", "Implementing Office", "Reporting Region",
            "Region Wide", "Horizon Type", "Start Year", "End Year", "Infrastructure Type", "Dominant Type of Work",
            "Physical Target", "Tier", "Basis for Implementation", "NEDA Project Status", "Readiness Levels",
            "RDP Outcomes", "MCA Score",
        };

        public static int ColumnIndex(string header) => Array.IndexOf(Columns, header);

        public static string AmountHeader(int k) => $"{AmountHeaderPrefix}{k}";

        /// <summary>
        /// Null when the header row is the template's: the fixed columns in order, then Amount 1,
        /// Amount 2, ... with no gap. Returns the number of amount columns through
        /// <paramref name="amountColumns"/>.
        /// </summary>
        public static string? HeaderRefusal(IReadOnlyList<string?> headers, out int amountColumns)
        {
            amountColumns = 0;
            for (int i = 0; i < Columns.Length; i++)
            {
                string found = i < headers.Count ? (headers[i] ?? string.Empty).Trim() : string.Empty;
                if (!string.Equals(found, Columns[i], StringComparison.OrdinalIgnoreCase))
                    return $"Column {i + 1} must be \"{Columns[i]}\"{(found.Length == 0 ? "" : $", not \"{found}\"")}. Download the template again.";
            }
            for (int i = Columns.Length; i < headers.Count; i++)
            {
                string found = (headers[i] ?? string.Empty).Trim();
                if (found.Length == 0) break;
                if (!string.Equals(found, AmountHeader(amountColumns + 1), StringComparison.OrdinalIgnoreCase))
                    return $"Column {i + 1} must be \"{AmountHeader(amountColumns + 1)}\", not \"{found}\".";
                amountColumns++;
            }
            return amountColumns == 0 ? $"The template needs at least the column \"{AmountHeader(1)}\"." : null;
        }

        public sealed record AmountsResult(IReadOnlyList<MultiYearCostRules.YearAmount> Years, IReadOnlyList<string> Errors);

        /// <summary>
        /// The planned yearly costs of one row. The amounts run from Amount 1 (the Start Year) to the
        /// last filled cell; a blank before a filled cell is refused (MY-PFL-17: blank amounts are
        /// rejected), as are a zero, a negative and a value that is not a number.
        /// </summary>
        public static AmountsResult ReadAmounts(int startYear, IReadOnlyList<string?> cells)
        {
            var errors = new List<string>();
            var years = new List<MultiYearCostRules.YearAmount>();
            int last = -1;
            for (int i = 0; i < cells.Count; i++)
                if (!string.IsNullOrWhiteSpace(cells[i])) last = i;
            if (last < 0)
                return new AmountsResult(years, new[] { "Enter at least one yearly amount, starting with Amount 1 (the Start Year)." });

            for (int i = 0; i <= last; i++)
            {
                int year = startYear + i;
                string label = $"{AmountHeader(i + 1)} ({year})";
                string? cell = cells[i];
                if (string.IsNullOrWhiteSpace(cell))
                {
                    errors.Add($"{label} is blank, but a later amount is filled. Enter every year's amount from the Start Year on.");
                    continue;
                }
                if (!TryNumber(cell, out decimal amount))
                    errors.Add($"{label} is not a number.");
                else if (amount <= 0)
                    errors.Add($"{label} must be more than zero.");
                else
                    years.Add(new MultiYearCostRules.YearAmount(year, Math.Round(amount, 2)));
            }
            return new AmountsResult(years, errors);
        }

        /// <summary>A code-and-name pair of a Lists-sheet list.</summary>
        public sealed record Option(string Code, string Name);

        /// <summary>
        /// The code a cell names: an exact code first, then an exact name (ignoring case and outer
        /// spaces). A blank cell gives (null, null) unless <paramref name="required"/>.
        /// </summary>
        public static (string? Code, string? Error) Resolve(string? cell, IReadOnlyList<Option> options, string column, bool required)
        {
            string value = (cell ?? string.Empty).Trim();
            if (value.Length == 0)
                return (null, required ? $"{column} is required." : null);
            var byCode = options.Where(o => string.Equals(o.Code, value, StringComparison.OrdinalIgnoreCase)).ToList();
            if (byCode.Count == 1)
                return (byCode[0].Code, null);
            var byName = options.Where(o => string.Equals(o.Name.Trim(), value, StringComparison.OrdinalIgnoreCase)).ToList();
            if (byName.Count == 1)
                return (byName[0].Code, null);
            if (byName.Count > 1)
                return (null, $"{column} \"{value}\" matches {byName.Count} entries. Use its code from the Lists sheet.");
            return (null, $"{column} \"{value}\" is not in the Lists sheet.");
        }

        /// <summary>The parts of a multi-value cell, separated by ";".</summary>
        public static IReadOnlyList<string> SplitList(string? cell) =>
            (cell ?? string.Empty).Split(';').Select(x => x.Trim()).Where(x => x.Length > 0).ToList();

        public static (int? Value, string? Error) ReadYear(string? cell, string column, bool required)
        {
            string value = (cell ?? string.Empty).Trim();
            if (value.Length == 0) return (null, required ? $"{column} is required." : null);
            return TryNumber(value, out decimal n) && n == Math.Floor(n) && n >= MultiYearCostRules.FirstYear && n <= MultiYearCostRules.LastYear
                ? ((int)n, null)
                : (null, $"{column} must be a year between {MultiYearCostRules.FirstYear} and {MultiYearCostRules.LastYear}.");
        }

        public static (decimal? Value, string? Error) ReadNumber(string? cell, string column)
        {
            string value = (cell ?? string.Empty).Trim();
            if (value.Length == 0) return (null, null);
            return TryNumber(value, out decimal n) ? (n, null) : (null, $"{column} is not a number.");
        }

        private static bool TryNumber(string cell, out decimal value) =>
            decimal.TryParse(cell.Trim().Replace(",", string.Empty), NumberStyles.Number | NumberStyles.AllowExponent, CultureInfo.InvariantCulture, out value);
    }
}
