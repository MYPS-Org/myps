# Plan: load the 2023 / 2025 program groups from `MYPS_BAK` and complete the Lump Sum migration

Status: **Implemented** (2026-09-14) — see the Completion Log
Created: 2026-09-14
Supersedes: `documents/plans/legacy-ls-migration.md` (implemented 2026-09-14 for the 59 parents already on `dev_200`)
Source: profiling of `localhost/MYPS_BAK` + `localhost/myps_db_dev_200`, the maintainer's addenda (2023 onwards only; use the python reference pipeline; `vw_notes` records itemization; non-BP-first groups are valid)
Branches: `feat/legacy-ls-migration` (this repo) · `feat/data-migration-2023-2025-groups` (`02_refactored/myps-gis-backend`)
Databases: source `localhost/MYPS_BAK` → target `localhost/myps_db_dev_200`. **Localhost only.**


## Context

### What the request turned out to be

The request: LS projects (`ProjectId` starting `P` or `BP`, ending `LS`) whose components are not LS-typed should be migrated with those components as the lone LS component; already-migrated parents handled too. Two addenda since: only 2023 onwards, sourced from `MYPS_BAK` through the **python reference pipeline** in `documents/python_migration` (not a new script); and `MYPS_BAK.dbo.vw_notes` records itemization — e.g. `GAA 2023 CSSP | P00746419LZ | Itemized from Project: P00730052LS`. Non-BP-first program groups are valid.

`dev_200` has no LS project with a non-LS component; they are in `MYPS_BAK`, whose 2023/2025 groups the 2026-09-10 restore never received. `MyMYPS` is dummy data and is ignored.

### The data, verified 2026-09-14

| Year | Groups (stages) | LS parents | Latest-stage components | Itemized children (from `history`) |
|---|---|---|---|---|
| **2023** | CSSP, LP, OO-1 — each BP → NEP → HGAB → GAA → GAA-R | **57** (34 / 20 / 3) | `LS` only | **2,010** — CSSP 2,001 under 26 parents, LP 1 under 1, OO-1 8 under 3 |
| 2024 | SSP, LP, OO-1 — on `dev_200` already | 59 | `LS` only | **2,028** — SSP 2,024 under 19, OO-1 3 under 2, LP 1 under 1 — **2,027 of them are already on `dev_200`, none linked** |
| **2025** | OO-1 — BP → NEP → NEP-E → GAA → GAA-R | **4** (`P00900001LS`–`04LS`, first appear at GAA) | **`CW:CW1` only** — the case in the request | none |

**How the old model records itemization.** Not in `alternate_id` (0 of 42,589 links) but in `history.description = 'Itemized from Project: <parent>'` on the **child's** row, in the GAA-R program only; children exist **only** at GAA-R (they are created by itemization). Every parent in the notes ends in `LS`, prefix `P0`. One 2024 child (`P00851066VS` → `P00830018LS`) has a note but no `project` row — reported, not migrated.

**Itemization reduced the parent's stored cost.** `P00730052LS`: GAA 11,000,000,000 → GAA-R 9,826,178,558.32 with 446 children costing 10,429,053,146.08. The GAA-R LS figure is therefore the **remaining balance**, not the allocation, and the GAA-stage figure is not a reliable original either (top-ups happened at GAA-R: 20 of 26 CSSP parents satisfy GAA − GAA-R = Σ children, 6 do not). Under the model of 2026-09-06 the only identity that holds is:

```
Remaining          = the parent's stored LS cost at GAA-R          (per-year Amount)
ItemizedTotal      = Σ children's latest-revision component costs  (the view computes it)
OriginalAllocation = Remaining + ItemizedTotal                     (component Total = Σ funding)
```

This also explains the six ₱0 parents migrated on 2026-09-14 (`P00830018LS`: remaining 0, 243 children costing 8,018,736,757.37) — they were fully itemized, not unfunded, and their current `OriginalAllocation 0` is wrong.

### Two defects in the reference pipeline that this load would inherit

