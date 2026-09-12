using DBHelper.Models.Table.Project;
using Hangfire.Importing;
using Microsoft.EntityFrameworkCore;
using static Hangfire.Importing.ImportingHelper;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// The validation half of the itemization import: every row of the workbook is judged
    /// by the Importing module's own validators and structural rules BEFORE the transaction
    /// opens, and the result is either a clean set of rows carrying their resolved codes or
    /// the four error lists <c>ImportErrorWorkbookBuilder</c> turns into the annotated file.
    ///
    /// Nothing here is a copy. The four validators are ImportingHelper's, called verbatim;
    /// the cross-sheet rules are ImportStructuralRules, the same class the Program importer
    /// calls. What is local is the policy around them, and it is deliberately small:
    ///
    ///   WARN IS IMPORTED AND REPORTED (2026-09-06), the same as the Program importer. A
    ///   warned row carries its resolved codes like any other — the validators stamp them
    ///   whenever IsValid — so it is written, and every warning is reported twice over: in
    ///   Warnings[] on the 200 response, which the dialog lists, and in a .txt report kept
    ///   under Resources/Imports, because a toast is gone on the next refresh and some of
    ///   these warnings mean a value was DROPPED (an unparseable date, Rank, coordinate or
    ///   chainage is stored NULL) rather than merely questioned.
    ///
    ///   This reverses the V3 "warn is fail" promotion. That was chosen because this import
    ///   was all-or-nothing and had no warning channel; the channel now exists, and refusing
    ///   a whole workbook over one out-of-range coordinate cost more than it saved.
    ///
    ///   ATOMIC PER PROJECT, NOT PER WORKBOOK (also 2026-09-06, same session). A Fail still
    ///   refuses its row, and the structural cascade still pulls that project's rows on the
    ///   other three sheets down with it — so a project is either wholly written or wholly
    ///   in the error workbook. But the OTHER projects in the workbook are imported. This is
    ///   the Program importer's behaviour, and it replaces V2's "the whole import succeeds
    ///   or fails together": a workbook of twenty projects with one bad city no longer has
    ///   nineteen good ones held hostage. The one transaction still covers everything that
    ///   is written, so an accepted project is never half-created; only if NO project is
    ///   acceptable does the request answer 400 as before.
    ///
    ///   Two rules stay neutralised at their source rather than filtered afterwards, because
    ///   IsWarning is a single row-level flag and their text would otherwise appear in
    ///   Warnings[] on every row:
    ///
    ///   M2, "Incorrect Reference ID". The rule expects the convention
    ///   "{ProjectId}-{ComponentId}"; the workbook's own value is kept for the report but
    ///   the row is validated against the convention so the rule cannot fire. ReferenceId is
    ///   never persisted — nothing in Save* reads it — so nothing is lost. Left neutralised
    ///   rather than restored with the rest: the frontend deliberately mints
    ///   "{ProjectId}-{ComponentId}-{n}" so one component can carry several items, which
    ///   would warn on every row and drown the real warnings.
    ///
    ///   P10, duplicate Description. ImportingHelper made it a Warn because the main app
    ///   prompts a human and proceeds. Itemized children of one Lump Sum Project plausibly
    ///   share descriptions, so the validator is handed an EMPTY description list (the only
    ///   input that rule reads) and the duplicate scan runs separately, feeding Notices[]
    ///   on the success response.
    ///
    ///   NOT APPLIED: the identity gates (a Project ID that already exists under this
    ///   Program+Stage, ambiguous AlternateIds, island conflicts) and IsValidProgramId.
    ///   Itemization only ever creates new projects, and it attaches them to the PARENT's
    ///   stage — not the program's latest — so those gates have nothing to guard.
    /// </summary>
    public partial class LumpsumController
    {
        /// <summary>What the validation pass hands to the write loop, or to the error workbook.</summary>
        private sealed class LumpSumImportVerdict
        {
            public List<ImportProjectDetailsExcel> ProjectDetails { get; } = new();
            public List<ImportFundingProfileExcel> FundingProfile { get; } = new();
            public List<ImportComponentDetailsExcel> ComponentDetails { get; } = new();
            public List<ImportMajorItemsOfWorkExcel> MajorItemsOfWork { get; } = new();

            public List<ImportProjectDetailsExcel> ErrorProjectDetails { get; } = new();
            public List<ImportFundingProfileExcel> ErrorFundingProfile { get; } = new();
            public List<ImportComponentDetailsExcel> ErrorComponentDetails { get; } = new();
            public List<ImportMajorItemsOfWorkExcel> ErrorMajorItemsOfWork { get; } = new();

            /*  WARNED ROWS ARE HELD SEPARATELY ONLY UNTIL THE VERDICT IS FINAL. They are
                what the structural rules judge alongside the valid ones, what the report is
                built from, and then they are merged into the four lists above so the write
                loop cannot treat them differently. After MergeWarnedRowsIntoWrites they are
                the report's record, not a bucket anyone should still be reading. */
            public List<ImportProjectDetailsExcel> WarningProjectDetails { get; } = new();
            public List<ImportFundingProfileExcel> WarningFundingProfile { get; } = new();
            public List<ImportComponentDetailsExcel> WarningComponentDetails { get; } = new();
            public List<ImportMajorItemsOfWorkExcel> WarningMajorItemsOfWork { get; } = new();

            /// <summary>One line per failing row, for the dialog's Errors tab.</summary>
            public List<string> Errors { get; } = new();
            /// <summary>One line per warned row, for the dialog's Warnings tab and the report.</summary>
            public List<string> Warnings { get; } = new();
            /// <summary>Non-blocking observations (P10 duplicates) for the success response.</summary>
            public List<string> Notices { get; } = new();

            public bool HasErrors =>
                ErrorProjectDetails.Count > 0 || ErrorFundingProfile.Count > 0
                || ErrorComponentDetails.Count > 0 || ErrorMajorItemsOfWork.Count > 0;

            public int ErrorRowCount =>
                ErrorProjectDetails.Count + ErrorFundingProfile.Count
                + ErrorComponentDetails.Count + ErrorMajorItemsOfWork.Count;

            public int WarningRowCount =>
                WarningProjectDetails.Count + WarningFundingProfile.Count
                + WarningComponentDetails.Count + WarningMajorItemsOfWork.Count;

            /// <summary>
            /// Projects refused outright. After the structural rules a project is either
            /// wholly in the write lists or wholly in the error buckets — a failure on any
            /// sheet cascades to its Project Details row — so the distinct Project IDs in
            /// ErrorProjectDetails are exactly the refused projects.
            /// </summary>
            public int RefusedProjectCount =>
                ErrorProjectDetails.Select(p => p.ProjectId ?? string.Empty)
                    .Distinct(StringComparer.OrdinalIgnoreCase).Count();

            /// <summary>Projects that will be written, once the warned rows are merged.</summary>
            public int AcceptedProjectCount => ProjectDetails.Count;

            /// <summary>
            /// Folds the warned rows into the write lists. Called once, after the structural
            /// rules have had their say and the report lines are built — so a warned row that
            /// the cascade demoted is already gone from here, and one that survived is written
            /// exactly like a clean row.
            /// </summary>
            public void MergeWarnedRowsIntoWrites()
            {
                ProjectDetails.AddRange(WarningProjectDetails);
                FundingProfile.AddRange(WarningFundingProfile);
                ComponentDetails.AddRange(WarningComponentDetails);
                MajorItemsOfWork.AddRange(WarningMajorItemsOfWork);
            }
        }

        private async Task<LumpSumImportVerdict> ValidateImportedWorkbookAsync(
            ImportProjectDTOExcel rows,
            ImportLookupCache cache,
            string programPK,
            int programStartYear,
            CancellationToken cancellationToken)
        {
            var verdict = new LumpSumImportVerdict();

            /*  P10 is bypassed at its source: this list is the only input the duplicate-
                Description rule reads, and empty means it cannot fire. The real scan is
                below, and feeds Notices rather than Errors. */
            var noDescriptions = new List<(string Description, string ProjectId)>();

            /*  ERROR FIRST, then warning, then clean — the Program importer's own order
                (ImportProjectJobService). A row can be both: Fail and Warn set different
                flags and append to one message, so a row that failed is an error whatever
                else it also said. */
            foreach (var item in rows.ProjectDetails)
            {
                var r = _db.ValidateProjectDetails(item, cache, noDescriptions, programStartYear);
                if (!r.IsValid) verdict.ErrorProjectDetails.Add(item);
                else if (r.IsWarning) verdict.WarningProjectDetails.Add(item);
                else verdict.ProjectDetails.Add(item);
            }

            /*  ValidateFundingProfile has no Warn call today — every one of its rules is a
                hard Fail. The warning branch is here for symmetry, so adding one later needs
                no change on this side. */
            foreach (var item in rows.FundingProfile)
            {
                var r = _db.ValidateFundingProfile(item, cache);
                if (!r.IsValid) verdict.ErrorFundingProfile.Add(item);
                else if (r.IsWarning) verdict.WarningFundingProfile.Add(item);
                else verdict.FundingProfile.Add(item);
            }

            // Precomputed once for the whole workbook — see BuildComponentCostGroupTotals.
            var groupTotals = BuildComponentCostGroupTotals(rows.ComponentDetails, cache, programStartYear);
            foreach (var item in rows.ComponentDetails)
            {
                var r = _db.ValidateComponentDetails(item, rows.ComponentDetails, cache, programStartYear, groupTotals);
                if (!r.IsValid) verdict.ErrorComponentDetails.Add(item);
                else if (r.IsWarning) verdict.WarningComponentDetails.Add(item);
                else verdict.ComponentDetails.Add(item);
            }

            foreach (var item in rows.MajorItemsOfWork)
            {
                /*  M2 is bypassed at its source: validated against the convention the rule
                    expects, then the workbook's own value put back so the error report
                    shows what the user typed. ReferenceId is not persisted by any Save*. */
                var workbookReferenceId = item.ReferenceId;
                item.ReferenceId = $"{item.ProjectId}-{item.ComponentId}";
                var r = _db.ValidateMajorItemsOfWork(item, rows.ComponentDetails, rows.MajorItemsOfWork, cache, programStartYear);
                item.ReferenceId = workbookReferenceId;

                if (!r.IsValid) verdict.ErrorMajorItemsOfWork.Add(item);
                else if (r.IsWarning) verdict.WarningMajorItemsOfWork.Add(item);
                else verdict.MajorItemsOfWork.Add(item);
            }

            /*  The cross-sheet rules, shared with the Program importer. The warned rows go in
                as themselves: Apply treats a warn bucket exactly as it treats a valid one and
                can only ever demote out of either, so a warned row whose sibling sheet failed
                is still pulled into error and refused with the rest of its project. */
            ImportStructuralRules.Apply(
                verdict.ProjectDetails, verdict.FundingProfile, verdict.ComponentDetails, verdict.MajorItemsOfWork,
                verdict.WarningProjectDetails, verdict.WarningFundingProfile, verdict.WarningComponentDetails, verdict.WarningMajorItemsOfWork,
                verdict.ErrorProjectDetails, verdict.ErrorFundingProfile, verdict.ErrorComponentDetails, verdict.ErrorMajorItemsOfWork);

            // Same ordering the Program importer applies before it builds the report.
            verdict.ErrorProjectDetails.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
            verdict.ErrorFundingProfile.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
            verdict.ErrorComponentDetails.Sort((a, b) =>
            {
                int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                c = string.Compare(a.ComponentType, b.ComponentType, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                return string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase);
            });
            verdict.ErrorMajorItemsOfWork.Sort((a, b) =>
            {
                int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                c = string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                return string.Compare(a.InfrastructureId, b.InfrastructureId, StringComparison.OrdinalIgnoreCase);
            });

            foreach (var p in verdict.ErrorProjectDetails)
                verdict.Errors.Add($"PROJECT DETAILS · {p.ProjectId}: {p.ErrorMessage}");
            foreach (var f in verdict.ErrorFundingProfile)
                verdict.Errors.Add($"FUNDING PROFILE · {f.ProjectId} · {f.Source}/{f.Agreement}: {f.ErrorMessage}");
            foreach (var c in verdict.ErrorComponentDetails)
                verdict.Errors.Add($"COMPONENT DETAILS · {c.ProjectId} · {c.ComponentId}: {c.ErrorMessage}");
            foreach (var m in verdict.ErrorMajorItemsOfWork)
                verdict.Errors.Add($"MAJOR ITEMS OF WORK · {m.ProjectId} · {m.ComponentId} · {m.InfrastructureId}: {m.ErrorMessage}");

            /*  NO EARLY RETURN ON ERRORS (2026-09-06, per-project atomicity). A failed
                project's rows — its own and the ones the cascade pulled after them — are
                in the error buckets and go to the error workbook; every OTHER project is
                still imported. So the warnings and the write lists are built regardless,
                over what remains. The caller decides whether anything remains at all.

                THE WARNINGS, in the same order and the same line format as the errors — a
                reader comparing the two tabs should not have to learn a second layout.
                They describe only rows that are about to be written: a warned row that
                the cascade demoted is in the error buckets by now, not here.

                ErrorMessage is where they live, warned or failed: ValidationState joins Fail
                and Warn text into one string, so a row that warned twice reads
                "Incorrect Rank, Start X Range: …" here. */
            verdict.WarningProjectDetails.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
            verdict.WarningFundingProfile.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
            verdict.WarningComponentDetails.Sort((a, b) =>
            {
                int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                c = string.Compare(a.ComponentType, b.ComponentType, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                return string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase);
            });
            verdict.WarningMajorItemsOfWork.Sort((a, b) =>
            {
                int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                c = string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                return string.Compare(a.InfrastructureId, b.InfrastructureId, StringComparison.OrdinalIgnoreCase);
            });

            foreach (var p in verdict.WarningProjectDetails)
                verdict.Warnings.Add($"PROJECT DETAILS · {p.ProjectId}: {p.ErrorMessage}");
            foreach (var f in verdict.WarningFundingProfile)
                verdict.Warnings.Add($"FUNDING PROFILE · {f.ProjectId} · {f.Source}/{f.Agreement}: {f.ErrorMessage}");
            foreach (var c in verdict.WarningComponentDetails)
                verdict.Warnings.Add($"COMPONENT DETAILS · {c.ProjectId} · {c.ComponentId}: {c.ErrorMessage}");
            foreach (var m in verdict.WarningMajorItemsOfWork)
                verdict.Warnings.Add($"MAJOR ITEMS OF WORK · {m.ProjectId} · {m.ComponentId} · {m.InfrastructureId}: {m.ErrorMessage}");

            /*  From here the warned rows ARE write rows — the balance check, the write loop
                and the P10 scan below all read the four main lists and must see every row
                that is about to be created. */
            verdict.MergeWarnedRowsIntoWrites();

            /*  P10, run for real: against what the Program already holds, and within the
                batch. Notices, not refusals — see the class doc. */
            var existing = await _db.tProjectRevisions
                .AsNoTracking()
                .Where(x => x.ProgramFK == programPK && !x.IsDeleted)
                .Select(x => new { x.Description, x.ProjectId })
                .ToListAsync(cancellationToken);

            foreach (var p in verdict.ProjectDetails)
            {
                var hit = existing.FirstOrDefault(x => NamesMatch(x.Description, p.Description));
                if (hit != null)
                    verdict.Notices.Add($"'{p.Description}' ({p.ProjectId}) already describes {hit.ProjectId} in this Program.");
            }

            foreach (var group in verdict.ProjectDetails
                .GroupBy(x => (x.Description ?? string.Empty).Trim(), StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1))
            {
                verdict.Notices.Add($"'{group.Key}' is used by {group.Count()} rows in this workbook: {string.Join(", ", group.Select(x => x.ProjectId))}.");
            }

            return verdict;
        }
    }
}
