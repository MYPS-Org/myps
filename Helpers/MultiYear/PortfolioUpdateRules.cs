using DBHelper.Models.Enums;

namespace Helpers.MultiYear
{
    /// <summary>
    /// What the portfolio update does to one membership when the GAA or GAA-R of year Y is approved,
    /// or one of its projects is withdrawn (MY-PFL-11, -21, -22). Every move is a System move of
    /// MembershipStatusRules, so the update follows the status diagram. Pure: the facts are read by
    /// PortfolioGaaUpdate.
    ///
    ///   Potential  in GAA Y                                    -> Ongoing
    ///              not in GAA Y, implemented in another year   -> Ongoing
    ///              proposed for a later budget year            -> unchanged (it waits for that GAA)
    ///              otherwise (never implemented)               -> New, start year Y+1
    ///   New        in GAA Y, or implemented in another year    -> Potential, then Ongoing (it reached
    ///                                                             the annual track outside the module)
    ///              start year &lt;= Y                           -> start year Y+1 ("still new after a GAA")
    ///   Ongoing    every GAA entry withdrawn, none valid       -> New, start year Y+1 (decision 2)
    ///   Completed, Cancelled                                   -> never touched
    ///
    /// IDEMPOTENT: applying the moves and deciding again with the same facts gives no moves.
    /// </summary>
    public static class PortfolioUpdateRules
    {
        /// <summary>
        /// What the approved GAA / GAA-R programs say about the project. An entry is an annual project
        /// in an approved GAA or GAA-R stage whose Multi Year ID is the project's MY id; it is
        /// withdrawn when a Non-Implementable or a Termination with No Disbursements revision of it is
        /// fully approved, and valid otherwise.
        /// </summary>
        /// <param name="InGaa">A valid entry in the GAA / GAA-R of year Y.</param>
        /// <param name="ImplementedOtherYear">A valid entry in an approved GAA / GAA-R of any other year.</param>
        /// <param name="Withdrawn">At least one withdrawn entry, in any year.</param>
        /// <param name="ProposedForLaterYear">A live proposal into an RBP / UBP of a budget year after Y.</param>
        public sealed record Facts(bool InGaa, bool ImplementedOtherYear, bool Withdrawn, bool ProposedForLaterYear);

        /// <summary>One change: a status move, or (From = To) only a start-year move.</summary>
        public sealed record Move(EnumMembershipStatus From, EnumMembershipStatus To, int FromStartYear, int ToStartYear, string Reason);

        public static IReadOnlyList<Move> Decide(EnumMembershipStatus status, int startYear, Facts facts, int year)
        {
            int next = year + 1;
            int rolled = Math.Max(startYear, next);
            var moves = new List<Move>();

            switch (status)
            {
                case EnumMembershipStatus.Potential:
                    if (facts.InGaa)
                        moves.Add(new(status, EnumMembershipStatus.Ongoing, startYear, startYear, $"In the approved GAA {year}."));
                    else if (facts.ProposedForLaterYear)
                        break;
                    else if (facts.ImplementedOtherYear)
                        moves.Add(new(status, EnumMembershipStatus.Ongoing, startYear, startYear, $"Not in the GAA {year}, but implemented in another year's GAA."));
                    else
                        moves.Add(new(status, EnumMembershipStatus.New, startYear, rolled, $"Not in the GAA {year} and never implemented: back to New, start year {rolled}."));
                    break;

                case EnumMembershipStatus.New:
                    if (facts.InGaa || facts.ImplementedOtherYear)
                    {
                        string where = facts.InGaa ? $"the approved GAA {year}" : "an approved GAA of another year";
                        moves.Add(new(status, EnumMembershipStatus.Potential, startYear, startYear, $"Found in {where} by its Multi Year ID."));
                        moves.Add(new(EnumMembershipStatus.Potential, EnumMembershipStatus.Ongoing, startYear, startYear,
                            facts.InGaa ? $"In the approved GAA {year}." : "Implemented in another year's GAA."));
                    }
                    else if (startYear <= year)
                        moves.Add(new(status, status, startYear, next, $"Still New after the GAA {year}: start year moved to {next}."));
                    break;

                case EnumMembershipStatus.Ongoing:
                    if (facts.Withdrawn && !facts.InGaa && !facts.ImplementedOtherYear)
                        moves.Add(new(status, EnumMembershipStatus.New, startYear, rolled,
                            $"Its GAA entry was withdrawn (Non-Implementable or terminated with no disbursement) and it was never implemented: back to New, start year {rolled}."));
                    break;
            }
            return moves;
        }

        /// <summary>The status and start year after <paramref name="moves"/>.</summary>
        public static (EnumMembershipStatus Status, int StartYear) After(EnumMembershipStatus status, int startYear, IReadOnlyList<Move> moves) =>
            moves.Count == 0 ? (status, startYear) : (moves[^1].To, moves[^1].ToStartYear);
    }
}
