using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Text.Json;

namespace Helpers.MultiYear
{
    /// <summary>
    /// The portfolio update after the GAA or GAA-R of year Y is approved, or one of its projects is
    /// withdrawn (MY-PFL-21, -22). Plan: documents/plans/multi-year-phase-2-annual-program-linking.md.
    ///
    ///   1. Every New, Potential and Ongoing membership of every OPEN portfolio moves as
    ///      PortfolioUpdateRules decides, from what the approved GAA / GAA-R programs hold
    ///      (AnnualEntries: the annual projects whose Multi Year ID is the project's MY id).
    ///   2. Each MY id in an approved GAA / GAA-R of Y that matches no planning project becomes a
    ///      lasting record and an Ongoing membership of the open PIP whose term covers Y.
    ///   3. Each open portfolio whose term covers Y saves its totals, unless they are unchanged.
    ///   4. The run is recorded (tMultiYearUpdateRun) with its counts.
    ///
    /// IDEMPOTENT: a second run with the same programs moves nothing, adds nothing and saves no new
    /// totals; it records one more run. OWN TRANSACTION, under one app lock, so two approvals at once
    /// queue. It is called AFTER the approval has committed (AfterApprovalAsync): the update never
    /// blocks or undoes an approval, and Run GAA Update repeats it on request.
    /// </summary>
    public static class PortfolioGaaUpdate
    {
        private const string LockResource = "MYPS_MultiYearPortfolioUpdate";
        private const int LockTimeoutMs = 60000;

        public sealed record Summary(
            int RunId, int Year, int StatusMoves, int StartYearMoves, int AddedToPip,
            IReadOnlyList<string> NotAddedNoPip, int TotalsSaved)
        {
            /// <summary>What the person who approved is told.</summary>
            public string Message
            {
                get
                {
                    var parts = new List<string>();
                    if (StatusMoves > 0) parts.Add($"{StatusMoves} status change{(StatusMoves == 1 ? "" : "s")}");
                    if (StartYearMoves > 0) parts.Add($"{StartYearMoves} start year{(StartYearMoves == 1 ? "" : "s")} moved to {Year + 1}");
                    if (AddedToPip > 0) parts.Add($"{AddedToPip} project{(AddedToPip == 1 ? "" : "s")} added to PIP");
                    string done = parts.Count == 0
                        ? $"Multi-Year portfolios checked for the GAA {Year}: nothing to change."
                        : $"Multi-Year portfolios updated for the GAA {Year}: {string.Join(", ", parts)}.";
                    return NotAddedNoPip.Count == 0
                        ? done
                        : $"{done} {NotAddedNoPip.Count} project{(NotAddedNoPip.Count == 1 ? "" : "s")} with a Multi Year ID could not be added to PIP: no open PIP covers {Year}.";
                }
            }
        }

        /// <summary>True once Migration.MultiYear.Linking.2026-10-31.sql has run; before that the update
        /// does nothing, so a server without Phase 2 approves programs exactly as before.</summary>
        public static async Task<bool> IsAvailableAsync(MYPSDbContext db, CancellationToken ct) =>
            await db.Database.GetDbConnection().ExecuteScalarAsync<bool>(new CommandDefinition(
                "SELECT CAST(CASE WHEN OBJECT_ID(N'dbo.tMultiYearUpdateRun', N'U') IS NOT NULL THEN 1 ELSE 0 END AS bit);",
                transaction: db.Database.CurrentTransaction?.GetDbTransaction(),
                cancellationToken: ct));

        /// <summary>What an approval's response says about the update (its MultiYearUpdate field).
        /// Failed: the update did not finish, the approval standing.</summary>
        public sealed record Notice(string Message, bool Failed);

        /// <summary>
        /// Runs the update after an approval and NEVER throws: a failure is logged through
        /// <paramref name="logFailure"/> and answered with a failed notice, the approval standing.
        /// Null when the Multi-Year tables are not on the server. Clears the context's change tracker
        /// first: call it last, after the approval has committed.
        /// </summary>
        public static Task<Notice?> AfterApprovalAsync(MYPSDbContext db, int year, EnumUpdateTrigger trigger,
            string? programFK, int? revisionDetailsFK, string userId, Action<Exception> logFailure, CancellationToken ct) =>
            GuardedAsync(db, year, logFailure, async () =>
                await RunAsync(db, year, trigger, programFK, revisionDetailsFK, userId, ct));