1. **One component row per distinct yearly cost.** `queries.build_project_component_cost_sql` puts per-year columns inside a `SELECT DISTINCT` meant to be per component: ten cost-stream rows with 9 distinct (cost, dates) shapes become 9 component rows, each with `Total = Σ years`, and the per-year query then joins every per-year row to every copy. On `dev_200` today **176,316 (revision, ComponentId) pairs are duplicated with identical Totals** (up to 27 copies); the 53 duplicate LS components retired on 2026-09-14 were this; and **the 2024 children's costs on `dev_200` are exactly double the source** (2,237 of their 2,280 component pairs carry 2 identical copies — `P00830001LS`'s children: 32,972,842.18 in `MYPS_BAK`, 65,945,684.36 on `dev_200`). Linking those children without retiring the copies would double every 2024 parent's `ItemizedTotal`. Fix: `GROUP BY` at component grain, mandatory before loading.
2. **Target column names.** The reference writes `DataImportProgramId`/`DataImportProjectId` to the program/project/revision/stage/funding tables; `dev_200` has a single `DataImportId` there (the backend's own workflow renames columns on `myps_db_migrated`, which is not acceptable on the app's database). Mapped at write time.

### Reference behaviours relied on

- Keys: `ProgramPK = MP_<first-stage programid>`, `ProjectPK = ProgramPK_<projectid at first appearance>`; `build_first_stage_tracking` applies the BP id-swap **only when the group's first stage is BP**, and `split_new_projects` keys a project first seen at a later stage (every itemized child, at GAA-R) by that stage's id. Non-BP-first groups need only their true first stage listed.
- `Year = <3-digit id segment> + 2015 + year` → 2023 / 2025 for these ids.
- `ComponentType` is written as the old model's **code** (`LS`, `CW`); the Lump Sum readers join on the **name**, which the SQL migration already normalises.
- Nothing in the reference migrates `history`. Pre-flight for the four groups: every `infra_type` maps to `tOptionInfraType`, no NULL reaches a NOT NULL column, no cost-stream row is dropped by the lookup joins, none of the four `ProgramPK`s exists on `dev_200`, all program `usertype`s map; 3 `activityinfra` rows lack a `scope_of_work` and drop as on any run.

Volume by decision (whole groups): 20 stage-programs, ≈103k revisions, ≈161k components after the fix, ≈1.6M per-year rows, ≈136k work items, ≈51k work locations, ≈102k funding lines.

---

## Decisions

| # | Decision |
|---|---|
| D1 | Target `myps_db_dev_200` |
| D2 | **Whole program groups**: 2023 CSSP, 2023 LP, 2023 OO-1, 2025 OO-1, all stages |
| D3 | Backend repo, changed files mirrored into `documents/python_migration/scripts` — **mirror removed 2026-09-14 by the maintainer's instruction**: the backend repo is the only home of the scripts |
| D4 | Component-grain fix in the reference is **required** before loading |
| D5 | `DataImportId` mapped at write time; no schema change on `dev_200` |
| D6 | Non-LS → LS: survivor = the LS component if any, else lowest-Id; identical copies retired; any other live component folded (Total added, retired, printed). Real data has one `CW1` per parent |
| D7 | Proof by rolled-back fixture harness |
| D8 | Localhost only — the entrypoint refuses any host that is not loopback or this machine; target name is a constant |
| D9 | Already-migrated parents re-admitted when they hold a non-LS component, have unlinked noted children, or drift (Σ funding ≠ Remaining + Itemized) |
| **D10** | **Itemization links travel as `tProjectNotes` rows** written by the loader from `history` (`'Itemized from Project:'` and `'Cost reduced due to itemization'` only), so the SQL migration reads the link from the target and stays server-portable. The 2024 groups get the same notes back-filled |
| **D11** | **Children are stamped the way `ImportItemizedProjects` stamps them**: `ParentProjectId` = parent's latest `ProjectId`, `ProjectType 'LS'`, `ItemizationType 'Itemized'`, `ProjectStatus 'potential'` (`'scheduled'` if `IsPublished`, per the Baseline §6 rule), revision `AlternateId` = parent's `ProjectId` (rule 2026-09-05), funding lines `IsWalletDraw = 1`. Their duplicate components are retired the same way as the parents' |
| **D12** | **Allocation = Remaining + Σ children.** The parent's stored per-year Amount is kept as Remaining; the funding line and the component Total are set to Remaining + Σ children's latest-revision costs. For the 22 already-migrated 2024 parents with children this **raises** the 2026-09-14 funding line (it was written at Remaining) |

