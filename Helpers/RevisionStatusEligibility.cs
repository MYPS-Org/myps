namespace Helpers
{
    /// <summary>
    /// The project-level PCMA and package status a revision is judged by, and the URD's rules on
    /// which revision types a status allows (S03, ATA remark of 2026-10-30).
    ///
    /// The field rules (tRevisionRules, Code Tables > Revision Field Permission) decide WHAT a
    /// revision may change for a status. Every reason carries a row for every status, so they never
    /// refuse a revision: these two URD rules are enforced here, in code, so a rule row switched on
    /// in Code Tables cannot reopen them. Only rules the URD states are listed; the URD's matrix
    /// for the other revision types is still to be applied.
    /// </summary>
    public static class RevisionStatusEligibility
    {
        public const string NotYetStarted = "Not Yet Started";
        public const string OnGoing = "On-Going";
        public const string Completed = "Completed";
        public const string Terminated = "Terminated";
        public const string NotPackaged = "Not Packaged";
        public const string Packaged = "Packaged";

        /// <summary>tOptionRevisionHeader.RevisionGroupId of "Modification".</summary>
        public const int ModificationGroupId = 1;
        /// <summary>tOptionRevisionHeader.RevisionGroupId of "Change in Authority to Implement".</summary>
        public const int ChangeInAuthorityToImplementGroupId = 7;

        /// <summary>
        /// The project's status from its components' PCMA statuses. Moved here unchanged from the
        /// three copies in RevisionController: On-Going wins; all Terminated is Terminated; any
        /// Not Yet Started is Not Yet Started; otherwise Completed. Packaged only when every
        /// component is.
        /// </summary>
        public static (string PcmaStatus, string PackageStatus) ProjectStatus(IEnumerable<(string? StatusName, bool? IsPackaged)> components)
        {
            var list = components.ToList();
            var statuses = list.Select(x => x.StatusName).Distinct().ToList();
            string pcmaStatus = statuses switch
            {
                { Count: 0 } => "No Components",
                _ when statuses.Contains(OnGoing) => OnGoing,
                _ when statuses.Count == 1 && statuses.Contains(Terminated) => Terminated,
                _ when statuses.Contains(NotYetStarted) => NotYetStarted,
                _ when statuses.Contains(Completed) => Completed,
                _ => string.Empty
            };
            string packageStatus = list.Any(x => x.IsPackaged != true) ? NotPackaged : Packaged;
            return (pcmaStatus, packageStatus);
        }

        /// <summary>The refusal for a revision type the URD does not allow at this status, or null.</summary>
        public static string? Refusal(int revisionGroupId, string pcmaStatus, string packageStatus)
        {
            bool Is(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

            // Design Document Vol 2, Modification, Case C: "A Modification is not permitted;
            // warning message is shown, and Modification shall be disallowed, with no changes saved."
            if (revisionGroupId == ModificationGroupId && (Is(pcmaStatus, Completed) || Is(pcmaStatus, Terminated)))
                return "Modification is not allowed because the Project Component has been Completed/Terminated.";

            // URD: Change in Authority to (Bid and) Implement is allowed only if Not Started and Not Packaged.
            if (revisionGroupId == ChangeInAuthorityToImplementGroupId && !(Is(pcmaStatus, NotYetStarted) && Is(packageStatus, NotPackaged)))
                return $"Change in Authority to Implement is allowed only while the project's components are Not Yet Started and Not Packaged. This project's are {pcmaStatus} and {packageStatus}.";

            return null;
        }
    }
}