        /// <summary>A Non-Implementable revision, or a Termination with No Disbursements (MY-PFL-22).</summary>
        public static bool IsWithdrawal(int revisionGroupId, int reasonId) =>
            revisionGroupId == AnnualEntries.NonImplementableGroup
            || (revisionGroupId == AnnualEntries.TerminationGroup && reasonId == AnnualEntries.NoDisbursementReason);

        /// <summary>
        /// After a revision is fully approved: when it withdraws a project whose Multi Year ID is an MY id,
        /// the update re-runs for the year of the project's program (MY-PFL-22). Never throws, like
        /// <see cref="AfterApprovalAsync"/>; null when there is nothing to update.
        /// </summary>
        public static Task<Notice?> AfterRevisionApprovalAsync(MYPSDbContext db, int revisionGroupId, int reasonId, string projectFK,
            string programFK, int revisionDetailsFK, string userId, Action<Exception> logFailure, CancellationToken ct)
        {
            if (!IsWithdrawal(revisionGroupId, reasonId))
                return Task.FromResult<Notice?>(null);
            return GuardedAsync(db, null, logFailure, async () =>
            {
                if (!await IsAvailableAsync(db, ct))
                    return null;
                string? myId = PipRules.AsMyId(await db.tProjects.AsNoTracking()
                    .Where(p => p.ProjectPK == projectFK).Select(p => p.MYId).FirstOrDefaultAsync(ct));
                int? year = await db.tPrograms.AsNoTracking()
                    .Where(p => p.ProgramPK == programFK).Select(p => (int?)p.StartYear).FirstOrDefaultAsync(ct);
                if (myId == null || year == null)
                    return null; // not a multi-year project: no portfolio follows it
                return await RunAsync(db, year.Value, EnumUpdateTrigger.RevisionApproved, programFK, revisionDetailsFK, userId, ct);
            });
        }

        /// <summary>Runs <paramref name="work"/> on a clean change tracker; a failure is logged and
        /// answered with a failed notice instead of an exception.</summary>
        private static async Task<Notice?> GuardedAsync(MYPSDbContext db, int? year, Action<Exception> logFailure, Func<Task<Summary?>> work)
        {
            try
            {
                db.ChangeTracker.Clear();
                var summary = await work();
                return summary == null ? null : new Notice(summary.Message, false);
            }
            catch (Exception ex)
            {
                db.ChangeTracker.Clear();
                try { logFailure(ex); } catch { /* the notice below still reaches the user */ }
                return new Notice(
                    $"The Multi-Year portfolio update{(year == null ? "" : $" for {year}")} did not finish; the approval itself is saved. An Admin or AUC user can run it again from Multi-Year > Portfolios > GAA Updates.",
                    true);
            }
        }

        /// <summary>One run for year <paramref name="year"/>. Null when the Phase 2 tables are missing.</summary>
        public static async Task<Summary?> RunAsync(MYPSDbContext db, int year, EnumUpdateTrigger trigger,
            string? programFK, int? revisionDetailsFK, string userId, CancellationToken ct)
        {
            if (!await IsAvailableAsync(db, ct))
                return null;

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            int lockResult = await db.Database.GetDbConnection().ExecuteScalarAsync<int>(new CommandDefinition(
                "DECLARE @r INT; EXEC @r = sp_getapplock @Resource = @Resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = @Timeout; SELECT @r;",
                new { Resource = LockResource, Timeout = LockTimeoutMs },
                transaction.GetDbTransaction(), cancellationToken: ct));
            if (lockResult < 0)
                throw new InvalidOperationException($"The Multi-Year portfolio update is already running (sp_getapplock returned {lockResult}).");

            var now = Functions.CurrentDate();
            var run = new MultiYearUpdateRun
            {
                Year = year,
                TriggerKind = trigger,
                ProgramFK = programFK,
                RevisionDetailsFK = revisionDetailsFK,
                RunBy = userId,
                RunDate = now,
            };
            db.tMultiYearUpdateRun.Add(run);
            await db.SaveChangesAsync(ct);

            var entries = await AnnualEntries.LoadAsync(db, null, null, null, ct);
            var approved = entries.Where(e => e.IsApprovedGaa).ToList();
            var validYears = approved.Where(e => !e.Withdrawn)
                .GroupBy(e => e.MyId)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Year).ToHashSet());
            var withdrawn = approved.Where(e => e.Withdrawn).Select(e => e.MyId).ToHashSet();

