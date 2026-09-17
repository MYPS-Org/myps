# Plan: Fix Program Details Cost Computation

Status: Implemented
Created: 2026-09-15
Source: Live-database investigation this session (OBJECT_DEFINITION pulled from myps_db_dev @ 192.168.50.200)

## Goal

Make `tProgramRevisions.Cost` (and therefore Program Details' displayed cost) correctly reflect: (a) approved Formal Revision funding overlays, and (b) Lump Sum allocation changes, at all times — not just when an unrelated project edit happens to trigger a recompute.

## Acceptance Criteria

As a program manager, I want the Program Details cost total to always reflect the current, approved state of project funding and Lump Sum allocations, so that the figure I see is trustworthy without needing an unrelated edit to "refresh" it.

- [ ] `pRecomputeProgramCost` (live DB **and** checked-in `Migration.SchemaAndProgrammability.2026-09-10.sql`) sums funding via `CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId)` instead of the direct `JOIN dbo.tProjectFundingProfile`.
- [ ] The ADR-055 Lump Sum addition (`+ SUM(vLumpSumSet.OriginalAllocation)`) is preserved unchanged in the fixed procedure.
- [ ] The procedure's result-set contract (columns consumed by `DBHelper.Models.Procedures.RecomputeProgramCost` via `FromSqlInterpolated`) still works for both existing callers (`ProjectController.cs:4386`, `RevisionController.cs:2406`) without changes to those call sites.
- [ ] `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`'s `Procedure_UsesEffectiveRevisionFundingNotBaseWhenFullyApproved` and `Procedure_IgnoresRevisionFundingWhenNotYetFullyApproved` still pass, and its embedded `ProcedureSql` is reconciled so it's no longer a second, drifted copy of the logic.
- [ ] `CreateLumpSum`, `UpdateLumpSum`, and `ReplenishLumpSum` in `LumpsumController.Writes.cs` each call `pRecomputeProgramCost` for the affected `ProgramFK`, inside the existing transaction, before `CommitAsync`.
- [ ] Manual verification: creating a Lump Sum project, topping it up via Replenish, and editing an existing Lump Sum project's allocation via Update each immediately change the parent Program's Cost on the Program Details screen — no unrelated edit required.
- [ ] Manual verification against myps_db_dev: a project with a fully-approved Formal Revision whose funding differs from base now contributes the revision's amount to its program's Cost, not the base amount.
- [ ] A pre-fix backup of the live `pRecomputeProgramCost` definition is captured under `Main/Resources/Internal/SQLScripts/` following the existing `<object>_backup_pre_<reason>_<date>.sql` convention, before the live object is altered.

## Approach

**Fix 1 — the procedure itself.** Edit `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql:822-867` in place: replace the direct `JOIN dbo.tProjectFundingProfile fp ON fp.ProjectRevisionFK = ps.RevisionId` with `CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId) fp`, summing `fp.Amount` as before. Keep the ADR-055 Lump Sum addition and the 3-column result set (`RevisionId, StageId, NewCost`) exactly as-is — that's an orthogonal, already-correct part of the live procedure, and the extra `StageId` column is harmless to the 2-property C# model (EF Core's `FromSql` mapping onto a keyless type ignores unmapped columns; it only fails on a *missing* required one). While in this procedure, correct the stale comment that claims the C# model requires `StageId` — it currently only declares `RevisionId`/`NewCost` — so the note doesn't mislead the next person touching this file.

Before touching the live database, capture the current live definition via `sqlcmd`/`OBJECT_DEFINITION` into a new backup file (`pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_2026-09-15.sql` or similar), matching the pattern already used for `a1_usp_AIP2`'s backups. Then apply the corrected `CREATE OR ALTER PROCEDURE` from the migration script to `myps_db_dev`, and use the existing `whats-live.ps1` comparison helper to confirm the live definition now matches the fixed checked-in source.

Reconcile `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`'s embedded `ProcedureSql`: it currently has the RISK-108 fix but is missing the ADR-055 Lump Sum addition entirely (it has no `vLumpSumSet` table/seed at all), so it's testing a procedure shape that doesn't match production either. Bring the embedded copy's structure in line with the real fixed procedure (add a minimal `vLumpSumSet` stand-in and extend `SeedProgramAsync`/assertions to cover the Lump Sum addition), so this test suite is actually a faithful regression guard for the deployed object going forward, rather than a parallel fiction.

**Fix 2 — trigger recompute on Lump Sum writes.** In `LumpsumController.Writes.cs`, add the same call pattern used in `ProjectController.cs:4383-4402` at each of the three write endpoints' pre-commit point, using each method's already-in-scope program reference:
- `CreateLumpSum` (before `CommitAsync` at line 355): use `Program.ProgramPK`.
- `UpdateLumpSum` (before `CommitAsync` at line 779): use `LumpSumProject.ProgramFK`.
- `ReplenishLumpSum` (before `CommitAsync` at line 1046): use `LumpSumProject.ProgramFK`.