---

## Phase A — the reference pipeline (backend repo)

`…/02_refactored/myps-gis-backend/app/data_migration/`

- **A0 — baseline.** The repo has uncommitted edits to the four migration files; the working-tree versions of three of them *are* the reference copies here. Commit them as a baseline first so this work's diff is clean (or, if not wanted, build on the working tree and mirror it).
- **A1 — component grain (D4).** `build_project_component_cost_sql`: `GROUP BY t_prj_rev.Id, p_cost_s.projectid, p_cost_s.component, cost_d.description, cost_d.componenttype, prj.userid, prj.datecreated, prj.datechanged, p_cost_s.programid`; `Total = SUM(cost)`; drop `Amount`, `StartDate`, `EndDate`, `DateOfApproval`, `MYCAApprovalDate`, `Name`, `CostTypeId`, `CostType`, `CostDescriptionType` from this query (they belong to the per-year query, which already carries them). Per-year, work-item and work-location queries join on `(revision, component)` and become exact.
- **A2 — target column map (D5).** `to_target(df, table)` applied before every `to_sql`: on `tPrograms`, `tProgramRevisions`, `tProgramStages`, `tProjects`, `tProjectRevisions`, `tProjectStages`, `tProjectFundingProfile` rename `DataImportProgramId → DataImportId` and drop `DataImportProjectId`; component/per-year/work tables untouched (they carry the triple on `dev_200`). Existing `DataImportId` values on `dev_200` are all NULL.
- **A3 — notes (D10).** New `queries.build_project_notes_sql(source, target, program_id)`: `history` rows for the program whose `description` starts `'Itemized from Project:'` or `'Cost reduced due to itemization'`, joined to the target revision on `(projectid, programid)` → `tProjectNotes (ProjectRevisionFK, FileName '', FileExtension '', FilePath '', Description = h.description, CreatedBy = 'data_migration', CreatedDate = h.date)`. Called at every stage in `migrate_projects_and_stages_in_annual_program` after the funding step, plus a standalone `migrate_notes_for_programs(program_ids)` used to back-fill the 2024 GAA-R programs already on `dev_200` (`P_CO-PS-535_03252024_154915`, `P_CO-PS-634_03252024_123925`, `P_CO-PS-220_03252024_155224`), guarded against re-insert (skip when an identical `(ProjectRevisionFK, Description, CreatedDate)` exists).
- **A4 — entrypoint `steps_for_2023_2025_groups.py`** (the reference `steps_for_migration.py` untouched): inline ordered group config `[ProgramId, StageName, StageNum]` with `StageNum` from `tOptionProgramStage` (BP 1, NEP 2, NEP-E 3, HGAB 4, GAA 6, GAA-R 7):
  - 2023 CSSP: `P_CO-PS-291_08222022_145740` BP → `P_CO-PS-282_09212022_141356` NEP → `P_CO-PS-282_12292022_083337` HGAB → `P_CO-PS-282_01142023_105816` GAA → `P_CO-PS-535_03292023_105429` GAA-R
  - 2023 LP: `P_CO-PS-535_09102022_074918` → `P_CO-PS-535_09212022_141445` → `P_CO-PS-535_01052023_101752` → `P_CO-PS-535_01052023_101908` → `P_CO-PS-535_03272023_132031`
  - 2023 OO-1: `P_CO-PS-282_08232022_121112` → `P_CO-PS-635_09212022_141324` → `P_CO-PS-553_12162022_140357` → `P_CO-PS-634_01132023_075641` → `P_CO-PS-635_04182023_172516`
  - 2025 OO-1: `P_CO-PS-800_07152024_143901` BP → `P_CO-PS-635_08062024_153734` NEP → `P_CO-PS-635_09162024_075851` NEP-E → `P_CO-PS-635_01302025_100232` GAA → `P_CO-PS-635_04112025_134220` GAA-R
  
  Source/target hosts and target database are **constants** (`localhost`, `myps_db_dev_200`); `.env` supplies credentials only; both hosts resolved and refused unless loopback/this machine (D8). `SQL_ECHO = False`. Refuses if any of the four `ProgramPK`s already exists (the reference has no idempotency). Runs one group at a time, logs per-stage counts and the reference's `ResolvedBy` tallies, stops at the first exception. A `--notes-only <programid…>` mode runs A3's back-fill.
