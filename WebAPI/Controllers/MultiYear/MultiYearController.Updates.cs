using DBHelper.Models.Enums;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace WebAPI.Controllers.MultiYear
{
    /// <summary>
    /// Phase 2: the runs of the portfolio update after a GAA / GAA-R approval (MY-PFL-21, -22), and
    /// running it on request. The update itself is Helpers/MultiYear/PortfolioGaaUpdate.cs; it runs on
    /// its own after every approval, so this page is for checking it and repeating it (it is
    /// idempotent). Grants seeded to Admin and AUC.
    /// </summary>
    public partial class MultiYearController
    {
        /// <summary>The latest runs, and the years that have an approved GAA or GAA-R to run for.</summary>
        [HttpPost]
        public async Task<IActionResult> ShowUpdateRuns(CancellationToken cancellationToken)
        {
            try
            {
                var runs = await _db.tMultiYearUpdateRun.AsNoTracking().OrderByDescending(r => r.Id).Take(50).ToListAsync(cancellationToken);
                var programNames = await ProgramNamesAsync(runs.Where(r => r.ProgramFK != null).Select(r => r.ProgramFK!).Distinct().ToList(), cancellationToken);
                return Ok(new
                {
                    Years = await ApprovedGaaYearsAsync(cancellationToken),
                    Runs = runs.Select(r => new
                    {
                        r.Id,
                        r.Year,
                        r.TriggerKind,
                        Trigger = TriggerLabel(r.TriggerKind),
                        ProgramName = r.ProgramFK != null && programNames.TryGetValue(r.ProgramFK, out var name) ? name : null,
                        Counts = ReadCounts(r.Summary),
                        r.RunBy,
                        r.RunDate,
                    }).ToList(),
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        /// <summary>Runs the portfolio update for a year that has an approved GAA or GAA-R. Running it
        /// again changes nothing that the last run already did.</summary>
        [HttpPost]
        public async Task<IActionResult> RunGaaUpdate([FromBody] RunGaaUpdateDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (!(await ApprovedGaaYearsAsync(cancellationToken)).Contains(dto.Year))
                    return Refused("No Approved GAA", $"No GAA or GAA-R program for {dto.Year} is approved, so there is nothing to update from.");

                var summary = await PortfolioGaaUpdate.RunAsync(_db, dto.Year, EnumUpdateTrigger.OnRequest, null, null, _Session.UserId, cancellationToken);
                if (summary == null)
                    return Refused("Not Available", "The Multi-Year portfolio update is not on this server yet. Ask your administrator to run Migration.MultiYear.Linking.2026-10-31.sql.");
                return Ok(new { summary.RunId, Message = summary.Message });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>The years with an approved GAA or GAA-R stage in a program that is not deleted.</summary>
        private async Task<List<int>> ApprovedGaaYearsAsync(CancellationToken ct) =>
            await (from s in _db.tProgramStages.AsNoTracking()
                   join r in _db.tProgramRevisions.AsNoTracking() on s.RevisionId equals r.Id
                   join p in _db.tPrograms.AsNoTracking() on s.ProgramFK equals p.ProgramPK
                   where (s.StageId == EnumProgramStage.GAA || s.StageId == EnumProgramStage.GAAR)
                         && r.Status == EnumProgramStatus.Approved && !p.IsDeleted
                   select p.StartYear).Distinct().OrderByDescending(y => y).ToListAsync(ct);

        /// <summary>Program names (the current stage's) by ProgramPK.</summary>
        private async Task<Dictionary<string, string>> ProgramNamesAsync(List<string> programPKs, CancellationToken ct) =>
            programPKs.Count == 0 ? new()
            : await _db.vProgramLatest.AsNoTracking().Where(p => programPKs.Contains(p.ProgramPK))
                .ToDictionaryAsync(p => p.ProgramPK, p => p.Name, ct);

        private static string TriggerLabel(EnumUpdateTrigger trigger) => trigger switch
        {
            EnumUpdateTrigger.GaaApproved => "GAA approved",
            EnumUpdateTrigger.GaaRApproved => "GAA-R approved",
            EnumUpdateTrigger.GaaAdvanced => "GAA advanced to GAA-R",
            EnumUpdateTrigger.RevisionApproved => "Revision approved (Non-Implementable / Termination)",
            EnumUpdateTrigger.OnRequest => "Run on request",
            _ => trigger.ToString(),
        };

        private static JsonElement? ReadCounts(string summary)
        {
            try { return JsonSerializer.Deserialize<JsonElement>(summary); }
            catch (JsonException) { return null; }
        }
    }
}
