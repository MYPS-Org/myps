# pRecomputeProgramCost is slow — RCA and fix plan

Status: Implemented · Date: 2026-09-18 · Database used for evidence: localhost `myps_db_dev_200` (read-only)
Branch to create: `fix/program-cost-recompute-perf` cut from `dev-trunk` (never commit to dev-trunk)

## Context — what was found (the RCA)

**Symptom.** Every Lump Sum write (Create, Update, Replenish) runs `EXEC dbo.pRecomputeProgramCost` inside its transaction, while holding the parent's applock. On the largest Lump Sum program the call takes ~3.2 s. The maintainer commented the three calls out in `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs` (uncommitted working-tree diff, lines 360, 793, 1067) as a stopgap.

**Why Lump Sum call sites feel it most.** The call sites are not the multiplier — each is one call per request. The two Lump Sum-heavy programs are simply the two largest programs on the database (17,491 and 17,441 projects; ~2,000 parents + children each), and the procedure's cost scales with program size. `UpdateLumpSum` also recomputes unconditionally, unlike `ProjectController` (gated on `HasCostUpdate`).

**Which body is slow.** Two versions exist:

| Version | Where | Read portion on `MP_P_CO-PS-635_07212023_081334` (7,254 projects at current stage) |
|---|---|---|
| Funding-based (RISK-108) | checked in on `dev-trunk`, `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql:822-871` | 172 ms |
| Per-year rule (2026-09-15) | **live on dev_200**; in git only on unmerged `fix/program-details-cost-computation` (same file :904-1000) | **3,157 ms elapsed / 2,609 ms CPU** |

**Root cause (from `SET STATISTICS IO` + `SHOWPLAN_ALL` on the live body):**

| Table | Reads | Why |
|---|---|---|
| `tProjects` | 992,166 | The `EXISTS (SELECT 1 FROM counted …)` inside `per_year` was rewritten into a seek on `UQ_tProjects_ProjectPK` + clustered key lookup for `ParentProjectId`, executed **once per per-year row** (146,620 rows), not once per project. |
| `tProjectComponentCostPerYear` | 499,150 (scan count 14,662) | Seek on `IX_…_Cost` then a key lookup per row for `Year`/`Amount`/`IsDeleted`; no covering index. |
| `tProjectStages` | 30,267 (scan count 3) | The `counted`/`stage_revision` CTE is expanded **three times**; each is a full clustered scan (258K rows) because there is **no index on `(ProgramFK, StageId)`** (only `ProgramId`, `ProjectFK`, `RevisionId`). |
| `tProjectComponentCost` | 35,756 (scan count 2) | Full scans twice; `IX_…_Live` lacks `Total`. |

Contributing: cardinality estimates 5–10× low (1,632 est vs 7,254 stage rows; 56 vs 14,662 components) so a plan sniffed on a small program is worse; the per-year aggregate is computed for Lump Sum parents and then discarded.

**Correctness finding surfaced alongside.** The live body counts a Lump Sum parent only if its latest `tProjectStages` row equals the program's *current* stage. On dev_200 parents sit at GAA-R while programs are at HGAB/NEP/BP in 6 of 8 programs → 86 of 123 parents contribute 0 (the largest program loses ₱9.26B vs the old vLumpSumSet sum). Data check: every parent's latest live revision holds exactly one live component (`ComponentType 'Lump Sum'`, `ComponentId 'LS'`); children (4,050) also carry `ProjectType 'LS'` and are distinguished only by `ParentProjectId`.

**Hypothesis test (read-only, same program, identical total 289,327,226,000.00):** materialise `counted` once into a table variable, take Lump Sum parents' component `Total` directly, run the per-year rule only for ordinary projects with `OPTION (RECOMPILE)` → **340 ms** (178 + 1 + 156). Remaining cost is the per-year key lookups (496K reads), which a covering index removes.

## Decisions (maintainer, 2026-09-18)