- **A5 — `migration_sql/rollback_program_group.sql`**: deletes one group by `ProgramPK` in dependency order (notes → work locations → work items → per-year → components → funding → project stages → revisions → projects → program stages → program revisions → program). The reference commits per table per stage, so this is how a half-loaded group is undone without a restore.
- **A6 — tests.** Pure test for `to_target`; `test_sql/verify_component_grain.py` (read-only): for the four `ProgramPK`s, `(ProjectRevisionFK, ComponentId)` groups with >1 live row must be 0 and per-revision Σ Total must equal `MYPS_BAK`'s Σ cost; `test_sql/verify_itemization_notes.py`: notes on target = notes in source for the migrated programs.
- **A7 — mirror** the changed/new files into `documents/python_migration/scripts/` and add `documents/python_migration/docs/2026-09-14_component_grain_target_columns_and_notes.md` with the evidence.

---

## Phase B — the load (`dev_200`)

1. Backup `myps_db_dev_200_pre_2023_2025_load_20260914.bak`.
2. Before-figures (kept for the write-up): table counts; `vLumpSumSet` = 62, `vLumpSumChildSet` = 18; from `MYPS_BAK` per group: projects per stage, Σ cost at GAA-R, children and Σ children cost per parent (the table in Context).
3. Run `steps_for_2023_2025_groups.py` in the background with a log, **2023 LP first** (294 projects) as the smoke test, then 2023 OO-1, 2023 CSSP, 2025 OO-1; then `--notes-only` for the three 2024 GAA-R programs.
4. After each group: `verify_component_grain.py`, the reference's `verify_migrated_keys.py`, SampleData §6 FK checks, `verify_itemization_notes.py`. Failure → `rollback_program_group.sql`, fix, re-run that group.
5. After-figures: `vLumpSumSet` still 62 (new parents are `'NULL'` until Phase C); notes on `dev_200`: 2,010 + 2,028 itemization notes.

---

## Phase C — `LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`, revised in place

The file keeps its name; the header gains a "Revision 2" block covering the `CW` case, the notes-carried links, D12, and the grain defect as the origin of every duplicate it retires.

| § | Change |
|---|---|
| 1 scope | Parents: latest live revision `ProjectId LIKE 'P%LS' OR 'BP%LS' OR ProjectPK LIKE '%LS'`, `NOT LIKE 'MY%'`, `ParentProjectId IS NULL`, program `StartYear >= 2023`, **and** any of: `ProjectType <> 'LS'`; a live non-LS component on the latest revision; an `'Itemized from Project: <this ProjectId>'` note whose child project is not yet linked; `ABS(Σ live funding − (per-year Σ Amount + Σ linked children cost)) > 0.005` (D9). Prints scope by program and by reason |
| 2 lookups | `'LS'` component type; funding agreement `DPWH-GAA-<StartYear>` for every year in scope (2023 = 49, 2024 = 64, 2025 = 67, all active) — `NOEXEC` if missing |
| 3 → "exactly one component, and it is the LS one" | All live components on the latest revision, `IsLS` = name `'Lump Sum'` or code `'LS'`/`'LS1'` on either column. Survivor = lowest-Id `IsLS` if any, else lowest-Id. Identical copies (same class, Total, live per-year count/Σ/UACS rows) retired as today; other live components folded (D6, printed). Survivor converted: `ComponentType 'Lump Sum'`, `ComponentId 'LS'`, per-year `ComponentId 'LS'`, `Description 'Lump Sum'` where it says `'Civil Works'` |
| 4 per-year | Unchanged; plus `Year` outside 2000–2100 → `StartYear`, printed |
| 5 identity | Unchanged (`ProjectType 'LS'`, `IsPublishable 0`) |
| **5b children** (new) | From `tProjectNotes` on the target: parse `'Itemized from Project: <parent>'` → (child revision → child project, parent `ProjectId`). Parent must be in `#Legacy` or `vLumpSumSet`, child must have a live revision — unresolved links printed (expect the one `P00851066VS`). For each child: **retire identical duplicate components** (same rule as §3, per `ComponentId`) and their per-year rows; stamp per D11; `IsWalletDraw = 1` on its live funding lines; write nothing else. A child already linked to the same parent is skipped; one linked to a different parent is printed and left |
| 6 Thrust | Rules unchanged (2023 GAA-R rows already carry valid PAPKeys); report as today |
| 7 allocation (D12) | `Kids := Σ` linked children's latest-revision live component Totals (post-§5b). If no live funding line: insert one at `Remaining + Kids`. If the only live line is the migration's own (`CreatedBy = @Who`) and `Σ funding ≠ Remaining + Kids`: set it, printed with old/new. Then `Total := Σ funding`; per-year `Amount` **left as stored** (it *is* Remaining) — the old `Amount := Total − Kids` derivation becomes an assertion. Six parents therefore move from ₱0 to their real allocation (`P00830018LS`: 0 → 8,018,736,757.37 ± the dedupe outcome) |
| 8 verification | Adds `ParentsHoldingANonLSComponent`, `NotedChildrenUnlinked`, `LinkedChildrenWithDuplicateComponents` (all 0); per-year table 2023 → 57, 2024 → 59, 2025 → 4; `vLumpSumSet` **123**; `vLumpSumChildSet` **18 + 2,027 + 2,010 = 4,055**; per-parent `ItemizedTotal` vs the source Σ children cost printed side by side |

