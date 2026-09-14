# Plan: migrate the legacy 2024 `…LS` projects onto the Lump Sum data model

Status: **Implemented** (2026-09-14)
Created: 2026-09-14
Source: this session's profiling of `localhost/myps_db_dev_200`, plus the maintainer's addendum excluding `MY…LS` identifiers
Branch: `feat/legacy-ls-migration` (from `dev-trunk`) — Target DB: `localhost/myps_db_dev_200` first; script is **server-bound**
Write-up: `documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md`


---

## Context

`myps_db_dev_200` is a restore of the 192.168.50.200 server. The 2026-09-13 bring-up gave it the Lump Sum v3 **schema** (columns, views, actions) but, by design, **no data migration** — the migration header says so explicitly ("It contains NO DATA MIGRATIONS"). The three `vLumpSumSet` rows it shows today are the MyMYPS sample fixture.

The database also carries **59 Lump Sum projects migrated from 2024 data**: `tProjects.ProjectPK` ends in `LS`, under three GAA 2024 programs. They predate the model, so the Lump Sum module cannot see them (`vLumpSumSet` requires `ProjectType = 'LS'`) and, once it could, would mis-report them (doubled allocation, no funding, invalid Sub-Category). This plan brings exactly that set onto the model of 2026-09-06:

```
LS component Total   = the full allocation = Σ live funding lines
LS per-year Amount   = the remaining balance = Total − Σ children's costs
```

### What the data actually is (verified 2026-09-14 against the live database)

| Fact | Value |
|---|---|
| Legacy parents | **59** — `ProjectPK LIKE '%LS' AND ProjectType <> 'LS'` |
| `ProjectType` on them | the literal **string `'NULL'`** (56,769 projects share this artifact — see Out of scope) |
| Programs | `P_CO-PS-634…` "GAA 2024 SSP" (34) · `P_CO-PS-278…` "GAA 2024 LP" (21) · `P_CO-PS-635…` "GAA 2024 OO-1" (4). All three: StartYear **2024**, latest revision **Approved at GAA-R** |
| Live revisions per parent | 2 (older at GAA, latest at GAA-R); the P008 group has 5. Views read the latest only |
| `AlternateId` on the parent | its **own** ProjectId (P008 group: its original pre-renumber id, e.g. PK `…P00800001LS`, ProjectId `P00800005LS`, AlternateId `P00800001LS`) |
| Itemized children | **none.** Searched by `AlternateId` = ProjectId / PK suffix / ExternalId / numeric core, and by `tProjects.ParentProjectId` — zero hits. The 13 numeric-core matches are unrelated `P00800005VS/LZ/MN` regular projects sharing a running number |
| LS components on latest revision | **53 carry an identical duplicate pair** (same Total, same rows, same `CreatedDate`, `CreatedBy = cabalrla`); 6 carry one component with `Total = 0` |
| Per-year rows | 10 per component (2024–2033); only **2024** is non-zero and holds the UACS. Σ first-component Totals = ₱4,778,229,699.08 |
| Funding lines | **0** on every parent |
| `Thrust` | **0** on 55 (not a PAPKey); the P008 four carry 1024/1026/1027/1124 |
| Tier / Category / required fields | Tier 1; Category 29 / 30 / 16; OperatingUnit, Origin, Agency, RegionWide, Description all present |
| `IsPublishable` / `MYId` | 0 / NULL (P008 four have `ExternalId` = their renumbered ProjectId) |

### Out of scope, recorded

1. **MY-prefixed LS IDs** (`MY00003005LS`, `MY00040003LS`) belong to a module not yet implemented. Per instruction they are **not migrated**; Task 1 writes their inventory to a separate file. They are the only IDs in the database that actually have `AlternateId`-linked children (14 + 1).
2. **`ProjectType = 'NULL'` (string) on 56,769 projects.** A restore/import artifact. This migration sets `'LS'` on its 59 and leaves the rest; the wider cleanup is its own decision.
3. **Column-sort no-op and pagination** — separate branch `fix/pagination-keyset-migration`.

---

## Decisions (taken 2026-09-14)

