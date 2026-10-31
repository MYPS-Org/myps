using DBHelper.Models.Enums;

namespace Helpers.MultiYear
{
    /// <summary>
    /// The fixed six-year terms of RDIP, UDIP and PIP portfolios (MY-PFL-03, -04, -06).
    /// Pure: no database. Plan: documents/plans/multi-year-phase-1-portfolio-module.md.
    /// </summary>
    public static class PortfolioTermRules
    {
        public const int TermYears = 6;
        public const int FirstTermStartYear = 1990;
        // The schema allows term starts up to 2095, so a term ends by 2100 like every other year.
        public const int LastTermStartYear = 2095;

        public static int TermEnd(int termStartYear) => termStartYear + TermYears - 1;

        /// <summary>The next term starts the year after this one ends.</summary>
        public static int NextTermStart(int termStartYear) => termStartYear + TermYears;

        /// <summary>"2023–2028".</summary>
        public static string TermLabel(int termStartYear) => $"{termStartYear}–{TermEnd(termStartYear)}";

        /// <summary>Two six-year terms share a year exactly when their starts are less than six years apart.</summary>
        public static bool Overlaps(int termStartA, int termStartB) => Math.Abs(termStartA - termStartB) < TermYears;

        public static string KindName(EnumPortfolioKind kind) => kind.ToString();

        /// <summary>"RDIP Region VI 2023–2028", "PIP 2023–2028".</summary>
        public static string PortfolioName(EnumPortfolioKind kind, string? ownerName, int termStartYear) =>
            string.IsNullOrWhiteSpace(ownerName)
                ? $"{KindName(kind)} {TermLabel(termStartYear)}"
                : $"{KindName(kind)} {ownerName.Trim()} {TermLabel(termStartYear)}";

        /// <summary>
        /// Null when a new portfolio of this kind and owner may start in <paramref name="termStartYear"/>;
        /// otherwise the refusal. <paramref name="existingTermStarts"/> are the term starts the same kind
        /// and owner already has: terms of one owner never overlap. The term right after an existing
        /// one is opened from it (Open Next Term), never created on its own, so its unfinished
        /// projects are carried forward; an earlier, historical term can still be created.
        /// </summary>
        public static string? CreateRefusal(EnumPortfolioKind kind, string? ownerName, int termStartYear, IEnumerable<int> existingTermStarts)
        {
            if (!Enum.IsDefined(kind))
                return "Choose RDIP, UDIP or PIP.";
            if (termStartYear < FirstTermStartYear || termStartYear > LastTermStartYear)
                return $"The term must start between {FirstTermStartYear} and {LastTermStartYear}.";

            var existing = existingTermStarts.ToList();
            int? clash = existing.Where(start => Overlaps(start, termStartYear)).Cast<int?>().OrderBy(x => x).FirstOrDefault();
            if (clash == termStartYear)
                return $"{PortfolioName(kind, ownerName, termStartYear)} already exists.";
            if (clash != null)
                return $"{PortfolioName(kind, ownerName, clash.Value)} overlaps the term {TermLabel(termStartYear)}. Terms of the same owner cannot overlap; the next term after it starts in {NextTermStart(clash.Value)}.";
            int previous = termStartYear - TermYears;
            if (existing.Contains(previous))
                return $"{PortfolioName(kind, ownerName, previous)} is the term before it. Use Open Next Term on that portfolio instead, so its unfinished projects are carried forward.";
            return null;
        }

        /// <summary>Null while the portfolio's term is Open; otherwise why nothing in it can change.</summary>
        public static string? WriteRefusal(EnumPortfolioStatus status, int termStartYear) =>
            status == EnumPortfolioStatus.Open
                ? null
                : $"The term {TermLabel(termStartYear)} is closed and read-only.";
    }
}
