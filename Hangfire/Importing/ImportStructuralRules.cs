using System;
using System.Collections.Generic;
using System.Linq;

namespace Hangfire.Importing
{
    /// <summary>
    /// The cross-sheet rules that run after the four per-row validators: duplicate Project IDs
    /// within PROJECT DETAILS, the Component → Major Item requirement, the four floating-record
    /// rules, and the error cascade that pulls every sheet's rows for a failing project into the
    /// error bucket. Shared by the Program importer (<c>ImportProjectJobService</c>) and the Lump
    /// Sum itemization import.
    /// </summary>
    /// <remarks>
    /// Moved verbatim from <c>ImportProjectJobService.FinalizeErrors</c> on 2026-09-05. The only
    /// change is that the Major-Item exemption list now reads
    /// <see cref="ImportingHelper.NonPhysicalComponentTypeIds"/> instead of a private copy with
    /// identical contents, so the two can no longer drift.
    ///
    /// The identity gates (a Project ID that already exists under this Program+Stage, ambiguous
    /// AlternateIds, island conflicts) are NOT here — they live in <c>RunImportAsync</c> because
    /// they need the database, and the Lump Sum import has no use for them: itemization only
    /// ever creates new projects.
    /// </remarks>
    public static class ImportStructuralRules
    {
        public static void Apply(
            List<ImportProjectDetailsExcel> validP, List<ImportFundingProfileExcel> validF, List<ImportComponentDetailsExcel> validC, List<ImportMajorItemsOfWorkExcel> validM,
            List<ImportProjectDetailsExcel> warnP, List<ImportFundingProfileExcel> warnF, List<ImportComponentDetailsExcel> warnC, List<ImportMajorItemsOfWorkExcel> warnM,
            List<ImportProjectDetailsExcel> errP, List<ImportFundingProfileExcel> errF, List<ImportComponentDetailsExcel> errC, List<ImportMajorItemsOfWorkExcel> errM)
        {
            void AppendMessage<T>(T item, string message)
            {
                if (message == null) return;
                var prop = item.GetType().GetProperty("ErrorMessage");
                if (prop == null) return;
                var existing = prop.GetValue(item)?.ToString();
                var newMessage = string.IsNullOrWhiteSpace(existing) ? message : $"{existing.TrimEnd('.')}; {message}";
                prop.SetValue(item, newMessage);
            }

            void PropagateErrors<T>(HashSet<string> ids, List<T> err, List<T> valid, List<T> warn, Func<T, string> getId, string msg = null)
            {
                var fv = valid.Where(x => ids.Contains(getId(x))).ToList();
                fv.ForEach(x => AppendMessage(x, msg)); err.AddRange(fv); valid.RemoveAll(x => ids.Contains(getId(x)));
                var fw = warn.Where(x => ids.Contains(getId(x))).ToList();
                fw.ForEach(x => AppendMessage(x, msg)); err.AddRange(fw); warn.RemoveAll(x => ids.Contains(getId(x)));
            }

            void RunCascadeLoop()
            {
                var processedIds = new HashSet<string>();
                bool hasNewErrors = true;
                while (hasNewErrors)
                {
                    var fromP = new HashSet<string>(errP.Select(x => x.ProjectId));
                    var fromF = new HashSet<string>(errF.Select(x => x.ProjectId));
                    var fromC = new HashSet<string>(errC.Select(x => x.ProjectId));
                    var fromM = new HashSet<string>(errM.Select(x => x.ProjectId));
                    var newIds = new HashSet<string>(fromP.Concat(fromF).Concat(fromC).Concat(fromM).Except(processedIds));
                    hasNewErrors = newIds.Count > 0;
                    if (!hasNewErrors) break;

                    void CascadeBySource(HashSet<string> ids, string sheet)
                    {
                        if (!ids.Any()) return;
                        var msg = $"Cascaded error: A related record in [{sheet}] has errors.";
                        PropagateErrors(ids, errP, validP, warnP, x => x.ProjectId, msg);
                        PropagateErrors(ids, errF, validF, warnF, x => x.ProjectId, msg);
                        PropagateErrors(ids, errC, validC, warnC, x => x.ProjectId, msg);
                        PropagateErrors(ids, errM, validM, warnM, x => x.ProjectId, msg);
                    }

                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromP)), "PROJECT DETAILS");
                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromF)), "FUNDING PROFILE");
                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromC)), "COMPONENT DETAILS");
                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromM)), "MAJOR ITEMS OF WORK");
                    processedIds.UnionWith(newIds);
                }
            }

            // Step 0 — Duplicate ProjectId within PROJECT DETAILS. SaveProjectDetails resolves
            // identity by AlternateId, so two rows sharing the same ProjectId in one file would
            // make the second row "reuse" the revision the first row just inserted moments
            // earlier, leaving the first row's revision active and un-deleted (the scoped
            // soft-delete only covers PRIOR data, not duplicates created mid-run). Demoted here
            // — not thrown — so it flows through the same graceful error-list/cascade/report
            // pipeline as every other validation failure: previously this threw a raw exception
            // straight past report generation, leaving the job "Failed" with a message but no
            // downloadable error workbook and no per-row breakdown, even if only one ProjectId
            // out of hundreds was duplicated. Runs first so Steps 1+ correctly treat every row
            // for a duplicated ProjectId as already erroring.
            var duplicateProjectIds = new HashSet<string>(
                validP.Concat(warnP)
                    .GroupBy(x => x.ProjectId, StringComparer.OrdinalIgnoreCase)
                    .Where(g => g.Count() > 1)
                    .Select(g => g.Key),
                StringComparer.OrdinalIgnoreCase);

            PropagateErrors(duplicateProjectIds, errP, validP, warnP, x => x.ProjectId,
                "Duplicate ProjectId: this ProjectId appears on more than one row in PROJECT DETAILS within the same import file. Each ProjectId must appear only once per file.");

            // Step 1 — Initial cascade
            RunCascadeLoop();

            // Step 1.5 — Component -> Major Item requirement. Ports the Excel workbook's own
            // pre-save gate (ModuleMandatory.MandatoryFieldsMessage_All's "Component -> Major
            // Item Validation") to the actual backend, so it can't be bypassed by re-uploading an
            // unmodified file or disabling macros. Mirrors that gate's exemption list (component
            // types that don't carry a trackable physical/location item) and its "any row for
            // this pair" presence semantics. Only checks components that are still valid/warn at
            // this point (errored components are already going away regardless); only counts
            // Major Items that are themselves still valid/warn as satisfying the requirement,
            // since an errored Major Item won't actually be imported either. Runs before Step 2
            // so a component demoted here correctly feeds into the Project-level child check below.
            var majorItemExemptComponentIds = ImportingHelper.NonPhysicalComponentTypeIds;
            var majorItemKeys = new HashSet<string>(
                validM.Select(x => $"{x.ProjectId}|{x.ComponentId}")
                .Concat(warnM.Select(x => $"{x.ProjectId}|{x.ComponentId}")));

            void RequireMajorItem(List<ImportComponentDetailsExcel> list)
            {
                var missing = list.Where(c =>
                    !majorItemExemptComponentIds.Contains(c.ComponentId ?? string.Empty) &&
                    !majorItemKeys.Contains($"{c.ProjectId}|{c.ComponentId}")).ToList();

                foreach (var c in missing)
                {
                    AppendMessage(c, $"Component '{c.ComponentId}' under Project '{c.ProjectId}' requires at least 1 Major Item.");
                }
                errC.AddRange(missing);
                validC.RemoveAll(c => missing.Contains(c));
                warnC.RemoveAll(c => missing.Contains(c));
            }
            RequireMajorItem(validC);
            RequireMajorItem(warnC);

            // Step 2 — Detect floating ProjectDetails. Requires BOTH a Funding Profile entry AND
            // a Component Details entry (matching the Excel workbook's own stricter gate) rather
            // than "any one of Funding/Component/MajorItems", which is what this used to check —
            // a project with only a Major Item and nothing else used to slip through as non-floating.
            var fundingProjectIds = new HashSet<string>(
                validF.Select(x => x.ProjectId).Concat(warnF.Select(x => x.ProjectId)).Concat(errF.Select(x => x.ProjectId)));
            var componentProjectIds = new HashSet<string>(
                validC.Select(x => x.ProjectId).Concat(warnC.Select(x => x.ProjectId)).Concat(errC.Select(x => x.ProjectId)));
            bool MissingRequiredChildren(ImportProjectDetailsExcel x) =>
                !fundingProjectIds.Contains(x.ProjectId) || !componentProjectIds.Contains(x.ProjectId);
            var floatP = new HashSet<string>(validP.Where(MissingRequiredChildren).Select(x => x.ProjectId)
                .Concat(warnP.Where(MissingRequiredChildren).Select(x => x.ProjectId)));

            // Step 3 — Detect floating child records
            var allValidPIds = new HashSet<string>(validP.Select(x => x.ProjectId).Concat(warnP.Select(x => x.ProjectId)));
            var floatF = new HashSet<string>(validF.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)
                .Concat(warnF.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)));
            var floatC = new HashSet<string>(validC.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)
                .Concat(warnC.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)));
            var allCompKeys = new HashSet<string>(
                validC.Where(x => allValidPIds.Contains(x.ProjectId)).Select(x => $"{x.ProjectId}|{x.ComponentId}")
                .Concat(warnC.Where(x => allValidPIds.Contains(x.ProjectId)).Select(x => $"{x.ProjectId}|{x.ComponentId}")));
            var floatM = new HashSet<string>(
                validM.Where(x => !allValidPIds.Contains(x.ProjectId) || !allCompKeys.Contains($"{x.ProjectId}|{x.ComponentId}")).Select(x => x.ProjectId)
                .Concat(warnM.Where(x => !allValidPIds.Contains(x.ProjectId) || !allCompKeys.Contains($"{x.ProjectId}|{x.ComponentId}")).Select(x => x.ProjectId)));

            // Step 4 — Move floating to Error
            PropagateErrors(floatP, errP, validP, warnP, x => x.ProjectId, "Floating record: A project requires at least one Funding Profile entry and at least one Component Details entry.");
            PropagateErrors(floatF, errF, validF, warnF, x => x.ProjectId, "Floating record: No matching parent found in Project Details.");
            PropagateErrors(floatC, errC, validC, warnC, x => x.ProjectId, "Floating record: No matching parent found in Project Details.");
            PropagateErrors(floatM, errM, validM, warnM, x => x.ProjectId, "Floating record: No matching parent found in Project Details or Component Details.");

            // Step 5 — Final cascade
            RunCascadeLoop();
        }
    }
}