| # | Decision | Chosen |
|---|---|---|
| D1 | Nine zero per-year rows per component | **Soft-delete**, keep the program-StartYear (2024) row |
| D2 | Six parents with `Total = 0` | **Migrate all 59**; they get a ₱0 funding line |
| D3 | `Thrust = 0` | **Keyword match against allowed in-window ThrustDescriptions, else lowest allowed PAPKey**; every pick reported |
| D4 | Script destination | **Server-bound migration**: refuses `myps_db`, idempotent, `XACT_ABORT`, backup in runbook |

---

## Approach

One idempotent T-SQL script, in the house style of `Main/Resources/LumpSum/SQL/LumpSum.SampleData.Dev.sql` §4b–4e and the historical `LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql` (`git show 514024f1:Main/Resources/Internal/SQLScripts/LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql`). No C# changes; no view changes. The writers already handle the migrated shape — `Helpers/LumpsumHelper.cs` `SyncLSToFundingAsync` / `MoveLSBalanceAsync` derive from exactly the rows this script leaves behind.

**Scope predicate, used by every section** (materialised once into `#Legacy`):

```sql
SELECT p.Id AS ProjectRowId, p.ProjectPK, p.ProgramFK, lr.Id AS RevisionId, lr.ProjectId, lr.Category, lr.Thrust, lr.Description, g.StartYear
FROM   dbo.tProjects p
CROSS APPLY (SELECT TOP 1 r.* FROM dbo.tProjectRevisions r
             WHERE r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0 ORDER BY r.Id DESC) lr
JOIN   dbo.tPrograms g ON g.ProgramPK = p.ProgramFK
WHERE  p.ProjectPK LIKE N'%LS'
  AND  ISNULL(p.ProjectType, N'') <> N'LS'      -- 'NULL' string today; re-run sees 0 rows
  AND  p.ParentProjectId IS NULL
  AND  lr.ProjectId NOT LIKE N'MY%';            -- addendum: MY-prefixed are another module
```

Expect **59** on first run, **0** on every later run (the `ProjectType` flip in §5 is what makes it idempotent). The `NOT LIKE 'MY%'` clause matches nothing today (no MY-prefixed `ProjectPK` ends in LS) but states the exclusion where a future restore would need it.

### Script: `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`

Header in the same voice as the 2026-09-10 migration: what it closes, what it refuses, the data profile above, run order, `QUOTED_IDENTIFIER ON` (filtered index on `tProjects`), `sqlcmd` line. `@Who = N'migrate:LumpSum.Migrate.LegacyLSProjects.2026-09-14'` stamped on every `UpdatedBy`/`CreatedBy`.

