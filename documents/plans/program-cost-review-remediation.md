# Plan: Remediate the program cost rule code review

Status: Approved
Created: 2026-09-16
Source: `documents/docs/engineering/MYPS_PROGRAM_COST_RULE_CODE_REVIEW_2026-09-16.md`
Prerequisite: implement on top of `fix/program-details-cost-computation` (or after it lands on
`dev-trunk`) — do not implement on this docs branch or on `dev-trunk` directly.

## Goal

One program cost rule — read by `fProgramStages` and written by `pRecomputeProgramCost` — that
is duplicate-safe on Lump Sum components, blind to soft-deleted revisions, revision-aware
(an approved Formal Revision changes program cost; a pending one does not), deployable to the
shared server with a backfill that reports rather than fails on the known overflow, and covered
by tests that would have caught every finding in the review.

## Context

The review (linked above) confirmed 9 findings against localhost `myps_db_dev_200` and the
shared server, read-only, and rejected one (`LocalDbSafety` env override — not present on this
branch). Three open questions were decided by the maintainer on 2026-09-16:

1. Lump Sum duplicate components: fix the code **and** clean the data, **localhost only** —
   the shared server and MYPS_BAK are never written to as part of this.
2. Backfill `tProgramRevisions.Cost` after deployment: **yes**, skipping and reporting the
   overflowing group rather than failing the run.
3. Base-only vs revision-aware: **make it revision-aware**. Risks and cheap, top-of-head
   optimization ideas are to be written down; no performance deep-dive.

## Acceptance Criteria

- [ ] A Lump Sum parent with two or more identical live `'LS'` component rows contributes its
      appropriation **once**, not once per row.
- [ ] A soft-deleted `tProjectRevisions` row contributes nothing to a program's cost.
- [ ] A project under a fully approved Formal Revision (RO=1, CO=1, snapshot present) has its
      **approved** per-year amounts and Lump Sum Total counted; a project under a revision that
      is only partially approved or not yet requested still counts its **base** figures.
- [ ] `fProgramStages` and `pRecomputeProgramCost` agree to the cent on every fixture in
      `RecomputeProgramCostTests.cs` and on all 61 program groups shared with MYPS_BAK
      (re-run `myps-gis-backend/app/data_migration/test_sql/compare_program_cost_rules.py`
      against localhost, expect the same rolled-back-clean result as 2026-09-15 plus the
      corrected figures for the 4 previously-doubled Lump Sum parents).
- [ ] After the shared-server migration's backfill, the program list and Program Details show
      the same cost for every program group except the one still-overflowing group, which is
      named in the migration's output and left at its prior stored value.
- [ ] All four rollback scripts (`*_backup_shared200_*`, `*_backup_pre_peryear-program-year-rule_20260915.sql`
      x2) refuse to run against the wrong database.
- [ ] `MYPS.DatabaseTests` passes on LocalDB with `Cost decimal(18,5)`, including a new test that
      expects Msg 8115 on the known-overflow shape, a duplicate-Lump-Sum-component test, a
      soft-deleted-revision test, and a revision-awareness test; `fProgramStages` is asserted
      equal to `pRecomputeProgramCost` on every fixture.
- [ ] The shared server (`192.168.50.200`) and `MYPS_BAK` are untouched until the shared200
      migration is deliberately run — nothing in this plan writes to either as a side effect of
      implementation or testing.

## Approach

### 1. Lump Sum parent: one component, deterministically chosen

In both `fProgramStages` and `pRecomputeProgramCost`
(`Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql`, section 11),
replace the parent's `SUM(cc.Total)` over every live component with the Total of one row:

```sql
SELECT TOP 1 cc.Total
FROM dbo.tProjectComponentCost cc
WHERE cc.ProjectRevisionFK = <revision> AND cc.IsDeleted = 0 AND cc.ComponentType = N'LS'
ORDER BY cc.Id
```

`ComponentType = 'LS'` matches `vLumpSumSet`'s existing filter, which the current unfiltered sum
dropped. `ORDER BY cc.Id` is deterministic and matches the data cleanup in step 2 (which keeps
the lowest `Id`). Non-Lump-Sum projects are unaffected — they stay on the per-year branch.

Re-cut `Main/Resources/Internal/SQLScripts/Migration.ProgramCostPerYearRule.Shared200.2026-09-15.sql`
from the updated section 11 (it already documents that its object bodies are cut byte-for-byte
from that source — do not hand-edit the copy).

### 2. Data cleanup — localhost only

