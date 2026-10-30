using System.Text.RegularExpressions;

namespace Helpers
{
    /// <summary>
    /// The number in a new future road / road section / bridge ID: FR, FS or FB + 5 digits + island code.
    /// </summary>
    public static class FutureInfraIds
    {
        private static readonly Regex IdNumber =
            new(@"^F[RSB](\d{5})[A-Z]{2}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>
        /// The lowest number from 1 to 99999 that no ID with this prefix holds, on any island (FS00012LZ and
        /// FS00012VS share 12); null when every number is taken.
        ///
        /// Lowest, not highest + 1 (S06-TC003-P001). The IDs migrated from RBIA were assigned by hand and are
        /// scattered (project work locations reach FS97844 / FB97614 with ~1,500 numbers used), so highest + 1
        /// left about 2,000 numbers, and a number freed by deleting an unused road, section or bridge was never
        /// handed out again.
        /// </summary>
        public static int? LowestFreeNumber(IEnumerable<string?> usedIds, string prefix)
        {
            var used = new HashSet<int>();
            foreach (var id in usedIds)
            {
                var normalized = (id ?? string.Empty).Trim().ToUpperInvariant();
                var match = IdNumber.Match(normalized);
                if (match.Success && normalized.StartsWith(prefix, StringComparison.Ordinal))
                {
                    used.Add(int.Parse(match.Groups[1].Value));
                }
            }

            for (var number = 1; number <= 99999; number++)
            {
                if (!used.Contains(number))
                {
                    return number;
                }
            }

            return null;
        }

        /// <summary>FR00001LZ: the prefix, the number as 5 digits, the island code.</summary>
        public static string Format(string prefix, int number, string islandCode) => $"{prefix}{number:D5}{islandCode}";
    }
}