**Harness `LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql`** (D7): `BEGIN TRAN`; under an existing 2024 program inject `P00899901LS` (`'NULL'`, one `CW1` component, year-1 amount 123,000,000 + UACS, no funding), `P00899902LS` (`'LS'`, `Lump Sum` component + stray `CW1` 5,000,000), and `P00899903LZ` (a child: two identical `CW1` copies of 40,000,000, a funding line, a note `'Itemized from Project: P00899901LS'` on its revision); `:r` the migration; assert both parents listed, `P00899901LS` allocation 163,000,000 / remaining 123,000,000 / itemized 40,000,000 / one child with one live component, `P00899902LS` 5,000,000 + LS, invariant OK, all three new counters 0; `ROLLBACK`. Run before the real Phase C.

---

## Phase D — documentation

- `documents/docs/engineering/MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md`: source profile, the two reference defects with evidence (including the doubled 2024 children), how itemization is recorded in the old model and the allocation identity, before/after per group, runtime.
- `MYPS_LEGACY_LS_MIGRATION_2026-09-14.md`: "Revision 2" — scope, `CW → LS`, children, D12's correction of the six ₱0 parents and of the 2026-09-14 statement that "there are no children" (there were none *in the columns searched*; the link was in `history`), harness result, 62 → 123 / 18 → 4,055.
- Both runbook copies: Step 3b = group load + notes back-fill (backend repo, pixi python, backup, one group at a time, rollback script); Step 3c = the Lump Sum migration.
- `FE/src/pages/LumpSum/LumpSum.md`: migrated-data paragraph — 123 parents, 4,037 migrated children, parents' remaining vs allocation, the four converted from `CW`.
- `documents/MYPS_LS_MY_Prefixed_Projects.md`: add the pre-2023 `'From MY…LS'` notes as a pointer for the future module.
- `documents/plans/legacy-ls-migration-2023-2025.md`: this plan with a Completion Log.
- Recorded, not repaired: the remaining ~174k duplicated component pairs on `dev_200` outside the linked children.

---

## Files touched

**Backend repo** (`02_refactored/myps-gis-backend`)
```
mod   app/data_migration/queries.py          A1, A3
mod   app/data_migration/migration.py        A2, A3
new   app/data_migration/steps_for_2023_2025_groups.py
new   app/data_migration/migration_sql/rollback_program_group.sql
new   app/data_migration/test_sql/verify_component_grain.py
new   app/data_migration/test_sql/verify_itemization_notes.py
mod   tests/unit/… (to_target test)
```
**This repo**
```
mod   documents/python_migration/scripts/{migration,queries}.py  (+ new files mirrored)
new   documents/python_migration/docs/2026-09-14_component_grain_target_columns_and_notes.md
mod   Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
new   Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql
new   documents/docs/engineering/MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md
mod   documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md
mod   documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md
mod   Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md
mod   FE/src/pages/LumpSum/LumpSum.md
mod   documents/MYPS_LS_MY_Prefixed_Projects.md
new   documents/plans/legacy-ls-migration-2023-2025.md
```
No C#, no views, no schema change on `dev_200`.