New file: `Main/Resources/Internal/SQLScripts/LumpSum.DedupeParentComponents.Dev200.2026-09-16.sql`.

- Guard: `IF DB_NAME() <> N'myps_db_dev_200' OR @@SERVERNAME NOT IN (...localhost names...)
  RAISERROR(...) ; RETURN` — refuse anywhere but localhost, mirroring the safety pattern in the
  shared200 migration but inverted (that one refuses the shared name; this one refuses
  everywhere else).
- For every Lump Sum parent revision with more than one live `'LS'` component sharing identical
  `ComponentType`, `ComponentId`, `Total`, and `DataImportComponentId`: keep the lowest `Id`,
  soft-delete (`IsDeleted = 1`) the rest, and cascade the same to their child
  `tProjectComponentCostPerYear` rows.
- Print before/after counts (expect 71 revisions, matching the review).
- Wrap in an explicit transaction with a `@DryRun BIT = 1` default that only prints what would
  change; require the operator to flip it to run for real.
- Explicitly does **not** touch the separate, larger per-year row duplication on
  `MP_P_CO-PS-634_02272023_143836` (RBP FY 2024 NCR) — that is the overflow source and stays a
  named follow-up, not part of this cleanup.

### 3. Exclude soft-deleted project revisions

In the procedure's `stage_revision` CTE and the function's `sr` derived table, add
`JOIN dbo.tProjectRevisions pr ON pr.Id = ps.RevisionId AND pr.IsDeleted = 0`. Expected effect on
dev_200: cost drops by ₱465,828,000 across the three affected program groups named in the
review.

### 4. Revision-aware per-year and Lump Sum reads

Replace the base-table CTEs (`component_total`, `per_year` in the procedure; their function
equivalents) with a set-based overlay reproducing `dbo.fProjectEffectiveRevision`'s rule for
every project at the stage in one pass — **not** a per-project `CROSS APPLY
dbo.fProjectComponentCostPerYear(@ProjectPK, @StageId)`, which cost 11.2 seconds on a
16,500-project program under the old per-project shape.

Approach: build one CTE, `effective`, over `stage_revision` that for each project resolves:

- the latest `tRevisionDetails` row for that project with `RO = 1 AND CO = 1` (via
  `tRevisionApprovals`) and a matching `tRevisionProjectSnapshot` row — the same predicate
  `fProjectEffectiveRevision` uses;
- `Source = 'Revision'` with that `RevisionDetailFK` when found, else `Source = 'Base'` with the
  project's own `RevisionId`.

Then `UNION ALL` the component/per-year aggregates: base rows from `tProjectComponentCost` /
`tProjectComponentCostPerYear` for `Source = 'Base'` projects, and
`tRevisionProjectComponentCost` / `tRevisionProjectComponentCostPerYear` for `Source =
'Revision'` projects, keyed the same way `fProjectComponentCostPerYear` already joins them
(reuse its join shape, not its per-row execution). Do this once and feed both the Lump Sum
Total pick (step 1) and the per-year `AmountAllYears`/`AmountAtProgramYear` aggregate from it.

Consider extracting the `effective` CTE's logic into a small reusable inline TVF, e.g.
`dbo.fStageEffectiveRevisions(@ProgramPK, @StageId)`, that both `fProgramStages` and
`pRecomputeProgramCost` call — this also narrows finding 9 (the rule duplicated 5–6 times) for
this one piece of it, without promising to fix all the duplication.

**Risks to carry forward, not solve here:**
- Slower than the base-only read: extra joins over `tRevisionDetails`/`tRevisionApprovals`/
  `tRevisionProjectSnapshot`/`tRevisionProjectComponentCost*` per project at the stage.
- Semantic change: report procedures that read base tables directly (`sp_RBP`, `a1_usp_AIP2`,
  `pGenerateAIP01`, `pGenerateRDIP`, `usp_extract_PC_list` — listed in
  `MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md`) will now disagree with program cost
  on any program with an approved revision. Not resolved by this plan; the engineering doc
  should note the addition (task 10 below).
- Adds one more place the effective-revision rule is expressed, unless the extraction above is
  taken.

**Top-of-head optimization ideas, not to be pursued as a deep dive:**
- A filtered/covering index on `tRevisionApprovals(RevisionDetailFK, Level, Status)`.
- An index on `tRevisionProjectComponentCostPerYear(RevisionComponentCostFK, IsDeleted)
  INCLUDE (Year, Amount)` to match the existing per-year read shape.
- Compute the `effective` CTE once per call and reuse it for both the Lump Sum Total and the
  per-year aggregate, rather than resolving effective revision twice.
