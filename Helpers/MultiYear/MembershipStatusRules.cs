using DBHelper.Models.Enums;

namespace Helpers.MultiYear
{
    /// <summary>
    /// A project's status inside one portfolio changes only as the status diagram of
    /// docs/multi-year (02, "Project status inside a portfolio") shows (MY-PFL-11). Each move is
    /// either set by a coordinator (Manual) or made by the system when a project is proposed or a
    /// GAA is approved (System, PortfolioUpdateRules). Pure: no database.
    ///
    /// ONE MOVE IS NOT ON THE DIAGRAM: Ongoing -> New, when every GAA entry that made the project
    /// Ongoing was withdrawn (Non-Implementable, or Termination with No Disbursements) and it was
    /// never implemented. MY-PFL-22 re-runs the GAA update after those revisions, which changes
    /// nothing without it; the user chose it on 2026-10-31
    /// (documents/plans/multi-year-phase-2-annual-program-linking.md, decision 2).
    /// </summary>
    public static class MembershipStatusRules
    {
        public enum TransitionKind { Manual, System }

        private static readonly (EnumMembershipStatus From, EnumMembershipStatus To, TransitionKind Kind, string Why)[] Transitions =
        {
            (EnumMembershipStatus.New,       EnumMembershipStatus.Potential, TransitionKind.System, "proposed to RBP or UBP"),
            (EnumMembershipStatus.Potential, EnumMembershipStatus.Ongoing,   TransitionKind.System, "in the approved GAA, or implemented earlier"),
            (EnumMembershipStatus.Potential, EnumMembershipStatus.New,       TransitionKind.System, "not in the GAA, never implemented"),
            (EnumMembershipStatus.Ongoing,   EnumMembershipStatus.New,       TransitionKind.System, "its GAA entry was withdrawn and it was never implemented (decision 2)"),
            (EnumMembershipStatus.New,       EnumMembershipStatus.Cancelled, TransitionKind.Manual, "set by coordinator"),
            (EnumMembershipStatus.Ongoing,   EnumMembershipStatus.Completed, TransitionKind.Manual, "set by coordinator"),
            (EnumMembershipStatus.Ongoing,   EnumMembershipStatus.Cancelled, TransitionKind.Manual, "set by coordinator"),
        };

        public static bool CanMove(EnumMembershipStatus from, EnumMembershipStatus to, TransitionKind kind) =>
            Transitions.Any(t => t.From == from && t.To == to && t.Kind == kind);

        /// <summary>The statuses a coordinator may set from <paramref name="from"/>.</summary>
        public static IReadOnlyList<EnumMembershipStatus> ManualTargets(EnumMembershipStatus from) =>
            Transitions.Where(t => t.From == from && t.Kind == TransitionKind.Manual).Select(t => t.To).ToList();

        /// <summary>Completed and cancelled lock the membership from further editing (MY-PFL-13).</summary>
        public static bool IsLocked(EnumMembershipStatus status) =>
            status is EnumMembershipStatus.Completed or EnumMembershipStatus.Cancelled;

        /// <summary>The start year can be edited only while the status is new (MY-PFL-12).</summary>
        public static bool CanEditStartYear(EnumMembershipStatus status) => status == EnumMembershipStatus.New;

        public static string Label(EnumMembershipStatus status) => status.ToString();

        /// <summary>"An" before Ongoing, "A" before the others.</summary>
        private static string Article(EnumMembershipStatus status) => "AEIOU".Contains(Label(status)[0]) ? "An" : "A";

        /// <summary>Null when a coordinator may set <paramref name="to"/>; otherwise the refusal.</summary>
        public static string? ManualMoveRefusal(EnumMembershipStatus from, EnumMembershipStatus to)
        {
            if (!Enum.IsDefined(to))
                return "Choose a status from the list.";
            if (IsLocked(from))
                return $"This project is {Label(from)} in this portfolio and can no longer change.";
            if (from == to)
                return $"This project is already {Label(from)} in this portfolio.";
            if (CanMove(from, to, TransitionKind.Manual))
                return null;
            var allowed = ManualTargets(from);
            return allowed.Count == 0
                ? $"{Article(from)} {Label(from)} project's status is set by the system, not by hand."
                : $"{Article(from)} {Label(from)} project can only be set to {string.Join(" or ", allowed.Select(Label))}.";
        }
    }
}