---

## Verification

1. **A1 in isolation**: the fixed query for `P_CO-PS-635_12222023_143205` against `MYPS_BAK` + `dev_200`'s revisions yields **one** `CW1` row for `P00201118LZ` with `Total 2,673,766,590` (today: 9).
2. **Harness** passes before the real Phase C run.
3. **Per group after load**: grain 0 duplicates and Σ Total = Σ source; keys 0 orphans; SampleData §6 all 0; project counts per stage equal the source; notes count equals the source's for that program.
4. **Phase C real run**: scope prints 57 + 4 new + 22 re-admitted 2024 parents; 4 conversions from `CW1`; children linked 2,010 + 2,027, unresolved 1; `vLumpSumSet` **123**, `vLumpSumChildSet` **4,055**; invariant OK on 123; `ItemizedTotal` per parent equals `MYPS_BAK`'s Σ children (2023 CSSP 11,088,862,893.24; 2024 SSP 8,696,942,250.33; `P00830001LS` 32,972,842.18 — no longer doubled); Σ `OriginalAllocation` of the 2025 four = 800,000,000; second run → 0 in scope.
5. **API/UI** (scratch build on 5016, connection string verified): `/lumpsum` lists 2023/2024/2025; `P00730052LS` shows remaining 9,826,178,558.32, itemized 10,429,053,146.08, 446 children in `ShowItemizedProjects`; `P00900001LS` allocation 500,000,000 with one `Lump Sum` component; `UpdateLumpSum` echo → 200; `DeleteItemizedProject` on one migrated child restores its cost to the parent (then re-verify or restore backup); `ls-contract`, `ls-list-tolerance`, `ls-module-ui-walkthrough.narrated` on 5016/8090.
6. Commit at each phase boundary; backend commits never mix in its pre-existing hunks beyond A0.

---

## Risks

| Risk | Mitigation |
|---|---|
| ~2.2M rows through pandas/pymssql; per-table-per-stage commits | Background run, smallest group first, backup, rollback script per group |
| Stamping 4,037 civil-works projects `ProjectType 'LS'` (D11) | Exactly what `ImportItemizedProjects` writes; no reader keys on it except `vLumpSumSet`'s parent seek, which also requires `ParentProjectId IS NULL`; reversible by the note link |
| D12 raises 22 existing funding lines | Only the migration's own line (`CreatedBy = @Who`) is changed, old/new printed; the invariant is unsatisfiable otherwise |
| Duplicate retirement on children touches ~2,237 component rows | Identical-copy rule only, soft delete, printed per child; the remaining ~174k pairs elsewhere are untouched and recorded |
| `ProjectType 'NULL'` keeps arriving from the reference | Unchanged by design; Phase C flips what it owns |
| Backend repo pending edits | A0 baseline commit or explicit acceptance |
| `.env` names `192.168.50.200` for `MYPS_DB` | The entrypoint never reads the target host from `.env` and refuses non-local hosts |

---

## Completion Log

Implemented 2026-09-14 on `feat/legacy-ls-migration` (this repo) and
`feat/data-migration-2023-2025-groups` (`02_refactored/myps-gis-backend`). Localhost only throughout.
Backups: `myps_db_dev_200_pre_2023_2025_load_20260914.bak` before Phase B,
`myps_db_dev_200_pre_phaseC_20260914.bak` before Phase C.