1. Branch from `dev-trunk`; commit there. The new section-11 bodies replace dev-trunk's funding-based ones and port the live per-year rule for ordinary projects (assumption: the per-year rule stays for non-Lump-Sum projects, since it is what is deployed). A merge conflict with `fix/program-details-cost-computation` is expected and documented (take this branch's section 11 + tests wholesale).
2. Lump Sum parent = `tProjects.ProjectType = N'LS' AND ParentProjectId IS NULL`, **program-wide, any stage**: count `SUM(Total)` of live `ComponentId = N'LS'` components on its latest live revision (`tProjectRevisions.IsDeleted = 0`). Never read its `tProjectComponentCostPerYear` rows.
3. Itemized children (`ParentProjectId IS NOT NULL`) never count.
4. Re-enable all three Lump Sum calls through one helper; gate `UpdateLumpSum` on "LS component Total actually changed".
5. `fProgramStages` (program list) is "one rule by two paths, must move together" → mirror the same rule.

## Approach

### 1. SQL — section 11 of `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql`

Replace `fProgramStages` (lines 765-820) and `pRecomputeProgramCost` (822-871); rewrite the section prose to state the 2026-09-18 rule.

**`pRecomputeProgramCost`** (result set unchanged: `RevisionId, StageId, NewCost`; EF model `DBHelper/Models/Procedures/RecomputeProgramCost.cs`):

```sql
CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProgramCost] @ProgramPK NVARCHAR(200) AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @StartYear INT,
            @OrdinaryCost DECIMAL(38,5), @LumpSumCost DECIMAL(38,5), @NewCost DECIMAL(18,2);

    SELECT TOP 1 @CurrentRevisionId = pgr.Id, @CurrentStageId = pgs.StageId
    FROM dbo.tProgramRevisions pgr JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
    WHERE pgr.ProgramFK = @ProgramPK ORDER BY pgr.Id DESC;
    IF @CurrentRevisionId IS NULL BEGIN RAISERROR('pRecomputeProgramCost: program %s has no revisions to recompute Cost for.', 16, 1, @ProgramPK); RETURN; END

    SELECT @StartYear = pg.StartYear FROM dbo.tPrograms pg WHERE pg.ProgramPK = @ProgramPK;
    IF @StartYear IS NULL BEGIN RAISERROR('pRecomputeProgramCost: program %s has no StartYear to apply the program-year rule against.', 16, 1, @ProgramPK); RETURN; END

    /* 1. Ordinary projects at the current stage, latest revision each, materialised ONCE.
          No Lump Sum parent (counted program-wide below), no itemized child (RISK-009). */
    DECLARE @Ordinary TABLE (RevisionId INT NOT NULL PRIMARY KEY);
    INSERT @Ordinary (RevisionId)
    SELECT sr.RevisionId
    FROM (SELECT ps.ProjectFK, ps.RevisionId,
                 ROW_NUMBER() OVER (PARTITION BY ps.ProjectFK ORDER BY ps.RevisionId DESC) AS rn
          FROM dbo.tProjectStages ps
          WHERE ps.ProgramFK = @ProgramPK AND ps.StageId = @CurrentStageId) sr
    JOIN dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
    WHERE sr.rn = 1 AND prj.ParentProjectId IS NULL
      AND (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
    GROUP BY sr.RevisionId
    OPTION (RECOMPILE);

    /* 2. Per-year rule: one distinct Year counts whatever it is; several count the program year. */
    SELECT @OrdinaryCost = ISNULL(SUM(CASE WHEN agg.[Years] <= 1 THEN agg.AmountAllYears ELSE agg.AmountAtProgramYear END), 0)
    FROM (SELECT o.RevisionId, COUNT(DISTINCT y.[Year]) AS [Years], SUM(y.Amount) AS AmountAllYears,
                 SUM(CASE WHEN y.[Year] = @StartYear THEN y.Amount END) AS AmountAtProgramYear
          FROM @Ordinary o
          JOIN dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = o.RevisionId AND cc.IsDeleted = 0
          JOIN dbo.tProjectComponentCostPerYear y ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
          GROUP BY o.RevisionId) agg
    OPTION (RECOMPILE);

    /* 3. ALL the program's Lump Sum parents, ANY stage: the LS component's Total on the latest live revision. */
    SELECT @LumpSumCost = ISNULL(SUM(cc.Total), 0)
    FROM (SELECT pr.Id AS RevisionId, ROW_NUMBER() OVER (PARTITION BY pr.ProjectFK ORDER BY pr.Id DESC) AS rn
          FROM dbo.tProjects p
          JOIN dbo.tProjectRevisions pr ON pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0
          WHERE p.ProgramFK = @ProgramPK AND p.ProjectType = N'LS' AND p.ParentProjectId IS NULL) lr
    JOIN dbo.tProjectComponentCost cc
      ON cc.ProjectRevisionFK = lr.RevisionId AND cc.IsDeleted = 0 AND cc.ComponentId = N'LS'
    WHERE lr.rn = 1;

    SET @NewCost = @OrdinaryCost + @LumpSumCost;
    UPDATE dbo.tProgramRevisions SET Cost = @NewCost WHERE Id = @CurrentRevisionId;
    SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
END
```

