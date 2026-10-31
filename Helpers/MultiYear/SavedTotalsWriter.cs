using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using Microsoft.EntityFrameworkCore;

namespace Helpers.MultiYear
{
    /// <summary>
    /// Saves a portfolio's totals (MY-PFL-24): planned, proposed and approved cost per project and per
    /// term year, with the year's budget ceiling, as SavedTotalsRules classifies them. Insert only:
    /// nothing in the application edits or deletes a saved total. Runs on the context's open
    /// transaction when there is one.
    /// </summary>
    public static class SavedTotalsWriter
    {
        /// <summary>
        /// Saves the totals now. Returns the snapshot's id, or null when <paramref name="skipIfSame"/>
        /// and the portfolio's latest saved totals hold exactly the same lines (a re-run of the GAA
        /// update that changed nothing saves nothing).
        /// </summary>
        /// <param name="entries">The annual entries already read by the caller (AnnualEntries.LoadAsync), or null to read them.</param>
        public static async Task<int?> SaveAsync(MYPSDbContext db, MultiYearPortfolio portfolio, EnumTotalsReason reason, int? runFK,
            string? note, string userId, bool skipIfSame, CancellationToken ct, IReadOnlyList<AnnualEntries.Row>? entries = null)
        {
            var lines = await ComputeAsync(db, portfolio, entries, ct);

            if (skipIfSame)
            {
                int? latest = await db.tMultiYearTotalsSnapshot.AsNoTracking()
                    .Where(s => s.PortfolioFK == portfolio.Id)
                    .OrderByDescending(s => s.Id)
                    .Select(s => (int?)s.Id)
                    .FirstOrDefaultAsync(ct);
                if (latest != null)
                {
                    var saved = await db.tMultiYearTotalsLine.AsNoTracking()
                        .Where(l => l.SnapshotFK == latest)
                        .Select(l => new SavedTotalsRules.Line(l.MultiYearProjectFK, l.Year, l.Planned, l.Proposed, l.Approved, l.Ceiling))
                        .ToListAsync(ct);
                    if (SavedTotalsRules.Same(saved, lines))
                        return null;
                }
            }

            var snapshot = new MultiYearTotalsSnapshot
            {
                PortfolioFK = portfolio.Id,
                Reason = reason,
                RunFK = runFK,
                Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                TakenBy = userId,
                TakenDate = Functions.CurrentDate(),
            };
            db.tMultiYearTotalsSnapshot.Add(snapshot);
            await db.SaveChangesAsync(ct);
            db.tMultiYearTotalsLine.AddRange(lines.Select(l => new MultiYearTotalsLine
            {
                SnapshotFK = snapshot.Id,
                MultiYearProjectFK = l.MultiYearProjectFK,
                Year = l.Year,
                Planned = l.Planned,
                Proposed = l.Proposed,
                Approved = l.Approved,
                Ceiling = l.Ceiling,
            }));
            await db.SaveChangesAsync(ct);
            return snapshot.Id;
        }

        /// <summary>
        /// The lines the portfolio's totals would hold now. Its projects are its memberships that are
        /// not cancelled. Per project and term year:
        ///   Approved  the year's amount in the approved GAA / GAA-R programs of that year (the highest
        ///             approved stage of each program), withdrawn entries left out;
        ///   Proposed  otherwise, the amount in that year's most advanced annual program holding it, at
        ///             the project's latest stage there;
        ///   Planned   otherwise, the planned stream (Superseded amounts never count).
        /// </summary>
        public static async Task<List<SavedTotalsRules.Line>> ComputeAsync(MYPSDbContext db, MultiYearPortfolio portfolio,
            IReadOnlyList<AnnualEntries.Row>? entries, CancellationToken ct)
        {
            int termStart = portfolio.TermStartYear;
            int termEnd = PortfolioTermRules.TermEnd(termStart);
            var termYears = Enumerable.Range(termStart, termEnd - termStart + 1).ToList();

            var members = await (from m in db.tMultiYearPortfolioMember.AsNoTracking()
                                 join p in db.tMultiYearProject.AsNoTracking() on m.MultiYearProjectFK equals p.Id
                                 where m.PortfolioFK == portfolio.Id && m.Status != EnumMembershipStatus.Cancelled
                                 select new { p.Id, p.ProjectId }).ToListAsync(ct);
            var projectIds = members.Select(x => x.Id).ToList();

            var planned = (await (from c in db.tMultiYearComponent.AsNoTracking()
                                  join y in db.tMultiYearComponentCostPerYear.AsNoTracking() on c.Id equals y.MultiYearComponentFK
                                  where projectIds.Contains(c.MultiYearProjectFK)
                                        && y.Status != EnumCostStreamStatus.Superseded
                                        && y.Year >= termStart && y.Year <= termEnd
                                  select new { c.MultiYearProjectFK, y.Year, y.Amount }).ToListAsync(ct))
                .GroupBy(x => (x.MultiYearProjectFK, x.Year))
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

            var myIds = members.Select(m => m.ProjectId.ToUpperInvariant()).ToHashSet();
            var annual = (entries ?? await AnnualEntries.LoadAsync(db, myIds, termStart, termEnd, ct))
                .Where(e => myIds.Contains(e.MyId) && e.Year >= termStart && e.Year <= termEnd)
                .ToLookup(e => (e.MyId, e.Year));

            var figures = new Dictionary<(int, int), SavedTotalsRules.YearFigures>();
            foreach (var member in members)
            {
                string myId = member.ProjectId.ToUpperInvariant();
                foreach (int year in termYears)
                {
                    var rows = annual[(myId, year)].ToList();
                    figures[(member.Id, year)] = new SavedTotalsRules.YearFigures(
                        ApprovedAmount(rows),
                        ProposedAmount(rows),
                        planned.TryGetValue((member.Id, year), out var p) ? p : null);
                }
            }

            var ceilings = await db.tMultiYearPortfolioCeiling.AsNoTracking()
                .Where(c => c.PortfolioFK == portfolio.Id)
                .ToDictionaryAsync(c => c.Year, c => c.Amount, ct);

            return SavedTotalsRules.Build(figures, termYears, ceilings);
        }

        /// <summary>The year's amount in the approved GAA / GAA-R stages: per program and project the
        /// highest approved stage, withdrawn entries left out. Null when there is none.</summary>
        internal static decimal? ApprovedAmount(IReadOnlyList<AnnualEntries.Row> rows)
        {
            var approved = rows.Where(r => r.IsApprovedGaa && !r.Withdrawn)
                .GroupBy(r => (r.ProgramFK, r.ProjectFK))
                .Select(g => g.OrderByDescending(r => r.StageId).First())
                .ToList();
            return approved.Count == 0 ? null : approved.Sum(r => r.Amount);
        }

        /// <summary>The amount in the most advanced annual program of the year that holds the project, at
        /// the project's latest stage there. Null when no annual program holds it.</summary>
        internal static decimal? ProposedAmount(IReadOnlyList<AnnualEntries.Row> rows)
        {
            var latest = rows.Where(r => r.IsLatest).ToList();
            if (latest.Count == 0) return null;
            var program = latest.OrderByDescending(r => r.StageHierarchy).ThenBy(r => r.ProgramFK).First().ProgramFK;
            return latest.Where(r => r.ProgramFK == program).Sum(r => r.Amount);
        }
    }
}
