# Plan: Stage advance must not bring back deleted projects (follow-ups to d74923df)

Status: Approved
Created: 2026-10-20
Source: Code review of commit d74923df ("Do not advance a project that was deleted at the stage being left") on branch `fix/advance-skips-deleted-projects`

## Goal

Finish the fix started in d74923df so that a project soft-deleted by Batch Delete is never carried into a later stage by `ProgramController.UpdateProgramStage`. That holds at the next advance and at every advance after it. This plan also fixes one regression the commit introduced and one race it left open.

### Background (read this first)

- `UpdateProgramStage` ([WebAPI/Controllers/Programs/ProgramController.cs](../../WebAPI/Controllers/Programs/ProgramController.cs), around line 801) builds the next stage by copying every row that `vProjectLatest` returns for the program.
- `vProjectLatest` returns each project's newest **live** revision, whatever stage it belongs to.
- A Batch Delete soft-deletes only the revision at the current stage (`tProjectRevisions.IsDeleted = 1`). So once project A is deleted at NEP, `vProjectLatest` falls back to A's still-live BP revision. Before d74923df, the next advance copied that BP revision forward under A's BP-era id, which undid the delete.
- d74923df adds a filter (lines ~852-867). It drops a project when every revision it has at the stage being left is deleted, and it keeps any project with no `tProjectStages` row at that stage, treating it as a legacy import.

### What the review found (and what this plan fixes)

1. **The fix is incomplete (high).** Delete A at NEP, then advance NEP→NEP-E. A is skipped correctly and gets no NEP-E row. Advance NEP-E→GAA: A has no NEP-E row, so the legacy exemption keeps it, `vProjectLatest` returns its live BP revision, and A comes back at GAA. Restoring a project at an older stage while the program is further ahead takes the same path.
2. **Regression (high).** If every project was deleted at the current stage, the filtered list is empty and the advance returns 400 "No projects are linked to this program" (around line 1461). Before d74923df this program advanced.
3. **Race (medium).** The advance does not take the per-program lock that `BatchDelete` (line ~2522) and restore `BatchAddExistingProject` (line ~2711) take. A delete or restore that commits while an advance is running can be carried forward or lost.
4. **Case sensitivity (medium).** The filter uses a case-sensitive `HashSet<string>`. The same lookup in `ResolveBatchDeleteAsync` (line ~2432) and in restore uses `StringComparer.OrdinalIgnoreCase`. A legacy key that differs only in case is not filtered.

**Missing SQL: none.** Everything here uses existing tables (`tProjectStages`, `tProjectRevisions`) and the existing `sp_getapplock` helper. No new stored procedure, view or migration is needed.

## Acceptance Criteria

As a program owner, I want a project I deleted to stay deleted however many times the program advances, so that the program's later stages list only the projects that are still active.

- [ ] Delete project A at NEP, advance NEP→NEP-E→GAA: A is listed at neither NEP-E nor GAA. Project B (not deleted) is listed at both.
- [ ] Delete A at NEP and advance to NEP-E: A is not listed at NEP-E. This is the existing rule #2 e2e test, which must now pass.
- [ ] A program with projects, **all** deleted at the current stage, advances successfully (200). The new stage has a program revision and stage row, and no projects.
- [ ] A program that never had any projects still gets the existing 400 "No projects are linked to this program".
- [ ] A project with no `tProjectStages` row anywhere in the program (true legacy import) is still advanced, as before.
- [ ] `UpdateProgramStage` takes the per-program lock before it reads anything. If a Delete Program of the same program holds the lock, the advance answers 400 with the lock's reason. If the advance is chosen as a deadlock victim, it answers 409 "This program was being changed at the same time. Try again." Nothing is written in either case.
- [ ] ProjectFK/ProjectPK matching in the new filter is case-insensitive.
- [ ] The default (non-opt-in) cross-stage e2e test still passes.

## Approach

All code changes are inside `UpdateProgramStage`.

1. **Take the program lock.** Immediately after `ProgramParent` is resolved (around line 834), call:
   ```csharp
   await _db.AcquireProgramDeletionLockAsync(ProgramParent.ProgramPK, cancellationToken);
   ```
   The method is the EF overload in [Helpers/ProgramHelper.cs](../../Helpers/ProgramHelper.cs) (line ~276). It needs the open EF transaction, which the action already opens on its first line. Add two catch clauses **before** the existing generic `catch (Exception ex)`, copying the pattern `BatchDelete` uses (lines ~2585-2600):
   - `catch (ProjectHelper.DeletionRefusedException ex)`: roll back, then return `BadRequest(new { Message = ex.Reason, Title = "Update Failed" })`.
   - `catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))`: roll back, then return `Conflict(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" })`. This is the same text as at line ~559.