`OPTION (RECOMPILE)` on the two size-dependent statements is the parameter-sniffing mitigation (table variables carry no statistics; the proc would otherwise keep the plan of whichever program called first). Keep the explanatory comments from the live body (the "why" prose) when writing the real file.

**`fProgramStages`** — same column list as today. Ordinary part: one grouped per-year pass per stage row driven by the filtered project set (latest revision at `pgs.StageId`, `ParentProjectId IS NULL`, `ProjectType <> 'LS'`), keeping the live body's `CROSS JOIN (SELECT TOP 1 StartYear FROM tPrograms WHERE ProgramPK = @ProgramPK) pgy` trick (Msg 8124). Lump Sum part: an **uncorrelated** `CROSS JOIN (SELECT ISNULL(SUM(cc.Total),0) AS LumpSumCost FROM <same LS-parent derived table as the proc>) ls` added to every stage row's `Cost`. Keep the correlated-per-stage shape because `Helpers/ProgramHelper.cs:88` reads one stage on every project validation.

**Indexes** — new block "6b" after line 325, same `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = … AND object_id = OBJECT_ID(…))` guard as 6a; add the names to the verification list near lines 1266-1270. New indexes rather than altering the existing `_Live` ones (their other readers are unknown; additive cannot regress):

```sql
CREATE NONCLUSTERED INDEX IX_tProjectStages_ProgramFK_StageId ON dbo.tProjectStages (ProgramFK, StageId) INCLUDE (ProjectFK, RevisionId);
CREATE NONCLUSTERED INDEX IX_tProjectComponentCost_Revision_Live ON dbo.tProjectComponentCost (ProjectRevisionFK) INCLUDE (Total, ComponentId) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_tProjectComponentCostPerYear_Cost_Live ON dbo.tProjectComponentCostPerYear (ComponentCostFK) INCLUDE ([Year], Amount) WHERE IsDeleted = 0;
```
(5.6M-row per-year table: expect ~1 minute build on localhost.)

### 2. Deploy artefacts — `Main/Resources/Internal/SQLScripts/`

- Backups captured **before** altering, via `OBJECT_DEFINITION` on dev_200, header in the existing format (see `pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql`), each with `IF DB_NAME() <> N'myps_db_dev_200' RAISERROR(…, 20, 1) WITH LOG`:
  - `pRecomputeProgramCost_backup_pre_lsparent-anystage-perf_20260918.sql`
  - `fProgramStages_backup_pre_lsparent-anystage-perf_20260918.sql`