- Keep the existing `EXISTS`-on-stage restriction so the overlay never scans another program's
  revisions.

### 5. `@StartYear` NULL guard

Add, immediately after the `@StartYear` lookup in `pRecomputeProgramCost`:

```sql
IF @StartYear IS NULL
BEGIN
    RAISERROR('pRecomputeProgramCost: program %s has no StartYear to recompute Cost against.', 16, 1, @ProgramPK);
    RETURN;
END
```

mirroring the existing `@CurrentRevisionId` guard. Not reachable today (`StartYear` is
`NOT NULL` on both databases) — added for symmetry and to fail loudly rather than silently zero
a project's contribution if that ever changes.

### 6. Backfill in the shared-server migration

Add a new section to `Migration.ProgramCostPerYearRule.Shared200.2026-09-15.sql`, gated by
`@RunBackfill BIT = 1` (default 0 — an explicit second decision from the preflight), run only
after the preflight has passed or the operator has explicitly accepted the overflow:

```sql
DECLARE @pk NVARCHAR(200);
DECLARE backfill_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT DISTINCT ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0;

CREATE TABLE #BackfillSkipped (ProgramPK NVARCHAR(200), ErrorMessage NVARCHAR(4000));

OPEN backfill_cursor;
FETCH NEXT FROM backfill_cursor INTO @pk;
WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
    END TRY
    BEGIN CATCH
        INSERT INTO #BackfillSkipped VALUES (@pk, ERROR_MESSAGE());
    END CATCH
    FETCH NEXT FROM backfill_cursor INTO @pk;
END
CLOSE backfill_cursor; DEALLOCATE backfill_cursor;

PRINT 'Backfill complete.';
SELECT * FROM #BackfillSkipped;   -- expect the one known-overflowing group here
DROP TABLE #BackfillSkipped;
```

Update the deployment runbook
(`documents/docs/engineering/MYPS_PROGRAM_COST_PER_YEAR_RULE_SHARED200_DEPLOYMENT.md`) to
describe `@RunBackfill` and what a skipped group in the output means.

### 7. Rollback script guards

Add a database-name guard to each of the four backup files, refusing the wrong server the same
way the forward migration does:

- `fProgramStages_backup_shared200_pre_peryear-program-year-rule_20260915.sql` and its
  `pRecomputeProgramCost` sibling: `IF DB_NAME() <> N'myps_db_dev' RAISERROR(...)`.
- `fProgramStages_backup_pre_peryear-program-year-rule_20260915.sql` and its
  `pRecomputeProgramCost` sibling (the localhost captures): `IF DB_NAME() <> N'myps_db_dev_200'
  RAISERROR(...)`.

### 8. Recompute call sites

Extract one helper — e.g. `Helpers/ProgramCostRecompute.cs`, `static Task RunAsync(MYPSDbContext
db, string programPK, CancellationToken ct)` wrapping the existing
`FromSqlInterpolated("EXEC dbo.pRecomputeProgramCost @ProgramPK={0}", programPK)` — and call it
from:

- `WebAPI/Controllers/Projects/ProjectController.cs:4395` (already gated on `HasCostUpdate`)
- `WebAPI/Controllers/Revision/RevisionController.cs:2406`
- `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs:360, 792, 1066`

Gate `UpdateLumpSum` (line ~792) on a cost-changed check analogous to `ProjectController`'s
`HasCostUpdate` (`ProjectController.cs:924, 2262, 2366, 2707, 2824, 4176, 4345, 4392`) — compare
the Lump Sum project's cost-relevant fields before and after, and only recompute when they
changed. `CreateLumpSum` and `ReplenishLumpSum` always change cost by construction, so they keep
an unconditional call.

### 9. Tests

`MYPS.DatabaseTests/RecomputeProgramCostTests.cs`:

- Fix the harness schema: `Cost decimal(18,5)` (was `(18,2)`).
- New test: a Lump Sum parent revision with two identical live `'LS'` components counts the
  Total once.
- New test: a program whose recomputed total exceeds `decimal(18,5)` raises the expected SQL
  error (proves the overflow guard is real and reachable in a controlled fixture, rather than
  only observed on production-shaped data).
- New test: a project revision marked `IsDeleted = 1` contributes zero.
- New test: a project under a fully approved Formal Revision (RO=1, CO=1, snapshot present)
  counts the revision's amounts; a project under a pending or non-existent revision counts base.