            // 1. Memberships of open portfolios.
            var proposals = await LiveProposalYearsAsync(db, ct);
            var rows = await (from m in db.tMultiYearPortfolioMember
                              join p in db.tMultiYearPortfolio on m.PortfolioFK equals p.Id
                              join pr in db.tMultiYearProject on m.MultiYearProjectFK equals pr.Id
                              where p.Status == EnumPortfolioStatus.Open
                                    && (m.Status == EnumMembershipStatus.New || m.Status == EnumMembershipStatus.Potential || m.Status == EnumMembershipStatus.Ongoing)
                              select new { Member = m, Project = pr }).ToListAsync(ct);

            int statusMoves = 0, startYearMoves = 0;
            foreach (var row in rows)
            {
                string myId = row.Project.ProjectId.ToUpperInvariant();
                var years = validYears.TryGetValue(myId, out var y) ? y : new HashSet<int>();
                var facts = new PortfolioUpdateRules.Facts(
                    InGaa: years.Contains(year),
                    ImplementedOtherYear: years.Any(x => x != year),
                    Withdrawn: withdrawn.Contains(myId),
                    ProposedForLaterYear: proposals.TryGetValue(row.Project.Id, out var proposed) && proposed.Any(x => x > year));

                var moves = PortfolioUpdateRules.Decide(row.Member.Status, row.Member.StartYear, facts, year);
                if (moves.Count == 0) continue;

                foreach (var move in moves)
                {
                    db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
                    {
                        MemberFK = row.Member.Id,
                        FromStatus = move.From,
                        ToStatus = move.To,
                        FromStartYear = move.FromStartYear,
                        ToStartYear = move.ToStartYear,
                        Reason = move.Reason,
                        RunFK = run.Id,
                        ChangedBy = userId,
                        ChangedDate = now,
                    });
                    if (move.From != move.To) statusMoves++;
                }