| § | Does | Guard / idempotency |
|---|---|---|
| 0 | Print server/db/time; `RAISERROR(...,20,1) WITH LOG` + **`SET NOEXEC ON`** if `DB_NAME() = 'myps_db'` (closes bring-up review finding #3's fail-open for non-sysadmin) | — |
| 1 | Build `#Legacy`; print count; `NOEXEC ON` if 0 rows with "nothing to migrate" (clean re-run) | — |
| 2 | **Duplicate LS component.** For each revision with >1 live `LS` component (`tOptionProjectComponentType.ComponentId = 'LS'` resolved by name, as `FindLSComponentAsync` does): assert the pair is identical (Total, per-year count, per-year Σ, UACS rows); soft-delete every component but the **lowest Id** and all its per-year rows (`IsDeleted = 1, UpdatedBy/Date`). A pair that is **not** identical is reported and left alone (→ DRIFT in §8) | only revisions with ≥2 live LS rows |
| 3 | **Per-year consolidation (D1).** On the surviving component: soft-delete live rows where `Amount = 0 AND Year <> StartYear AND UACS IS NULL`. Assert exactly one live row remains; if not, report and skip §6 for that parent. Fill `StartDate/EndDate` = 1 Jan–31 Dec of the row's Year where NULL (the dialog demands both; `CreateLumpSum` writes them) | rows already deleted / dates already set match nothing |
| 4 | **Sub-Category (D3).** For rows whose `Thrust` is not an allowed, in-window PAPKey for their Category (same predicate as SampleData §4d: `tOptionProjectCategoryToPAPMap` × `tOptionProjectThrustList` with the `ValidFromDate < StartYear < ValidToDate OR ValidToDate = 0` window): pick the allowed PAPKey whose `ThrustDescription` shares a keyword with the revision `Description` (keyword table stated in the script — start with `Buildings`, `Health`, `Roads`, `Bridges`, `Drainage`, `Flood`, `Water`, `School`; extend after the dry run prints the unmatched descriptions); tie → lowest PAPKey; no match → lowest allowed PAPKey. Print a full pick table (ProjectId, Description, old Thrust, new PAPKey, ThrustDescription, `matched_by`). Apply to the **latest live revision only** | already-valid Thrust untouched; the P008 four expected to pass through |
| 5 | **Identity.** `UPDATE tProjects SET ProjectType = N'LS', IsPublishable = 0` for `#Legacy`. Leave `ParentProjectId`, `ItemizationType`, `ProjectStatus` NULL (those are child columns). Leave `AlternateId` as found — a parent's Alternate ID is free text (`CreateLumpSum` writes `dto.AlternateId`) | the predicate excludes rows already `'LS'` |
| 6 | **Funding line.** One `tProjectFundingProfile` per latest revision that has none live: `SourceOrg = 'GOP'`, `AgreementCode = 'DPWH-GAA-2024'` (Id 64, active — the 2024 analogue of the sample's `DPWH-GAA-2025`), `Amount = surviving LS component Total`, `Percentage = 100`, `IsWalletDraw = 0`. ₱0 for the six (D2). Then **`Total := Σ funding`** and **per-year `Amount := Total − 0`** (no children) — the same two UPDATEs as SampleData §4e, written against their post-condition | skipped where a live line exists |
| 7 | **Referential + model checks** (every count must be 0): orphan revisions/costs/per-year/funding; `#Legacy` rows not in `vLumpSumSet`; `vLumpSumSet` rows with `ABS(OriginalAllocation − (Remaining + ItemizedTotal)) > 0.005` (DRIFT); parents with ≠1 live LS component; parents with ≠1 live per-year row; parents whose Thrust is still not allowed | — |
| 8 | Print the after-state: `vLumpSumSet` count (expect **62** = 3 sample + 59), Σ `OriginalAllocation` of the 59 (expect **₱4,778,229,699.08**), per-program counts (34/21/4), `vLumpSumChildSet` unchanged at 18 | — |

Whole of §2–§6 inside one `BEGIN TRAN … COMMIT` with `SET XACT_ABORT ON`; §7 runs after commit and reads the views. Every section `PRINT`s its `@@ROWCOUNT`.

**What it deliberately does not touch:** the older GAA-stage revisions (71 carry components; the views read the latest only, and rewriting history is not this script's job); any project whose `ProjectPK` does not end in `LS`; any `MY…` id; `sp_RBP` / `a1_usp_AIP2`; the isolation flag.

### Reference implementations to copy from

- Duplicate detection & "exactly one live LS row or hands off": `LumpSum.SampleData.Dev.sql` §4e `#LSCostRows` block.
- Allocation/balance UPDATEs: same file §4e `Parent` CTE and `#ParentLS`.
- Thrust window predicate and reporting shape: same file §4d.
- Verification blocks: same file §5–§6; `Migration.SchemaAndProgrammability.2026-09-10.sql` PART 8.
- Guard idiom: `Migration.SchemaAndProgrammability.2026-09-10.sql` §0 (add `SET NOEXEC ON` after the `RAISERROR`, as `SampleData.Dev` does).
- Component lookup by name: `Helpers/LumpsumHelper.cs:31` `FindLSComponentAsync`; the parent write shape: `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs:170-345` `CreateLumpSum`.

---

## Tasks

### Task 1 — MY-prefixed inventory (Junior)
Write `documents/MYPS_LS_MY_Prefixed_Projects.md`: purpose (excluded from this migration; reserved for the unimplemented module), then one table — `ProjectPK · ProjectId · AlternateId · ProgramId · Program name · IsDeleted`. Rows (16), from the live query:

```
MY00003005LS ← P00402036LZ, P00706284VS, P00706286VS, P00713367LZ…P00713377LZ (11)   all P_CO-PS-635_07202023_140408 "GAA 2024 OO-1"; MYId = ExternalId = MY00003005LS
MY00040003LS ← P00655042VS                                                            P_CO-PS-278_01262024_140207 "GAA 2024 LP"
MY00003005LS ← BP01009254VS (ProjectType VS, ProgramId LAPTOP-DG33KKDI_09102026_152436 — a 2026-09-10 test fixture, flagged as such)
```
Include the SQL that produced it so it can be re-run. No MY id appears as a `tProjects.ProjectPK` or a revision `ProjectId` — they exist only in `AlternateId`/`MYId`/`ExternalId`; say so.

### Task 2 — The migration script (Senior)
`Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql` per the section table above. Develop against a **dry-run** first: `BEGIN TRAN … ROLLBACK` with every report printed, then run for real.

### Task 3 — Runbook and write-up (Documentation)
- `documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md`: the data profile, the decisions D1–D4 with reasons, the run log (before/after figures), what was left alone and why, and the "no children" finding with the search evidence.
- Both runbook copies (`documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md` and `Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md`): a **Step 3b — Legacy Lump Sum data** between isolation and optional fixtures, with the sqlcmd line, the backup reminder, the expected `62 / 0 DRIFT` output, and the MY exclusion. Fix the two stale `Main/Resources/Internal/SQLScripts/` paths while there (review findings #10/#11).
- `FE/src/pages/LumpSum/LumpSum.md`: one paragraph under the model section noting the 59 migrated 2024 parents, that they sit under Approved GAA-R programs (create/delete refused, details read-only, Import/Replenish live), and that their Sub-Category was assigned by the script and is expected to be corrected by hand where wrong.

### Task 4 — Persist the plan (Junior)
Copy this file to `documents/plans/legacy-ls-migration.md` with `Status: Approved`, so `/implement-task` and the Completion Log convention apply.

---

## Files touched

```
new   Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
new   documents/MYPS_LS_MY_Prefixed_Projects.md
new   documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md
new   documents/plans/legacy-ls-migration.md
mod   documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md
mod   Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md
mod   FE/src/pages/LumpSum/LumpSum.md
```
No C#, no views, no FE code.

---

## Verification

1. **Backup first**: `BACKUP DATABASE myps_db_dev_200 TO DISK = '…\myps_db_dev_200_pre_legacyls_20260914.bak' WITH COMPRESSION` (the runbook's own rule: Step 1 drops, this one deletes).
2. **Dry run** (script with `ROLLBACK`): §1 prints 59; §2 prints 53 duplicates removed, 0 non-identical; §3 prints 9×59 = 531 zero rows soft-deleted (six zero-total parents included — their 2024 row survives on `Year = StartYear`); §4 prints 55 picks, table eyeballed, unmatched descriptions used to extend the keyword list; §6 prints 59 lines; §7 all zeros.
3. **Real run**, then:
   ```sql
   SELECT COUNT(*) FROM dbo.vLumpSumSet;                       -- 62
   SELECT SUM(OriginalAllocation) FROM dbo.vLumpSumSet
    WHERE ProgramId <> 'P_CO-PS-535_03252025_073824';           -- 4778229699.08
   SELECT COUNT(*) FROM dbo.vLumpSumChildSet;                   -- 18 (unchanged)
   -- DRIFT check from SampleData §5: every row OK
   ```
4. **Idempotency**: run again → §1 reports 0 rows, script exits with "nothing to migrate", no error.
5. **Through the API** (scratch build on 5016 per the e2e memory, connection string verified `Database=myps_db_dev_200` in the copy): `POST /Lumpsum/ShowLumpSum` with Year filter 2024 pages through 59 rows; `LumpSumDetails` on `P00855001LS` returns `OriginalAllocation 2,715,782,000 · Remaining 2,715,782,000 · ItemizedTotal 0`, `ProgramApproval` non-null; `UpdateLumpSum` echo of the fetched payload answers **200** (proves Thrust/Tier/dates pass `ValidateRequiredFieldsAsync` and the Approved-program field guard sees no change); `CreateLumpSum` under any of the three programs answers **"Program Approved"** (expected, not a regression).
6. **Through the UI**: `/lumpsum` lists the 2024 projects; open one — rose "Program Approved" banner, details read-only, Component Cost dialog opens showing one 2024 row with dates; Replenish dialog opens.
7. **Regression**: `ls-contract`, `ls-list-tolerance`, `ls-module-ui-walkthrough.narrated` on ports 5016/8090 — the walkthrough's pager test now has 59 extra real rows behind it, which is the case its tightened polls were written for.
8. Record before/after figures in the engineering write-up; commit at each stage boundary (script, docs) on the new branch.

---

## Risks

| Risk | Mitigation |
|---|---|
| The "identical duplicate" assertion fails on the server copy though it passes here | §2 leaves any non-identical pair alone and reports it; §7 surfaces it as DRIFT rather than writing a doubled allocation |
| Keyword Thrust assignment is wrong for some descriptions | Every pick is printed and documented; the field is editable once a program is set back to Working; the alternative (leave 0) makes Save/Replenish/Import refuse outright |
| Soft-deleting 531 per-year rows on the server | Soft delete only, stamped `@Who`, reversible with one UPDATE; backup taken first |
| A reader elsewhere (reports, `sp_RBP`, AIP) keys on `ProjectType = 'NULL'` or on the ten-year row shape | Grep `ProjectType` in `Main/Resources/Internal/SQLScripts/Reports/` and the two live procedures' definitions before the real run; the 59 are the only rows that change |
| Older GAA-stage revisions still carry the duplicate/ten-row shape | Not read by any Lump Sum view; noted in the write-up as deliberately untouched |

---

## Completion Log

Implemented 2026-09-14 on branch `feat/legacy-ls-migration`. Backup taken first
(`myps_db_dev_200_pre_legacyls_20260914.bak`, 196,121 pages).

- Wrote `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql` — idempotent,
  transactional, `NOEXEC`-guarded, with a `@DryRun` switch and a full report per section.
- Ran it dry three times, fixed what each run exposed, then ran it for real: **59 projects
  migrated**, every referential and model check **0**, `vLumpSumSet` **62**, allocation
  **₱4,778,229,699.08** (exactly the figure predicted from the profiling), invariant **OK on all 62**,
  `vLumpSumChildSet` unchanged at **18**. A second run reports **0 in scope**.
- Wrote the MY-prefixed inventory (`documents/MYPS_LS_MY_Prefixed_Projects.md`) — 16 projects, 2
  identifiers, with the re-runnable query and the proof that no `MY…LS` value is itself a project key.
- Wrote the engineering write-up (`documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md`).
- Added **Step 3b** to both runbook copies and corrected the two stale
  `Main/Resources/Internal/SQLScripts/…` paths in them (bring-up review findings #10/#11).
- Added the migrated-data paragraph to `FE/src/pages/LumpSum/LumpSum.md`.

### Changed from the plan, and why

Three things the plan did not anticipate, all found by the dry runs:

1. **`ComponentType` stores the code, not the name.** The plan assumed the module's convention
   held in the data. It does not on this lineage: 245,367 `CW` and 100,566 `EAO` rows store the
   code, against 5 rows database-wide holding a canonical name. Since every Lump Sum reader joins
   on the name, the first dry run found **0** LS components across all 59 — flipping `ProjectType`
   alone, as the plan's §5 described, would have changed nothing visible. Added a normalisation
   step and widened the membership predicate to accept either spelling.
2. **The "empty" per-year rows hold `''`, not `NULL`.** The plan's retirement predicate used
   `UACS IS NULL` and matched nothing. Widened to blank-or-null, and added a normalisation of
   blank to `NULL` on survivors — `vLumpSumSet` filters `IS NOT NULL` only, so a blank row can be
   surfaced as the project's UACS.
3. **`dbo.tPrograms` has no `ProgramId` column.** The readable key lives on the project and the
   views; `#Legacy` now carries it from `tProjects`.

Two smaller corrections: `PRINT CONCAT(...)` cannot contain a subquery (it fails the whole batch at
parse time, which is how the first attempt aborted every write section), and a scalar subquery in
the verification block needed wrapping in a derived table.

### Left open, deliberately

- **`P00830018LS` has a wrong Sub-Category.** "Rehabilitation of Disaster-Related Infrastructure and
  Other Facilities" matched no rule and took the deterministic fallback (1054). It is a placeholder
  that keeps the project saveable; it is recorded in the write-up for correction by hand.
- **`ProjectType = 'NULL'` on 56,710 other projects** and **`ComponentType` as a code on ~353,000
  other rows** — both real artifacts of this lineage, both out of scope, both their own decision.
- **The older live revisions** still carry the duplicate/ten-row shape. No Lump Sum view reads them.
- **Bring-up review finding #3** (the 2026-09-10 migration's `myps_db` guard fails open for a
  non-sysadmin login) is unfixed in that file; this script demonstrates the `SET NOEXEC ON` fix.

### Not done

The plan's verification steps 5-7 — driving the migrated data through the API on a scratch build,
through the UI, and re-running the Playwright suites — were **not run**. The database-level
verification is complete and reported above; the application-level checks remain.