- Add `fProgramStages` to the harness (it currently tests only the procedure) and assert it
  equals `pRecomputeProgramCost`'s result on every existing and new fixture.

### 10. Documentation

- `documents/plans/program-cost-per-year-rule.md` — update the rule description for
  revision-awareness and the single-component Lump Sum read.
- `documents/docs/engineering/MYPS_PROGRAM_COST_PER_YEAR_RULE_SHARED200_DEPLOYMENT.md` — document
  `@RunBackfill`, the Lump Sum dedup as a localhost-only prerequisite (not required on the
  shared server, which has zero Lump Sum parents today per the review), and that the RISK-108
  approval-time recompute is no longer a no-op.
- `documents/docs/engineering/MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md` — move
  `pRecomputeProgramCost` and `fProgramStages` out of "Where this design leaks" into the
  confirmed-revision-aware list, and note which report procedures still read base only and will
  now disagree with program cost on an approved-revision program.

## Files Touched

- `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` (section 11)
- `Main/Resources/Internal/SQLScripts/Migration.ProgramCostPerYearRule.Shared200.2026-09-15.sql`
- `Main/Resources/Internal/SQLScripts/LumpSum.DedupeParentComponents.Dev200.2026-09-16.sql` (new)
- `Main/Resources/Internal/SQLScripts/fProgramStages_backup_shared200_pre_peryear-program-year-rule_20260915.sql`
- `Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_shared200_pre_peryear-program-year-rule_20260915.sql`
- `Main/Resources/Internal/SQLScripts/fProgramStages_backup_pre_peryear-program-year-rule_20260915.sql`
- `Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_pre_peryear-program-year-rule_20260915.sql`
- `WebAPI/Controllers/Projects/ProjectController.cs`
- `WebAPI/Controllers/Revision/RevisionController.cs`
- `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`
- `Helpers/ProgramCostRecompute.cs` (new)
- `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`
- `documents/plans/program-cost-per-year-rule.md`
- `documents/docs/engineering/MYPS_PROGRAM_COST_PER_YEAR_RULE_SHARED200_DEPLOYMENT.md`
- `documents/docs/engineering/MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md`

## Risks

- **Performance.** The revision-aware overlay adds joins on the hot cost-computation path.
  Measure `fProgramStages` on the largest known program (five stages, ~16,500 projects) before
  and after; the old per-project shape cost 11.2s and the set-based rewrite brought that to
  2.5s — the revision-aware version must not regress meaningfully past that, but this plan does
  not commit to a number beyond "measure and report", per the no-deep-dive instruction.
- **Report/program-cost divergence.** Once revision-aware, `pRecomputeProgramCost` will show a
  different figure than base-reading reports for any program touched by an approved revision.
  This is surfaced in documentation (task 10), not resolved in code, by design.
- **Dedup misclassification.** The Lump Sum component cleanup could merge two components that
  are legitimately identical by coincidence rather than duplication. Mitigated by requiring
  equality on four columns including the import keys, and by running with `@DryRun = 1` first
  and reviewing the printed set before committing.
- **Backfill duration on the shared server.** 41+ sequential `EXEC`s, each doing set-based work
  over that program's projects — expect low tens of seconds total, but run it off-hours and
  watch for lock contention with any live session.
- **Scope creep back onto dev-trunk.** This plan is written on a docs-only branch cut from
  `dev-trunk`; the implementation must happen on `fix/program-details-cost-computation` (or
  after it merges), never committed to `dev-trunk` directly.

## Verification

1. Run `MYPS.DatabaseTests` on LocalDB; all pass, including the five new tests in task 9.
2. Re-run `pixi run python -m app.data_migration.test_sql.compare_program_cost_rules` (backend
   repo) against localhost `myps_db_dev_200` after tasks 1–3; confirm the four previously
   doubled Lump Sum parents now report their single appropriation and the RECOMPUTE_OVERFLOW
   group is unchanged (still overflowing, still guarded — its data problem is out of scope
   here).
3. Time `fProgramStages` on the largest program before and after task 4; record the number in
   the PR description.
4. Dry-run `LumpSum.DedupeParentComponents.Dev200.2026-09-16.sql` with `@DryRun = 1`, inspect
   the printed set (expect 71 revisions), then run for real and re-run the comparison script.
5. Dry-run the shared200 migration's backfill section against a scratch copy or with
   `@RunBackfill = 0` first; only run `@RunBackfill = 1` against `192.168.50.200` in a
   deliberate, separate, approved step — not as part of this plan's automated verification.
6. Confirm each of the four rollback scripts raises when pointed at the wrong database name.