- Forward script `Migration.ProgramCostLSParentAnyStage.Dev200.2026-09-18.sql` (model: the fix branch's `Migration.ProgramCostPerYearRule.Shared200.2026-09-15.sql` header/guard/preflight/verification shape): guard `DB_NAME() = N'myps_db_dev_200'`; preflight prints (`@@SERVERNAME`, object checksums, row counts, existing index definitions of the 3 tables); the 3 indexes; the 2 bodies byte-for-byte from section 11; verification (indexes exist; both objects bind; `BEGIN TRAN; EXEC …; ROLLBACK` with `STATISTICS TIME/IO` on the big program; per-program table stored `Cost` vs `fProgramStages` current-stage `Cost` vs LS any-stage vs LS current-stage sums; parents whose stage ≠ program stage; latest-live parent revisions with >1 live LS component (today 0); rows where `ComponentId='LS'` disagrees with the `tOptionProjectComponentType` name lookup (today 0)); optional `@RunBackfill BIT = 0` cursor over `tPrograms` in TRY/CATCH reporting skipped programs (the known `decimal(18,5)` overflow group). Rollback = the two backup files; index drops listed commented in the header.
- Never touch `192.168.50.200`. Note that the fix branch's Shared200 script must be re-cut from the new section 11 if ever deployed.

### 3. C#

- New `Helpers/ProgramCostRecompute.cs`: `public static async Task<decimal?> RecomputeProgramCostAsync(this MYPSDbContext db, string programPK, CancellationToken ct)` wrapping the existing `FromSqlInterpolated($"EXEC dbo.pRecomputeProgramCost @ProgramPK={programPK}").AsNoTracking().ToListAsync(ct)` and returning `FirstOrDefault()?.NewCost` (extension-method style like `Helpers/LumpsumHelper.cs`).
- Call sites → helper:
  - `LumpsumController.Writes.cs` CreateLumpSum (~360) and ReplenishLumpSum (~1067): un-comment, unconditional.
  - `LumpsumController.Writes.cs` UpdateLumpSum (~793): `decimal AllocationBefore = LsRow.Total;` right after `LsRow` is resolved (~line 643, before any write); after the final `SaveChangesAsync` (~788) re-read `tProjectComponentCost.Total` for `LsRow.Id` with `AsNoTracking`; `bool HasCostUpdate = AllocationAfter != AllocationBefore;` recompute only when true (per-year balance and detail fields no longer move program cost).
  - `WebAPI/Controllers/Projects/ProjectController.cs:4394-4407`: replace inline query, keep the `HasCostUpdate` gate, `ProgramRevision.Cost = NewCost ?? 0`.
  - `WebAPI/Controllers/Revision/RevisionController.cs:2406-2409`: replace inline query inside the existing full-approval gate.
- The maintainer's working-tree comment-out is superseded by this change; do not sweep other uncommitted edits (`.claude/settings.json`, `FE/.env.development`, `Main/appsettings.Development.json`) into the commits.

### 4. Tests — `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`

- Base on the fix branch's file (`git show fix/program-details-cost-computation:MYPS.DatabaseTests/RecomputeProgramCostTests.cs`) — port its per-year fixtures/tests; embed the **new** proc body byte-for-byte as `ProcedureSql` and add `FunctionSql` (fProgramStages) to the harness (`InitializeAsync`).
- Harness schema additions: `tProgramRevisions.Cost decimal(18,5)`, `tProgramStages.ProgramFK/StageName`, `tPrograms.Type/UserGroup/DataSecurityGroup` (+ nullable `StartYear` for the guard test), `tOptionProgramType`, `tOptionProgramStage`, `tProjectRevisions(Id, ProjectFK, IsDeleted)`, `tProjects.ProgramFK`, `tProjectComponentCost.ComponentId`.
- Helper `AssertBothPathsAsync(expected)`: runs the proc, asserts stored `Cost` **and** `fProgramStages` current-stage `Cost` equal `expected` — used by every test (proves "one rule by two paths").
- Ported: contract/columns, rollback with caller's transaction, missing revision error, concurrent safety, several-years→program-year, one-year→any-year, two components one year, no per-year rows, latest revision at stage only, deleted components/years ignored.
- New: parent counts LS `Total` only and never its per-year row (fixture: Total 500, per-year 200 → 600 with the 100 ordinary project); child with an LS component and a program-year per-year row contributes 0; parent at a non-current stage (and with no stage row) still counts; non-LS component on a parent does not count; parent uses latest **live** revision (older live 400, newer deleted 9000 → still 500); parent of another program does not count; NULL `StartYear` raises error 50000 containing "has no StartYear"; every stage row of `fProgramStages` carries the same Lump Sum figure.
- **LocalDB is not installed on this machine** (`(localdb)\MSSQLLocalDB` unreachable). Port the fix branch's `LocalDbSafety.cs` env override (`MYPS_TEST_SQL_SERVER`, `MYPS_TEST_SQL_USER`, `MYPS_TEST_SQL_PASSWORD`) so the suite runs against `localhost` (still only `MYPS_Test_<guid>` databases are created/dropped).

### 5. Documentation

- `documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md` (structure of `MYPS_LUMPSUM_DEADLOCK_RCA.md`): Symptom → The cause (the four-row reads table + the three-times CTE and per-row lookup findings) → Measurements (3,157 ms → 340 ms rewrite → after-indexes figure) → Contributing conditions → The stage-filter zeroing of 86/123 parents → Fix → Verification → Production steps (indexes safe anywhere; bodies must ship with a re-cut Shared200 script; never run the Dev200 script on the shared server).
- Copy this plan to `documents/plans/program-cost-recompute-slow-rca.md` (repo convention) and mark it Implemented with a Completion Log at the end.
- Update `documents/docs/engineering/MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md` only if it names the stage rule (one line).

## Ordered tasks

1. `git checkout -b fix/program-cost-recompute-perf dev-trunk` (leave the maintainer's other uncommitted files untouched).
2. Read-only captures on dev_200 → the two backup files; baseline timings (`before.txt` in the scratchpad).
3. Migration source: block 6b indexes, section 11 prose + two bodies, verification names.
4. Dev200 forward script (bodies copied from step 3).
5. Helper + five call sites + UpdateLumpSum gate.
6. Tests + `LocalDbSafety` override.
7. Run the Dev200 script on localhost; `dotnet build project_myps.sln`; `dotnet test MYPS.DatabaseTests/MYPS.DatabaseTests.csproj` with `MYPS_TEST_SQL_SERVER=localhost`.
8. RCA doc + plan copy; commit at stage boundaries (SQL+scripts / C# / tests / docs).
9. `/code-review` on the diff; check against the acceptance list below.

## Acceptance criteria

- [x] `EXEC dbo.pRecomputeProgramCost` on `MP_P_CO-PS-635_07212023_081334`: < 400 ms (was 3,157); `tProjectStages` scan count 1; `tProjects` < 10,000 reads (was 992,166); `tProjectComponentCostPerYear` < 100,000 reads (was 499,150).
- [x] Same call is fast when a tiny program is executed first (no sniffed plan).
- [x] `NewCost` for that program = 289,327,226,000.00 (ordinary, unchanged) + its 34 parents' LS Totals (newly counted at GAA-R); the per-program verification table reconciles stored vs function costs.
- [x] A Lump Sum parent contributes exactly its live LS component `Total`; its per-year rows and its children contribute nothing; stage does not matter for parents.
- [x] `fProgramStages` current-stage `Cost` equals `pRecomputeProgramCost` `NewCost` on every test fixture and on every dev_200 program (except the known overflow group, reported). Checked by recomputing each program inside a rolled-back transaction; the backfill itself was not run.
- [ ] Create/Replenish always recompute; Update recomputes only when the LS `Total` changed (API log shows no `EXEC` on a description-only save). Code in place and builds; not yet exercised against a running API.
- [x] Both backups refuse any database other than `myps_db_dev_200`; the forward script refuses likewise; `192.168.50.200` untouched.
- [x] `MYPS.DatabaseTests` passes against localhost.

## Verification

```
sqlcmd -S localhost -d myps_db_dev_200 -E -Q "SET STATISTICS TIME ON; SET STATISTICS IO ON; BEGIN TRAN; EXEC dbo.pRecomputeProgramCost @ProgramPK = N'MP_P_CO-PS-635_07212023_081334'; ROLLBACK TRAN;"
sqlcmd -S localhost -d myps_db_dev_200 -E -Q "SET STATISTICS TIME ON; SELECT StageId, StageName, ProjectCount, Cost FROM dbo.fProgramStages(N'MP_P_CO-PS-635_07212023_081334') ORDER BY StageId;"
dotnet build project_myps.sln
$env:MYPS_TEST_SQL_SERVER='localhost'; dotnet test MYPS.DatabaseTests/MYPS.DatabaseTests.csproj
```
Manual UI: on an HGAB/NEP/BP program owning a GAA-R parent, Program List stage Cost and Program Details header Cost agree and include the parent's allocation; Replenish the parent → Details Cost rises by the top-up; save Description only → no `EXEC dbo.pRecomputeProgramCost` in the API log; itemize a child → parent Remaining falls, program Cost unchanged.

## Risks / follow-ups (not in this plan)

- Merge conflict with `fix/program-details-cost-computation` (section 11, test file, `LocalDbSafety.cs`) — resolution documented in the PR.
- Ordinary projects still read base tables (revision approval does not update them) and still count soft-deleted revisions — unchanged, tracked in `documents/plans/program-cost-review-remediation.md`.
- Known `decimal(18,5)` overflow group `MP_P_CO-PS-634_02272023_143836` will still raise Msg 8115 on recompute; backfill skips and reports it.
- `DeleteLumpSum` / `DeleteItemizedProject` never recompute (a deleted parent leaves its allocation in stored Cost until the next write) — follow-up.
- `IX_tProjectComponentCost_Live` / `IX_tProjectComponentCostPerYear_Live` may become redundant; check `sys.dm_db_index_usage_stats` later before dropping.

## Completion Log

**2026-09-18, branch `fix/program-cost-recompute-perf` (from `dev-trunk` 5256911e).**

Commits:

- `4d7652fa` SQL: section 6b indexes and the rewritten section 11 in `Migration.SchemaAndProgrammability.2026-09-10.sql`; `Migration.ProgramCostLSParentAnyStage.Dev200.2026-09-18.sql`; the two `*_backup_pre_lsparent-anystage-perf_20260918.sql` rollbacks.
- `c3031da9` C#: `Helpers/ProgramCostRecompute.cs`; the five call sites; the `UpdateLumpSum` gate.
- `6eae43c8` Tests: `RecomputeProgramCostTests.cs` loads both objects from the migration source; `LocalDbSafety.cs` gains the `MYPS_TEST_SQL_SERVER` override.
- Docs: `documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md` and this file.

Deployed to localhost `myps_db_dev_200` only, twice. The second deploy replaced the parents' `ROW_NUMBER` over `tProjectRevisions` with a `TOP 1` per parent, after profiling showed it scanned all 258,561 revisions.

Results:

- `pRecomputeProgramCost` on the largest program: 3,157 ms to 310–330 ms, also when a small program runs first.
- `fProgramStages`: one stage 790–860 ms to 580–730 ms; all stages 7.4–7.6 s to 1.1–4.9 s.
- The procedure and the function agree on 72 of 73 programs. The 73rd is the known `decimal(18,5)` overflow group, which failed before this change too.
- `MYPS.DatabaseTests` passes 30 of 30 against localhost.
- Stored `tProgramRevisions.Cost` is unchanged on every program. The backfill was not run.

Deviations from the plan:

- The tests no longer embed copies of the objects; they read them from the migration source, so there is nothing to keep byte-for-byte in sync.
- The Lump Sum part of both objects uses a `TOP 1` latest-revision lookup per parent instead of `ROW_NUMBER`.
- `dotnet build project_myps.sln` fails on `CrystalReportService`, a .NET Framework project the dotnet CLI cannot build on this machine. `Main.csproj` and `MYPS.DatabaseTests.csproj` build cleanly.

Not done:

- The manual UI check and a running-API check of the `UpdateLumpSum` gate.
- The optional backfill (`@RunBackfill = 1`).

**2026-09-18, later.** Added `Main/Resources/Internal/SQLScripts/ProgramCost.Objects.2026-09-18.sql`, a standalone update of the three indexes and the two objects for any database except `myps_db`, cut byte-for-byte from section 11. While verifying it, the API's one-stage `fProgramStages` read on the largest program measured up to three times slower than the old body. `fProgramStages` now groups the per-year figures before joining the project set; figures are unchanged, and both read paths are at or under the old body. Redeployed to `myps_db_dev_200`; 30 of 30 tests pass and the procedure agrees with the list on 72 of 73 programs, as before.