                var (status, startYear) = PortfolioUpdateRules.After(row.Member.Status, row.Member.StartYear, moves);
                if (startYear != row.Member.StartYear)
                {
                    startYearMoves++;
                    // The owner membership's start year is the project's (Phase 1 keeps them equal). An end
                    // year now before the start is lifted to it; planned years before the new start are
                    // kept, and the coordinator re-plans them on the project page.
                    if (row.Member.IsOwner)
                    {
                        row.Project.StartYear = startYear;
                        if (row.Project.EndYear is int end && end < startYear)
                            row.Project.EndYear = startYear;
                        row.Project.UpdatedBy = userId;
                        row.Project.UpdatedDate = now;
                    }
                }
                row.Member.Status = status;
                row.Member.StartYear = startYear;
                row.Member.UpdatedBy = userId;
                row.Member.UpdatedDate = now;
            }
            await db.SaveChangesAsync(ct);

            // 2. Unlinked MY ids in the approved GAA / GAA-R of this year go to PIP as Ongoing.
            var linked = (await db.tMultiYearProject.AsNoTracking().Select(p => p.ProjectId).ToListAsync(ct))
                .Select(id => id.ToUpperInvariant()).ToHashSet();
            var unlinked = approved.Where(e => e.Year == year && !e.Withdrawn && !linked.Contains(e.MyId))
                .GroupBy(e => e.MyId)
                .ToList();
            int addedToPip = 0;
            var notAdded = new List<string>();
            if (unlinked.Count > 0)
            {
                var pip = await db.tMultiYearPortfolio
                    .Where(p => p.Kind == EnumPortfolioKind.PIP && p.Status == EnumPortfolioStatus.Open
                                && p.TermStartYear <= year && year <= p.TermStartYear + PortfolioTermRules.TermYears - 1)
                    .FirstOrDefaultAsync(ct);
                if (pip == null)
                    notAdded.AddRange(unlinked.Select(g => g.Key));
                else
                    addedToPip = await AddUnlinkedToPipAsync(db, pip, unlinked, year, run.Id, userId, now, ct);
            }

            // 3. Saved totals of the open portfolios whose term covers the year.
            var covering = await db.tMultiYearPortfolio.AsNoTracking()
                .Where(p => p.Status == EnumPortfolioStatus.Open && p.TermStartYear <= year && year <= p.TermStartYear + PortfolioTermRules.TermYears - 1)
                .ToListAsync(ct);
            int totalsSaved = 0;
            foreach (var portfolio in covering)
            {
                int termEnd = PortfolioTermRules.TermEnd(portfolio.TermStartYear);
                var ofTerm = entries.Where(e => e.Year >= portfolio.TermStartYear && e.Year <= termEnd).ToList();
                if (await SavedTotalsWriter.SaveAsync(db, portfolio, EnumTotalsReason.GaaUpdate, run.Id,
                        $"After the GAA {year} update.", userId, skipIfSame: true, ct, ofTerm) != null)
                    totalsSaved++;
            }

            // 4. The run's counts.
            var summary = new Summary(run.Id, year, statusMoves, startYearMoves, addedToPip, notAdded, totalsSaved);
            run.Summary = JsonSerializer.Serialize(new
            {
                summary.StatusMoves,
                summary.StartYearMoves,
                summary.AddedToPip,
                NotAddedNoPip = summary.NotAddedNoPip.Take(100).ToList(),
                summary.TotalsSaved,
            });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return summary;
        }

        /// <summary>Per planning project, the budget years it has a live proposal for: one whose annual
        /// project still has a live (not deleted) revision.</summary>
        private static async Task<Dictionary<int, List<int>>> LiveProposalYearsAsync(MYPSDbContext db, CancellationToken ct)
        {
            var live = await (from p in db.tMultiYearProposal.AsNoTracking()
                              where db.tProjectRevisions.Any(r => r.ProjectFK == p.ProjectFK && !r.IsDeleted)
                              select new { p.MultiYearProjectFK, p.BudgetYear }).ToListAsync(ct);
            return live.GroupBy(x => x.MultiYearProjectFK).ToDictionary(g => g.Key, g => g.Select(x => x.BudgetYear).Distinct().ToList());
        }

        private sealed class GaaRevisionFacts
        {
            public int RevisionId { get; set; }
            public string Description { get; set; } = string.Empty;
            public int Category { get; set; }
            public int? Thrust { get; set; }
            public string? Region { get; set; }
            public string? Province { get; set; }
            public string? City { get; set; }
            public string? LegislativeDistrict { get; set; }
            public string? DEO { get; set; }
            public string? ImplementingOffice { get; set; }
            public int? RegionWide { get; set; }
            public string? IslandCode { get; set; }
            public int? FirstYear { get; set; }
            public int? LastYear { get; set; }
            public decimal Total { get; set; }
        }

        private const string GaaRevisionFactsSql = """
            SELECT r.Id AS RevisionId, r.Description, r.Category, r.Thrust, r.Region, r.Province, r.City, r.LegislativeDistrict,
                   r.DEO, r.ImplementingOffice, r.RegionWide, r.IslandCode,
                   MIN(y.[Year]) AS FirstYear, MAX(y.[Year]) AS LastYear, ISNULL(SUM(y.Amount), 0) AS Total
            FROM dbo.tProjectRevisions r
            LEFT JOIN dbo.tProjectComponentCost c ON c.ProjectRevisionFK = r.Id AND c.IsDeleted = 0
            LEFT JOIN dbo.tProjectComponentCostPerYear y ON y.ComponentCostFK = c.Id AND y.IsDeleted = 0
            WHERE r.Id IN @Ids
            GROUP BY r.Id, r.Description, r.Category, r.Thrust, r.Region, r.Province, r.City, r.LegislativeDistrict,
                     r.DEO, r.ImplementingOffice, r.RegionWide, r.IslandCode;
            """;

        /// <summary>
        /// One lasting record and one Ongoing PIP membership per unlinked MY id. Its fields come from
        /// the GAA projects carrying that Multi Year ID in the year (the first, by Project ID, for the
        /// description and location); its cost is their total and its years their cost years. Its
        /// yearly costs stay in the annual programs (one cost stream is Phase 3b).
        /// </summary>
        private static async Task<int> AddUnlinkedToPipAsync(MYPSDbContext db, MultiYearPortfolio pip,
            List<IGrouping<string, AnnualEntries.Row>> unlinked, int year, int runId, string userId, DateTime now, CancellationToken ct)
        {
            // Per program and project, its highest approved stage's revision.
            var revisionIds = unlinked.SelectMany(g => g)
                .GroupBy(e => (e.ProgramFK, e.ProjectFK))
                .Select(g => g.OrderByDescending(e => e.StageId).First().RevisionId)
                .Distinct()
                .ToList();
            var facts = (await db.Database.GetDbConnection().QueryAsync<GaaRevisionFacts>(new CommandDefinition(
                    GaaRevisionFactsSql, new { Ids = revisionIds },
                    transaction: db.Database.CurrentTransaction?.GetDbTransaction(), commandTimeout: 120, cancellationToken: ct)))
                .ToDictionary(f => f.RevisionId);
            var horizons = (await db.tOptionMultiYearType.AsNoTracking().Select(h => new { h.Id, h.Years }).ToListAsync(ct))
                .Select(h => (h.Id, h.Years)).ToList();

            int added = 0;
            foreach (var group in unlinked.OrderBy(g => g.Key))
            {
                var chosen = group.GroupBy(e => (e.ProgramFK, e.ProjectFK))
                    .Select(g => g.OrderByDescending(e => e.StageId).First())
                    .OrderBy(e => e.ProjectId)
                    .ToList();
                var revisions = chosen.Select(e => facts.TryGetValue(e.RevisionId, out var f) ? f : null).Where(f => f != null).Cast<GaaRevisionFacts>().ToList();
                if (revisions.Count == 0) continue;
                var head = revisions[0];
                int first = revisions.Where(r => r.FirstYear != null).Select(r => r.FirstYear!.Value).DefaultIfEmpty(year).Min();
                int last = revisions.Where(r => r.LastYear != null).Select(r => r.LastYear!.Value).DefaultIfEmpty(year).Max();
                first = Math.Clamp(first, MultiYearCostRules.FirstYear, MultiYearCostRules.LastYear);
                last = Math.Clamp(Math.Max(last, first), first, MultiYearCostRules.LastYear);
                decimal total = Math.Max(0m, revisions.Sum(r => r.Total));
                string island = !string.IsNullOrWhiteSpace(head.IslandCode) ? head.IslandCode.Trim() : group.Key[^2..];

                var project = new MultiYearProject
                {
                    ProjectId = group.Key,
                    Description = string.IsNullOrWhiteSpace(head.Description) ? group.Key : head.Description.Trim(),
                    Category = head.Category,
                    Thrust = head.Thrust is int t && t != 0 ? t : null,
                    Region = head.Region,
                    Province = head.Province,
                    City = head.City,
                    LegislativeDistrict = head.LegislativeDistrict,
                    DEO = head.DEO,
                    ImplementingOffice = head.ImplementingOffice,
                    RegionWide = head.RegionWide,
                    IslandCode = island,
                    HorizonTypeFK = PipRules.HorizonFor(first, last, horizons),
                    StartYear = first,
                    EndYear = last,
                    OriginalCost = total,
                    CurrentCost = total,
                    OriginProgramFK = chosen[0].ProgramFK,
                    CreatedBy = userId,
                    CreatedDate = now,
                };
                db.tMultiYearProject.Add(project);
                await db.SaveChangesAsync(ct);

                var member = new MultiYearPortfolioMember
                {
                    PortfolioFK = pip.Id,
                    MultiYearProjectFK = project.Id,
                    IsOwner = false,
                    SourcePortfolioFK = null,
                    Status = EnumMembershipStatus.Ongoing,
                    StartYear = first,
                    Cost = total,
                    OriginalCost = total,
                    CreatedBy = userId,
                    CreatedDate = now,
                };
                db.tMultiYearPortfolioMember.Add(member);
                await db.SaveChangesAsync(ct);

                db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
                {
                    MemberFK = member.Id,
                    FromStatus = null,
                    ToStatus = EnumMembershipStatus.Ongoing,
                    ToStartYear = first,
                    ToCost = total,
                    Reason = $"Added from the approved GAA {year} ({string.Join(", ", chosen.Select(e => e.ProjectId).Distinct())}): its Multi Year ID matched no planning project.",
                    RunFK = runId,
                    ChangedBy = userId,
                    ChangedDate = now,
                });
                await db.SaveChangesAsync(ct);
                added++;
            }
            return added;
        }
    }
}