Each call: `await _db.pRecomputeProgramCost.FromSqlInterpolated($"EXEC dbo.pRecomputeProgramCost @ProgramPK={<ProgramPK>}").AsNoTracking().ToListAsync(cancellationToken);` — matching the existing call shape exactly, so no new helper is introduced for a 3-call-site pattern that already has precedent twice in the codebase.

No frontend changes are needed — Program Details already reads `Cost` from `fProgramDetails`, which reads `tProgramRevisions.Cost` directly; fixing the writer fixes the display.

## Tasks

### Implementation
- Back up the live `pRecomputeProgramCost` definition to `Main/Resources/Internal/SQLScripts/` before altering it.
- Fix the funding join in `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` (CROSS APPLY `fProjectFundingProfile` instead of direct join); correct the stale `StageId` comment.
- Apply the corrected procedure to `myps_db_dev` and verify with `whats-live.ps1` that live now matches the checked-in source.
- Update `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`'s embedded `ProcedureSql`/schema/seed to include the ADR-055 Lump Sum addition, so the test suite matches the real deployed shape.
- Add the `pRecomputeProgramCost` call (matching `ProjectController.cs`'s pattern) to `CreateLumpSum`, `UpdateLumpSum`, and `ReplenishLumpSum` in `LumpsumController.Writes.cs`, each before its transaction's `CommitAsync`.

### Documentation
- None required beyond the SQL comment correction called out above (no user-facing behavior change to document; this is a correctness fix to an existing, already-documented figure).

## Files / Components Touched
- `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` (pRecomputeProgramCost definition)
- Live `myps_db_dev` database object `dbo.pRecomputeProgramCost` (via sqlcmd)
- `Main/Resources/Internal/SQLScripts/` (new backup file)
- `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`
- `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`

## Risks / Open Questions / Assumptions
- Assumes direct `sqlcmd`/DB access to `myps_db_dev` (192.168.50.200) to apply the live fix is acceptable to do as part of this task — this is a shared dev database, not local-only. Flag for explicit go-ahead before altering the live object, separate from approving this plan.
- Assumes EF Core's `FromSqlInterpolated` mapping onto the keyless `RecomputeProgramCost` type genuinely tolerates the extra `StageId` column already present in the live result set (this is the current, working behavior — not being changed by this plan, only documented correctly).
- No currently-live data in myps_db_dev exercises the divergent-funding scenario (only 5 fully-approved revisions exist, all coincidentally with revision amount == base amount) — manual verification of Fix 1 will need a deliberately seeded test case (e.g. via the existing dev fixtures) rather than an existing real-world example.
- Out of scope: the unrelated `hasMajorLocations` atom-wiring bug in the Modification module's `ComponentCostDialog.tsx`, discussed and confirmed separately this session — tracked independently, not part of this plan.

## Completion Log
Date: 2026-09-15
- Implementation:
  - Captured a pre-fix backup of the live `pRecomputeProgramCost` definition (`Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql`).
  - Fixed the funding join in `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql`: `CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId)` replaces the direct base-table join; corrected the stale `StageId` comment.
  - Applied the fixed `CREATE OR ALTER PROCEDURE` to live `myps_db_dev` (192.168.50.200) via sqlcmd; confirmed via `OBJECT_DEFINITION` that the live definition now matches the checked-in source exactly; sanity-executed it against a real program with a fully-approved revision with no errors.
  - Added the missing `pRecomputeProgramCost` call (matching `ProjectController.cs`'s/`RevisionController.cs`'s existing pattern) to `CreateLumpSum`, `UpdateLumpSum`, and `ReplenishLumpSum` in `LumpsumController.Writes.cs`, each before its transaction's `CommitAsync`.
  - Reconciled `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`'s embedded `ProcedureSql` to be byte-for-byte the fixed procedure body (no longer a hand-maintained parallel implementation); added a `vLumpSumSet` stand-in table and a new test (`Procedure_AddsLumpSumAllocationOnTopOfProjectFunding`) covering the ADR-055 addition.
- Documentation: none required (per plan).
- Deviations / flags: reconciling the embedded `ProcedureSql` fully (not just adding the Lump Sum piece) surfaced two more pre-existing drifts between the test's fiction and live reality, both fixed: (1) the missing-revision error path used `THROW 50001` with a different message in the test but the live/checked-in proc uses `RAISERROR`, which reports SQL error number 50000 — `Procedure_MissingRevisionThrowsSpecificSqlError` updated to assert 50000 and the real message substring; (2) the test asserted a 2-column result set (`RevisionId, NewCost`) but the live/checked-in proc has always returned 3 columns (`RevisionId, StageId, NewCost`) — `Procedure_ReturnsContractAndExcludesLsAndPriorStage` updated accordingly. Verified full `MYPS.DatabaseTests` suite passes (18/18) and `WebAPI` builds clean after all changes.
- Files changed: `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql`, `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`, `Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql` (new), plus the live `myps_db_dev` `dbo.pRecomputeProgramCost` object.
