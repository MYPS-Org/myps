using DBHelper.Models.Enums;

namespace Helpers.MultiYear
{
    /// <summary>
    /// Proposing a planning project into an RBP or UBP (MY-PFL-20, MY-STK-02). Pure: no database.
    ///
    /// A UBP is not a program stage: it is an RBP-stage program whose Data Security includes the
    /// UDIP's owner office (or the UPMO itself), the same way each regional RBP is the RBP-stage
    /// program whose Data Security is its region. The proposal creates a BP-numbered annual project
    /// for the program's year carrying the MY id as its Multi Year ID -- the field that follows a
    /// project from RBP to BP, NEP and GAA, since an RBP program never advances.
    /// </summary>
    public static class ProposalRules
    {
        /// <summary>Null when this membership may be proposed; otherwise why not.</summary>
        public static string? MembershipRefusal(EnumPortfolioKind kind, EnumMembershipStatus status)
        {
            if (kind == EnumPortfolioKind.PIP)
                return "A project is proposed from its RDIP or UDIP, not from PIP.";
            if (MembershipStatusRules.IsLocked(status))
                return $"This project is {MembershipStatusRules.Label(status)} in this portfolio and can no longer change.";
            if (status == EnumMembershipStatus.Potential)
                return "This project is already proposed and waits for the GAA. It can be proposed again once the GAA is approved.";
            return null;
        }

        /// <summary>New becomes Potential (the diagram's "proposed to RBP or UBP"); an Ongoing project
        /// proposed for its next year stays Ongoing.</summary>
        public static EnumMembershipStatus StatusAfter(EnumMembershipStatus status) =>
            status == EnumMembershipStatus.New ? EnumMembershipStatus.Potential : status;

        /// <summary>
        /// True when the program's Data Security includes the portfolio's owner: the region for an
        /// RDIP; the PMO cluster office, or a UPMO office, for a UDIP.
        /// </summary>
        public static bool ProgramFitsOwner(EnumPortfolioKind kind, string? owner, IEnumerable<string> dataSecurity, IEnumerable<string> upmoOffices)
        {
            if (string.IsNullOrWhiteSpace(owner) || kind == EnumPortfolioKind.PIP)
                return false;
            var offices = dataSecurity.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (offices.Contains(owner.Trim()))
                return true;
            return kind == EnumPortfolioKind.UDIP && upmoOffices.Any(u => offices.Contains(u.Trim()));
        }

        /// <summary>
        /// Null when the project can be proposed for <paramref name="budgetYear"/>; otherwise why not.
        /// </summary>
        /// <param name="plannedAmount">The project's planned (current) amount for that year, all components.</param>
        /// <param name="liveProposalYears">Budget years the project already has a live proposal for.</param>
        public static string? YearRefusal(int budgetYear, int memberStartYear, decimal? plannedAmount, IEnumerable<int> liveProposalYears, string programName)
        {
            if (liveProposalYears.Contains(budgetYear))
                return $"This project is already proposed for {budgetYear}. A project is proposed once per budget year.";
            if (budgetYear < memberStartYear)
                return $"{programName} is for {budgetYear}, before the project's Start Year ({memberStartYear}).";
            if (plannedAmount is not > 0)
                return $"This project has no planned cost for {budgetYear}. Add it to the yearly costs on the project page first.";
            return null;
        }
    }
}
