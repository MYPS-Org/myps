using DBHelper.Data;
using DBHelper.Models.Table.Project;
using Microsoft.EntityFrameworkCore;

namespace Helpers
{
    /// <summary>
    /// Lump Sum side effects of things that happen elsewhere in the system.
    ///
    /// NOTE: V1 also carried CascadeStageToWalletsAsync, which walked every wallet
    /// of a program and pushed it to the program's new stage. V2 has no such
    /// method and needs none: a Lump Sum Project is an ordinary tProjects row, so
    /// its stage lives in tProjectStages and moves with the program exactly as
    /// every other project's does. That cascade — and the AdvanceProgramStage
    /// endpoint that existed to repair it when someone forgot to press it — were
    /// both consequences of wallets owning a stage of their own.
    /// </summary>
    public static class LumpsumHelper
    {
        /// <summary>
        /// The 'LS' component of a Lump Sum Project's revision — the row that carries
        /// the allocation. Its Total is the FULL allocation (= the parent's funding
        /// lines); its one per-year row's Amount is the REMAINING balance. See the
        /// movement helpers below.
        /// </summary>
        /// <remarks>
        /// tProjectComponentCost.ComponentType stores the component's NAME
        /// ("Lump Sum"), not its code, so the code is resolved through the lookup
        /// rather than hard-coded. The names are editable; the codes are not.
        /// </remarks>
        public static async Task<DBHelper.Models.Table.Project.ProjectComponentCost?> FindLSComponentAsync(
            this MYPSDbContext db,
            int lsRevisionId,
            CancellationToken cancellationToken)
        {
            return await db.tProjectComponentCost
                .Where(x => x.ProjectRevisionFK == lsRevisionId
                         && !x.IsDeleted
                         && db.tOptionProjectComponentType
                               .Where(o => o.ComponentId == "LS")
                               .Select(o => o.ComponentName)
                               .Contains(x.ComponentType))
                .OrderBy(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        /*  THE ALLOCATION MODEL (maintainer decision, 2026-09-06)

                LS component Total     = the full allocation = Σ the parent's live funding
                                         lines. Never falls. Rises with Replenish; follows
                                         funding edits made on the details form.
                LS per-year Amount     = the REMAINING balance = Total − what the children
                                         have drawn. Falls on import, rises on child delete
                                         and on Replenish. vLumpSumSet reads Remaining here.
                ItemizedTotal          = Σ the children's component costs (the view).

            Earlier that day the model was the reverse — Total was the balance and the
            per-year row mirrored it — and before that the row was never moved at all.
            Both figures are now STORED, so "Total = Remaining + Itemized" is a check that
            can drift rather than an identity; the verification blocks in the SQL scripts
            report it as DRIFT, and LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql puts
            existing rows on this model.

            Every movement goes through one of the three helpers below, from wherever it
            originates — the Lump Sum controller (import, replenish, child delete, form
            save) or the Projects module (a child's cost edited, AdjustParentAllocationAsync).
            None of them calls SaveChanges; the caller owns the transaction. */

        /// <summary>
        /// Moves the REMAINING balance by <paramref name="delta"/> — the per-year row only.
        /// The component Total is the allocation and does not move: an import that draws
        /// down, or a child delete that hands back, changes what is left, not what was given.
        /// A single live row takes the delta; several (a shape this module never creates,
        /// an API caller could) put it on the earliest so their sum still tracks; none is
        /// a no-op — CreateLumpSum always writes one.
        /// </summary>
        public static async Task MoveLSBalanceAsync(
            this MYPSDbContext db,
            ProjectComponentCost lsComponent,
            decimal delta,
            string userId,
            DateTime now,
            CancellationToken cancellationToken)
        {
            var Rows = await LiveLSRowsAsync(db, lsComponent.Id, cancellationToken);
            if (Rows.Count == 0) return;

            Rows[0].Amount += delta;
            Rows[0].UpdatedBy = userId;
            Rows[0].UpdatedDate = now;

            lsComponent.UpdatedBy = userId;
            lsComponent.UpdatedDate = now;
        }

        /// <summary>
        /// Raises the allocation by <paramref name="topUp"/> — Total AND the per-year row,
        /// because new money is both given and still available. Replenish, after it has
        /// appended the funding line the top-up came from.
        /// </summary>
        public static async Task RaiseLSAllocationAsync(
            this MYPSDbContext db,
            ProjectComponentCost lsComponent,
            decimal topUp,
            string userId,
            DateTime now,
            CancellationToken cancellationToken)
        {
            lsComponent.Total += topUp;
            await db.MoveLSBalanceAsync(lsComponent, topUp, userId, now, cancellationToken);
        }

        /// <summary>
        /// Derives the LS component from the funding lines: Total := Σ live funding,
        /// per-year Amount := Total − <paramref name="itemizedTotal"/>.
        ///
        /// UpdateLumpSum calls this after the children merge has flushed, so whatever
        /// Total or Amount the client echoed for the LS component is overwritten — the
        /// component is derived, never typed. That is also what closes the stale-Total
        /// hazard: a form save that raced an import can no longer write a pre-import
        /// figure back, because the figure it writes is recomputed here.
        /// </summary>
        /// <returns>False when the revision has no live LS component to derive.</returns>
        public static async Task<bool> SyncLSToFundingAsync(
            this MYPSDbContext db,
            int lsRevisionId,
            decimal itemizedTotal,
            string userId,
            DateTime now,
            CancellationToken cancellationToken)
        {
            var LS = await db.FindLSComponentAsync(lsRevisionId, cancellationToken);
            if (LS == null) return false;

            decimal Funding = await db.tProjectFundingProfile
                .Where(f => f.ProjectRevisionFK == lsRevisionId && !f.IsDeleted)
                .SumAsync(f => (decimal?)f.Amount, cancellationToken) ?? 0m;

            if (LS.Total != Funding)
            {
                LS.Total = Funding;
                LS.UpdatedBy = userId;
                LS.UpdatedDate = now;
            }

            var Rows = await LiveLSRowsAsync(db, LS.Id, cancellationToken);
            if (Rows.Count == 0) return true;

            decimal Balance = Funding - itemizedTotal;
            if (Rows.Count == 1)
            {
                if (Rows[0].Amount != Balance)
                {
                    Rows[0].Amount = Balance;
                    Rows[0].UpdatedBy = userId;
                    Rows[0].UpdatedDate = now;
                }
            }
            else
            {
                /*  Several rows: keep their split, move the difference onto the earliest so
                    the SUM lands on the balance. Not a shape this module creates. */
                decimal Sum = Rows.Sum(r => r.Amount);
                if (Sum != Balance)
                {
                    Rows[0].Amount += Balance - Sum;
                    Rows[0].UpdatedBy = userId;
                    Rows[0].UpdatedDate = now;
                }
            }
            return true;
        }

        private static Task<List<ProjectComponentCostPerYear>> LiveLSRowsAsync(
            MYPSDbContext db, int componentId, CancellationToken cancellationToken) =>
            db.tProjectComponentCostPerYear
                .Where(cy => cy.ComponentCostFK == componentId && !cy.IsDeleted)
                .OrderBy(cy => cy.Year).ThenBy(cy => cy.Id)
                .ToListAsync(cancellationToken);

        /// <summary>What a change to an itemized project's cost did to its parent.</summary>
        public sealed class AllocationAdjustment
        {
            /// <summary>False when the parent could not absorb the change; nothing was written.</summary>
            public bool Applied { get; init; }
            /// <summary>Why not, ready to show the user. Null when Applied.</summary>
            public string? Refusal { get; init; }
            /// <summary>New cost minus old cost. Positive means the parent gave up more.</summary>
            public decimal Delta { get; init; }
            /// <summary>The parent's allocation after the adjustment.</summary>
            public decimal RemainingAfter { get; init; }
            /// <summary>The parent's Project ID, for the note the caller writes.</summary>
            public string ParentProjectId { get; init; } = string.Empty;
        }

        /// <summary>
        /// The decision half of <see cref="AdjustParentAllocationAsync"/>, with no
        /// database in it.
        ///
        /// Split out so the arithmetic and the 2.6.4 floor can be tested directly
        /// at every boundary — delta of zero, a decrease, an increase that exactly
        /// consumes the remainder, and one peso beyond it. Those are the cases
        /// that decide whether a Lump Sum Project's Remaining can be driven
        /// negative, and they are not worth discovering through a browser.
        /// </summary>
        /// <param name="parentProjectId">Null or empty means "not itemized" — a no-op.</param>
        /// <param name="remaining">The parent's live allocation, or null when it could not be resolved.</param>
        /// <param name="hasLSComponent">False when the parent has no 'LS' component to move.</param>
        public static AllocationAdjustment DecideAllocationAdjustment(
            string? parentProjectId,
            decimal costBefore,
            decimal costAfter,
            decimal? remaining,
            bool hasLSComponent)
        {
            if (string.IsNullOrWhiteSpace(parentProjectId))
                return new AllocationAdjustment { Applied = true, Delta = 0m };

            decimal Delta = costAfter - costBefore;

            /*  Nothing moved. Still Applied, so callers do not have to
                special-case "itemized but unchanged". */
            if (Delta == 0m)
                return new AllocationAdjustment
                {
                    Applied = true,
                    Delta = 0m,
                    RemainingAfter = remaining ?? 0m,
                    ParentProjectId = parentProjectId
                };

            if (remaining == null)
                return new AllocationAdjustment
                {
                    Applied = false,
                    Delta = Delta,
                    ParentProjectId = parentProjectId,
                    Refusal = $"This project is itemized from {parentProjectId}, which is no longer a Lump Sum Project. The allocation cannot be kept in step."
                };

            if (!hasLSComponent)
                return new AllocationAdjustment
                {
                    Applied = false,
                    Delta = Delta,
                    ParentProjectId = parentProjectId,
                    Refusal = $"{parentProjectId} has no Lump Sum component to adjust."
                };

            /*  THE 2.6.4 FLOOR. An increase larger than what is left would put the
                parent under water; the spec's own words for the fix are that
                "another itemized Project for the same LS parent must have been
                reduced first". A DECREASE always passes — it hands money back. */
            if (Delta > remaining.Value)
                return new AllocationAdjustment
                {
                    Applied = false,
                    Delta = Delta,
                    RemainingAfter = remaining.Value,
                    ParentProjectId = parentProjectId,
                    Refusal = $"This raises the cost by {Delta:N2}, more than the {remaining.Value:N2} left on {parentProjectId}. Reduce another itemized project under it first."
                };

            return new AllocationAdjustment
            {
                Applied = true,
                Delta = Delta,
                RemainingAfter = remaining.Value - Delta,
                ParentProjectId = parentProjectId
            };
        }

        /// <summary>
        /// Keep a Lump Sum Project's allocation in step with a change to one of its
        /// itemized children's cost.
        ///
        /// Design Report Vol 2 requires this in two places: Comp-1/Comp-2 ("Upon
        /// saving any change in Component amount is reflected in the LS
        /// allocation") and 2.6.4 ("Any change in Project Cost is reflected in the
        /// parent LS allocation automatically"). Section 2.6.4 also sets the hard
        /// limit this enforces: "At no time during the preparation of the
        /// modification can the Parent LS allocation be less than 0".
        ///
        /// Without it the parent's Remaining is a figure frozen at itemization
        /// time: a child itemized at 10M and later edited to 50M leaves the parent
        /// still reporting the 10M deduction — exactly the negative-balance
        /// condition the Operations Guide's weekly QA check exists to catch.
        ///
        /// Does NOT call SaveChanges — the caller owns the transaction, so the
        /// child's new cost and the parent's adjustment commit together or not at
        /// all. A no-op (Applied, Delta 0) for any project that is not itemized,
        /// which is the overwhelming majority.
        /// </summary>
        /// <param name="parentProjectId">tProjects.ParentProjectId of the child; null or empty means "not itemized".</param>
        /// <param name="costBefore">The child's total component cost as it stood before this save.</param>
        /// <param name="costAfter">The child's total component cost after it.</param>
        public static async Task<AllocationAdjustment> AdjustParentAllocationAsync(
            this MYPSDbContext db,
            string? parentProjectId,
            decimal costBefore,
            decimal costAfter,
            string userId,
            DateTime currentDate,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(parentProjectId))
                return new AllocationAdjustment { Applied = true, Delta = 0m };

            /*  Read the state, decide, then write. The decision itself is pure and
                lives in DecideAllocationAdjustment so its boundaries can be tested
                without a database. */
            var Parent = await db.vLumpSumSet
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ProjectId == parentProjectId, cancellationToken);

            DBHelper.Models.Table.Project.ProjectComponentCost? LSComponent = null;
            if (Parent != null)
                LSComponent = await db.FindLSComponentAsync(Parent.RevisionId, cancellationToken);

            var Decision = DecideAllocationAdjustment(
                parentProjectId,
                costBefore,
                costAfter,
                Parent?.Remaining,
                LSComponent != null);

            if (!Decision.Applied || Decision.Delta == 0m || LSComponent == null)
                return Decision;

            /*  A child costing more draws more from what is LEFT; the allocation itself
                is unchanged. Balance only — see the model note at the top of this class. */
            await db.MoveLSBalanceAsync(LSComponent, -Decision.Delta, userId, currentDate, cancellationToken);

            return Decision;
        }
    }
}