**Phase A — the reference pipeline.** Baselined the maintainer's working tree (three files; the
staged `migration_old.py` left as found after one commit swept it in and was redone). Fixed the
component-grain defect in `build_project_component_cost_sql` (`GROUP BY` + `SUM`, 176,316
duplicated pairs on `dev_200` traced to it) and mapped the target's `DataImportId` columns on
writes (`to_target`) and reads (`target_column_name`). Added `build_project_notes_sql` /
`migrate_project_notes` / `migrate_notes_for_programs` for the `dbo.history` itemization rows, a
program-cost overflow fallback to Σ cost stream (one source row, ₱300,585,464,920,206 — the
maintainer's call), the `steps_for_2023_2025_groups.py` entrypoint with its localhost guard and
already-loaded refusal, `rollback_program_group.sql`, two verifiers and 27 unit tests. Files
mirrored to `documents/python_migration/scripts/` (not the `.env`) — then removed again the same day at the
maintainer's instruction; refer to the backend repo only.

**Phase B — the load.** 2023 LP, 2023 OO-1, 2023 CSSP, 2025 OO-1 — 29,786 projects, 102,989
revisions, 161,756 components at one row each (verified), 4,132 notes including the 2,059
back-filled onto the 2024 groups; 4,037 itemization links, all resolving, one source gap
(`P00851066VS`). Two false starts, both rolled back: the read-side column name, and a `nohup`
load killed with the shell — which exposed and fixed the rollback script's `ComponentCostFK = 0`
blind spot (33 pre-existing orphan work items from the server load recorded, not touched).
Write-up: `documents/docs/engineering/MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md`.

**Phase C — the migration, Revision 2.** Wrote §5b (children), rewrote §7 (allocation =
`Remaining + Σ children`, stored balance never written), extended §1/§2/§3/§8, and the harness
(`LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql`, PASS 8 of 8). Harness → dry run → real run:
**83 in scope** (61 R1 / 4 R2 / 52 R3 / 0 R4), 4 `CW → LS` conversions, **4,037 children linked**,
**2,237 duplicate child components** retired (all 2024), 60 funding lines added, 23 raised (the
first run's 22 + `P00700002LS`), every counter 0, `vLumpSumSet` **123**, `vLumpSumChildSet`
**4,055**, invariant OK on all 123, second run 0 in scope. One Sub-Category fallback flagged
(`P00730052LS`). Committed `585904f4`. Run log: `MYPS_LEGACY_LS_MIGRATION_2026-09-14.md` §9.

**Phase D — documentation.** Group-load write-up (new), Revision 2 run log in the legacy LS
write-up, runbook Steps 3b/3c in both copies, `FE/src/pages/LumpSum/LumpSum.md` migrated-data
paragraph, `documents/python_migration/docs/2026-09-14_component_grain_target_columns_and_notes.md`,
this log. The planned pointer from the `MY…LS` inventory to "pre-2023 `From MY…LS` notes" was
dropped: `MYPS_BAK.dbo.history` holds **no** row mentioning a `MY…LS` id (`LIKE '%MY0%LS%'` → 0),
so there is nothing to point at — the 16 MY-referencing projects carry the id in `AlternateId` only.

**Departures from the plan.** 2024's `ItemizedTotal` is 8,844,442,250.33, not the 8,864,442,250.33
the plan wrote (a transcription slip; the per-parent figures were verified against `MYPS_BAK`).
The 2025 per-year row in `vLumpSumSet` shows 7 parents / 18 children because the MyMYPS sample's
three parents live under a 2025 program; the four migrated ones have no children. §7 also raises a
line the *loader* wrote on a revision it imported (`RevisionImported`), not only this script's —
`P00700002LS` was the case that needed it.

**UI/API pass (2026-09-14, scratch build on 5016 / Vite 8090, `myps_db_dev_200`).** `ls-contract`,
`ls-list-tolerance` and `ls-module-ui-walkthrough.narrated`: **44 passed**. API: `LumpSumDetails`
for `P00730052LS` reports 20,255,231,704.40 / 9,826,178,558.32 / 10,429,053,146.08 / 446 and
`ShowItemizedProjects` pages 446 children carrying `ParentProjectId`, `AlternateId` = parent,
`ProjectType 'LS'`, `ItemizationType 'Itemized'`; `P00900001LS` holds one `Lump Sum`/`LS`
component of 500,000,000 on `DPWH-GAA-2025`; `P00830018LS` 7,998,736,757.37 / 0 / 242. A faithful
`UpdateLumpSum` echo of `P00900001LS` and `P00730052LS` returns 200 and changes no figure (an echo
that omits a detail field is refused by name under the Approved-program guard, as designed). UI:
both detail pages render the three figures, the Approved banner and the one component; the list
finds `P00830018LS` by description at "₱7,998,736,757.37 / ₱0 remaining / 242". The lock banner is
deliberately suppressed while the program is Approved (`LumpSumForm.tsx`), so none shows on these
parents. The ~174,000 duplicated component pairs outside the linked children remain on `dev_200`,
recorded in the group-load write-up §3.1.
