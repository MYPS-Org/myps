using DBHelper.Models.Enums;
using System.Text.RegularExpressions;

namespace Helpers.MultiYear
{
    /// <summary>
    /// PIP membership (MY-PFL-10, -18, -19, -21): a PPC adds an RDIP / UDIP project to PIP and keeps
    /// its PIP cost; the GAA update adds an approved GAA project whose Multi Year ID matches no planning
    /// project. Pure: no database.
    /// </summary>
    public static class PipRules
    {
        public const decimal McaMin = 0m;
        public const decimal McaMax = 100m;

        /// <summary>
        /// Null when the source membership may be added to the PIP; otherwise why not. New and
        /// Potential may enter (open question OQ-05: the design recommends both, the URD says new).
        /// </summary>
        public static string? AddRefusal(EnumPortfolioKind sourceKind, EnumMembershipStatus sourceStatus, int sourceStartYear,
            int pipTermStartYear, bool alreadyInPip, decimal? mcaScore)
        {
            if (sourceKind == EnumPortfolioKind.PIP)
                return "Choose a project from an RDIP or UDIP.";
            if (sourceStatus is not (EnumMembershipStatus.New or EnumMembershipStatus.Potential))
                return $"Only a New or Potential project can be added to PIP; this one is {MembershipStatusRules.Label(sourceStatus)}.";
            if (alreadyInPip)
                return "This project is already in this PIP.";
            int termEnd = PortfolioTermRules.TermEnd(pipTermStartYear);
            if (sourceStartYear > termEnd)
                return $"This project starts in {sourceStartYear}, after this PIP term ({PortfolioTermRules.TermLabel(pipTermStartYear)}).";
            return McaRefusal(mcaScore);
        }

        public static string? McaRefusal(decimal? mcaScore) =>
            mcaScore is not decimal mca ? "Enter the project's MCA Score."
            : mca < McaMin || mca > McaMax ? $"MCA Score must be between {McaMin:0} and {McaMax:0}."
            : null;

        /// <summary>Null when <paramref name="cost"/> may be the PIP cost; the Original Cost never changes.</summary>
        public static string? CostRefusal(decimal cost) =>
            cost <= 0 ? "The PIP cost must be more than zero." : null;

        private static readonly Regex MyIdPattern = new(@"^MY\d{8}[A-Z]{2}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>The MY id in a Multi Year ID, trimmed and upper-cased; null when it is not one
        /// (MY + three-digit year + five-digit number + island code, as GenerateProjectID makes).</summary>
        public static string? AsMyId(string? multiYearId)
        {
            if (string.IsNullOrWhiteSpace(multiYearId)) return null;
            string id = multiYearId.Trim().ToUpperInvariant();
            return MyIdPattern.IsMatch(id) ? id : null;
        }

        /// <summary>
        /// The horizon a GAA project's cost years give it: the shortest horizon type that holds them,
        /// the open-ended one otherwise. <paramref name="horizons"/> are (Id, Years) with Years null for
        /// the long term.
        /// </summary>
        public static int HorizonFor(int firstYear, int lastYear, IReadOnlyList<(int Id, int? Years)> horizons)
        {
            int span = lastYear - firstYear + 1;
            var fitting = horizons.Where(h => h.Years is int y && y >= span).OrderBy(h => h.Years).ToList();
            if (fitting.Count > 0) return fitting[0].Id;
            var open = horizons.Where(h => h.Years == null).ToList();
            return open.Count > 0 ? open[0].Id : horizons.OrderByDescending(h => h.Years).First().Id;
        }
    }
}
