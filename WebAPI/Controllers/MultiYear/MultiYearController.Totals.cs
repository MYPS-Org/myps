using DBHelper.Models.Enums;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.MultiYear
{
    /// <summary>
    /// Phase 2: a portfolio's saved totals (MY-PFL-24) -- planned, proposed and approved cost per
    /// project and per term year, with the year's budget ceiling. Saved when a term opens or closes,
    /// after each GAA update, and here on request (Helpers/MultiYear/SavedTotalsWriter.cs). Never
    /// edited: there is no action that changes or deletes one.
    /// </summary>
    public partial class MultiYearController
    {
        /// <summary>The portfolio's saved totals, newest first, each with its per-year portfolio totals.</summary>
        [HttpPost]
        public async Task<IActionResult> ShowSavedTotals([FromBody] PortfolioIdDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: false, cancellationToken);
                if (refusal != null) return refusal;

                var snapshots = await _db.tMultiYearTotalsSnapshot.AsNoTracking()
                    .Where(s => s.PortfolioFK == portfolio!.Id)
                    .OrderByDescending(s => s.Id)
                    .ToListAsync(cancellationToken);
                var ids = snapshots.Select(s => s.Id).ToList();
                var totals = (await _db.tMultiYearTotalsLine.AsNoTracking()
                        .Where(l => ids.Contains(l.SnapshotFK) && l.MultiYearProjectFK == null)
                        .OrderBy(l => l.Year)
                        .ToListAsync(cancellationToken))
                    .ToLookup(l => l.SnapshotFK);
                var projectCounts = await _db.tMultiYearTotalsLine.AsNoTracking()
                    .Where(l => ids.Contains(l.SnapshotFK) && l.MultiYearProjectFK != null)
                    .GroupBy(l => l.SnapshotFK)
                    .Select(g => new { g.Key, Count = g.Select(l => l.MultiYearProjectFK).Distinct().Count() })
                    .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

                return Ok(snapshots.Select(s => new
                {
                    SnapshotId = s.Id,
                    s.Reason,
                    ReasonLabel = TotalsReasonLabel(s.Reason),
                    s.Note,
                    s.TakenBy,
                    s.TakenDate,
                    Projects = projectCounts.TryGetValue(s.Id, out var n) ? n : 0,
                    Years = totals[s.Id].Select(l => new { l.Year, l.Planned, l.Proposed, l.Approved, l.Ceiling }).ToList(),
                }).ToList());
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>One saved total, per project and year.</summary>
        [HttpPost]
        public async Task<IActionResult> SavedTotalsDetails([FromBody] SavedTotalsDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var snapshot = await _db.tMultiYearTotalsSnapshot.AsNoTracking().FirstOrDefaultAsync(s => s.Id == dto.SnapshotId, cancellationToken);
                if (snapshot == null)
                    return Refused("Not Found", "These saved totals could not be found. Reload the portfolio and open them again.");
                var (portfolio, refusal) = await LoadPortfolioAsync(snapshot.PortfolioFK, forWrite: false, cancellationToken);
                if (refusal != null) return refusal;

                var lines = await _db.tMultiYearTotalsLine.AsNoTracking().Where(l => l.SnapshotFK == snapshot.Id).OrderBy(l => l.Year).ToListAsync(cancellationToken);
                var projectIds = lines.Where(l => l.MultiYearProjectFK != null).Select(l => l.MultiYearProjectFK!.Value).Distinct().ToList();
                var projects = await _db.tMultiYearProject.AsNoTracking().Where(p => projectIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => new { p.ProjectId, p.Description }, cancellationToken);

                return Ok(new
                {
                    SnapshotId = snapshot.Id,
                    PortfolioName = await PortfolioNameAsync(portfolio!, cancellationToken),
                    ReasonLabel = TotalsReasonLabel(snapshot.Reason),
                    snapshot.Note,
                    snapshot.TakenBy,
                    snapshot.TakenDate,
                    Years = lines.Where(l => l.MultiYearProjectFK == null).Select(l => new { l.Year, l.Planned, l.Proposed, l.Approved, l.Ceiling }).ToList(),
                    Projects = lines.Where(l => l.MultiYearProjectFK != null)
                        .GroupBy(l => l.MultiYearProjectFK!.Value)
                        .Select(g => new
                        {
                            ProjectId = projects.TryGetValue(g.Key, out var p) ? p.ProjectId : string.Empty,
                            Description = projects.TryGetValue(g.Key, out var d) ? d.Description : string.Empty,
                            Years = g.Select(l => new { l.Year, l.Planned, l.Proposed, l.Approved }).ToList(),
                        })
                        .OrderBy(x => x.ProjectId)
                        .ToList(),
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>Saves the portfolio's totals now (MY-PFL-24, "on request"). Its term must be open.</summary>
        [HttpPost]
        public async Task<IActionResult> SaveTotals([FromBody] SaveTotalsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;

                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                int? id = await SavedTotalsWriter.SaveAsync(_db, portfolio!, EnumTotalsReason.OnRequest, null, dto.Note, _Session.UserId, skipIfSame: false, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Ok(new { SnapshotId = id, Message = $"Totals of {await PortfolioNameAsync(portfolio!, cancellationToken)} saved." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        private static string TotalsReasonLabel(EnumTotalsReason reason) => reason switch
        {
            EnumTotalsReason.TermOpened => "Term opened",
            EnumTotalsReason.TermClosed => "Term closed",
            EnumTotalsReason.GaaUpdate => "After a GAA update",
            EnumTotalsReason.OnRequest => "Saved on request",
            _ => reason.ToString(),
        };
    }
}