2. **Replace the filter with the stage-correct rule.** Replace the `StageRevisionStates` / `DeletedAtThisStage` block. Keep a project if **either** condition holds:
   - (a) it has a live revision at `(ProgramFK, current StageId)`, or
   - (b) it has no `tProjectStages` row in this program at any stage (legacy import).

   ```csharp
   var LiveAtThisStage = (await (
           from stage in _db.tProjectStages.AsNoTracking()
           join revision in _db.tProjectRevisions.AsNoTracking() on stage.RevisionId equals revision.Id
           where stage.ProgramFK == ProgramParent.ProgramPK && stage.StageId == ProgramStage.StageId && !revision.IsDeleted
           select revision.ProjectFK)
       .Distinct().ToListAsync(cancellationToken))
       .ToHashSet(StringComparer.OrdinalIgnoreCase);
   var HasAnyStageRow = (await _db.tProjectStages.AsNoTracking()
           .Where(x => x.ProgramFK == ProgramParent.ProgramPK)
           .Select(x => x.ProjectFK).Distinct().ToListAsync(cancellationToken))
       .ToHashSet(StringComparer.OrdinalIgnoreCase);
   bool HadProjects = checkProjects.Count > 0;
   checkProjects = checkProjects
       .Where(x => LiveAtThisStage.Contains(x.ProjectPK) || !HasAnyStageRow.Contains(x.ProjectPK))
       .ToList();
   ```
   Rewrite the dated comment above it to state this rule and why: `vProjectLatest` falls back across stages, so "deleted here" is not enough, and "has no row here" must mean "never staged" rather than "skipped earlier".

3. **Let an all-deleted program advance.** The program-level writes (new `ProgramRevisions` row, new `ProgramStages` row, `SaveChangesAsync`, `CommitAsync`, `Ok(...)`, lines ~1407-1442) currently run only inside `if (checkProjects.Count > 0)` and `if (ProjectRevisions.Count > 0)`.
   - Move `HostName` / `Date` / `Time` / `NewProgramUniqueId` (lines ~890-893) above the `if (checkProjects.Count > 0)` block so both paths can use them.
   - Extract the program-level writes into a local function, e.g. `async Task<IActionResult> AdvanceProgramAsync()`. Call it at the end of the existing project path, in place of the inline code.
   - Directly after the filter, add `if (HadProjects && checkProjects.Count == 0) return await AdvanceProgramAsync();`.
   - Leave the final 400 for a program with no projects at all unchanged.
   - Confirm that nothing in the program-level block depends on project-level variables (`HasNewProjectId`, `FirstSegment`, `NewRevisions`). In the current code it does not.

### Out of scope (known, deliberately not done here)

- Skipped projects are not reported back to the caller or to an audit log. The advancement spec §10 asks for that in a pre-commit summary; it needs a UI decision.
- Rows are matched on `StageId` rather than on the specific stage instance, so a program that moved backward and revisited a stage merges both visits. This is a rare edge case.
- The "live at stage" query now exists in both `ResolveBatchDeleteAsync` and `UpdateProgramStage`. A shared helper would keep them in step.
- Choosing the copy source revision directly from `tProjectStages` instead of `vProjectLatest` is the cleaner long-term fix, but it is a larger change.

## Tasks

### Senior
- Steps 1-3 of the Approach in `UpdateProgramStage`, including the local-function extraction and the new catch clauses.
- Build the WebAPI solution (`dotnet build`) with no new warnings in `ProgramController.cs`.

### Junior
- In [e2e/tests/batch-delete-restore-cross-stage.spec.ts](../../e2e/tests/batch-delete-restore-cross-stage.spec.ts), add an opt-in test behind the same `E2E_ALLOW_ORPHANS` gate. Reuse the helpers in `e2e/tests/helpers/crossStageFixture.ts` (`createProgramAtBP`, `addOrdinaryProject`, `advanceProgram`, `batchDelete`, `projectsAt`).
  - **Two-hop:** two projects A and B; advance to NEP; delete A; advance to NEP-E, then to GAA. Assert A is absent from NEP-E and GAA, and B is present at both.
  - **All-deleted:** one project; advance to NEP; delete it; advance to NEP-E. Expect 200 and an empty project list at NEP-E.
- Change the comment at line ~109 of the same spec to "UpdateProgramStage refuses a program with no projects".
- Run the cross-stage spec, with and without `E2E_ALLOW_ORPHANS=1`, against a **local** database (each run strands one program, because a program past BP cannot be deleted).

### Documentation
- [e2e/CLAUDE.md](../../e2e/CLAUDE.md):
  - Line ~112 (coverage table) and the section "The opt-in rule #2 test fails, and it is right to" (~403-410): rule #2 now passes, and the defect was fixed on this branch. List the new two-hop and all-deleted tests.
  - Line ~361: "UpdateProgramStage refuses a program with no projects" (not "no live project").

## Files / Components Touched
- `WebAPI/Controllers/Programs/ProgramController.cs` (`UpdateProgramStage` only)
- `e2e/tests/batch-delete-restore-cross-stage.spec.ts`
- `e2e/CLAUDE.md`
- Reused, not modified: `Helpers/ProgramHelper.cs` (`AcquireProgramDeletionLockAsync`, `IsDeadlock`), `e2e/tests/helpers/crossStageFixture.ts`

## Risks / Open Questions / Assumptions
- **Behavior change:** an advance now waits on a running Batch Delete or restore of the same program, up to the lock timeout. Today they can interleave. This is intended.
- **Assumption:** a project with `tProjectStages` rows in this program but none at the current stage was dropped by an earlier advance or restored at an older stage, so it should not be advanced. If the business wants restored-at-older-stage projects to rejoin on the next advance, that needs a separate decision.
- **Assumption:** the current `vProjectLatest` still falls back across stages. The repo only has a pre-fix backup of the view (`Main/Resources/Internal/SQLScripts/vProjectLatest_backup_pre_split_brain_fix_20260910.sql`), so check the live definition on your local DB before relying on it.
- The extra query (`HasAnyStageRow`) adds one round trip per advance. It reads only `tProjectStages` for one program, so the cost is small.
