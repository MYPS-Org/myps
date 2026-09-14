# Plan: bring the legacy Lump Sum projects (2023 onwards) onto the Lump Sum data model

Status: **Implemented** (2026-09-14) — see the Completion Log
Created: 2026-09-14, revised the same day when the request widened from the 59 parents of 2024 to 2023 onwards
Source: profiling of `localhost/myps_db_dev_200` and `localhost/MYPS_BAK`; the maintainer's addenda (exclude `MY…LS` ids; 2023 onwards only; use the python reference pipeline; `vw_notes` records itemization; non-BP-first groups are valid; load every 2023 program group)
Branches: `feat/legacy-ls-migration` (this repo) · `feat/data-migration-2023-2025-groups` (`02_refactored/myps-gis-backend`)
Databases: source `localhost/MYPS_BAK` → target `localhost/myps_db_dev_200`. **Localhost only.** The SQL migration is server-bound; the loader refuses any host that is not this machine.
Write-ups: `documents/docs/engineering/MYPS_BAK_PROGRAM_GROUP_LOAD.md` (the load), `documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION.md` (the migration)

---

## Goal

`myps_db_dev_200` has the Lump Sum v3 schema (bring-up of 2026-09-13) and no data on it beyond the MyMYPS sample. The old system's Lump Sum projects — `ProjectPK` ending in `LS` under Approved GAA-R programs — and the projects itemized from them must become visible to the `/lumpsum` module and report correctly: one `Lump Sum` component holding the allocation, a funding line, a valid Sub-Category, children linked to their parent, and the invariant

```
OriginalAllocation (component Total = Σ funding) = Remaining (stored per-year Amount) + Σ children's costs
```

holding on every parent. Scope is 2023 onwards. The 2024 parents are on the target from the server restore; the 2023 and 2025 groups exist only in `MYPS_BAK` and must be loaded first, whole program groups, through the reference python pipeline.

## Acceptance criteria

- [x] Every 2023 program group in `MYPS_BAK` and the 2025 OO-1 group are on `dev_200`, one component row per (revision, component), Total = source Σ cost, project counts per stage equal to the source.
- [x] The old system's itemization notes are on the target (`tProjectNotes`) for every loaded group and back-filled for the 2024 groups.
- [x] Every Lump Sum parent of 2023–2025 is typed `LS`, holds exactly one `Lump Sum` component, one live per-year row with dates, a funding line at `Remaining + Σ children`, and a valid Sub-Category.
- [x] Every itemized child named by a note is linked and stamped as `ImportItemizedProjects` stamps a child; the 2024 children's duplicate components are retired first.
- [x] `vLumpSumSet` = 123, `vLumpSumChildSet` = 4,055, invariant OK on all 123, every verification counter 0, second run 0 in scope.
- [x] `MY…LS` identifiers untouched and inventoried.
- [x] The migrated data survives the API and UI: list, details, a faithful `UpdateLumpSum` echo, the three Lump Sum Playwright suites.
- [x] Runbook Steps 3b / 3c in both copies; engineering write-ups; this log.

## Context — the data, verified 2026-09-14

| Year | Groups (stages) | LS parents | Latest-stage components | Itemized children (from `dbo.history`) |
|---|---|---|---|---|
| 2023 | CSSP, LP, OO-1, OO-2 — BP → NEP → HGAB → GAA → GAA-R; plus 28 single-stage programs (19 RBP, DA FMR, DepEd BEFF, FAPs, SRA, STO, Unprogrammed, Augmentation, Trust Funds, RDIP) | **57** (CSSP 34 / LP 20 / OO-1 3) | `LS` only | **2,010** — CSSP 2,001 under 26, LP 1 under 1, OO-1 8 under 3 |
| 2024 | SSP, LP, OO-1 — on `dev_200` already | 59 | `LS` only, **53 with an identical duplicate** | **2,028** — SSP 2,024 under 19, OO-1 3 under 2, LP 1 under 1; 2,027 already on `dev_200`, none linked |
| 2025 | OO-1 — BP → NEP → NEP-E → GAA → GAA-R | **4** (`P00900001LS`–`04LS`, first appear at GAA) | **`CW:CW1` only** — the "component not of LS type" case | none |

- **Itemization is recorded in `dbo.history`**, as `'Itemized from Project: <parent>'` on the **child's** row in the GAA-R program — not in `alternate_id` (0 of 42,589). Children exist only at GAA-R. One 2024 child (`P00851066VS`) has a note and no `project` row.
- **Itemization reduced the parent's stored cost**, so the GAA-R LS figure is the **remaining balance**, not the allocation (`P00730052LS`: 11,000,000,000 at GAA, 9,826,178,558.32 at GAA-R, 446 children costing 10,429,053,146.08). The six ₱0 parents of 2024 are fully itemized, not unfunded.
- **`ComponentType` stores the code** (`LS`, `CW`) where every Lump Sum reader joins on the name; **`ProjectType` is the string `'NULL'`**; the empty per-year rows hold `''` UACS, not `NULL`. All three are the loader's signature and lineage-wide.
- **Two defects in the reference pipeline** would be inherited: one component row per distinct yearly cost shape (176,316 duplicated pairs on `dev_200`; the 2024 children's costs exactly doubled), and provenance column names the app's schema does not have.

## Decisions

| # | Decision |
|---|---|
| D1 | Target `myps_db_dev_200`; localhost only; the loader's source and target are constants and it refuses any host not loopback or this machine |
| D2 | **Whole program groups**, all stages, through the reference pipeline in the backend repo — which is the only home of the scripts (a mirror into this repo was made and removed the same day) |
| D3 | The component-grain fix in the reference is **required** before loading; the target's `DataImportId` columns are mapped at write and read time, no schema change |
| D4 | Itemization links travel as **`tProjectNotes`** rows written by the loader from `dbo.history` (`'Itemized from Project:'`, `'Cost reduced due to itemization'`), so the SQL migration reads the link from the target and stays server-portable; the 2024 groups get the same notes back-filled |
| D5 | A program whose stored cost overflows `tProgramRevisions.Cost` gets `SUM(projectcoststream.cost)` instead, logged (one source row; the app recomputes the column on the same basis) |
| D6 | Every 2023 program group is loaded, single-stage programs as their own group keyed like the 2024 server load's; a group with no projects gets program rows only; the default run skips groups already on the target |
| D7 | Nine empty per-year rows per component are soft-deleted; the program-start-year row survives, with dates filled |
| D8 | All parents are migrated, including the six with `Total = 0` |
| D9 | Sub-Category: keyword rules against the description within the allowed, in-window PAPKeys; no match → lowest allowed PAPKey as a printed placeholder for a person to correct |
| D10 | Non-LS → LS: survivor = the LS component if any, else the lowest Id; identical copies retired; a differing copy reported and skipped; any other live component folded into the survivor; the survivor converted to `Lump Sum` / `LS` |
| D11 | Children stamped as `ImportItemizedProjects` stamps them: `ParentProjectId`, `ProjectType 'LS'`, `ItemizationType 'Itemized'`, `ProjectStatus`, revision `AlternateId` = parent's `ProjectId` (rule 2026-09-05), `IsWalletDraw = 1` on their funding lines; their duplicate components retired first |
| D12 | **Allocation = Remaining + Σ children.** The stored per-year Amount is kept as Remaining and never written; the funding line and component Total are set to `Remaining + Σ children`. Only a line the migration itself wrote (or the loader imported) is raised; a person's line is left and shows as DRIFT |
| D13 | Already-migrated parents are re-admitted when not typed, holding a non-LS component, named by a note whose child is unlinked, or out of balance — so the script repairs a database that received its first version |
| D14 | Server-bound script: refuses `myps_db` with `NOEXEC`, idempotent, `XACT_ABORT`, `@DryRun`, proof by a rolled-back fixture harness, backup in the runbook |

## Approach

### Phase A — the reference pipeline (backend repo, `app/data_migration/`)

Baseline the maintainer's working tree; fix the component grain (`GROUP BY` + `SUM`); add `TARGET_COLUMN_MAP` / `to_target()` / `target_column_name()`; add `build_project_notes_sql` and `migrate_notes_for_programs`; the overflow fallback; the entrypoint `steps_for_2023_2025_groups.py` with inline group config, localhost guard, skip-if-loaded default, `--group`, `--list`, `--notes-only`; `rollback_program_group.sql`; `verify_component_grain.py` and `verify_itemization_notes.py`, both deriving their group lists from the entrypoint; unit tests for the pure helpers.

### Phase B — the load (`dev_200`)

Backup; before-figures; load smallest first (2023 LP as the smoke test), then the rest; after each group the two verifiers and per-stage counts against the source; failure → rollback script, fix, re-run that group; `--notes-only` for the 2024 GAA-R programs. Repeat for the remaining 2023 groups once the request widens.

### Phase C — `LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`, Revision 2

Scope by reason (R1 not typed, R2 non-LS component, R3 unlinked noted children, R4 drift); lookups refused if missing; components consolidated, folded and converted; per-year rows retired to one, blanks normalised, dates filled; identity; **§5b children** from `tProjectNotes`; Sub-Category rules; **§7 allocation = Remaining + Σ children**, balance never written; verification with the five new counters; harness first, dry run, real run.

### Phase D — documentation

Runbook Steps 3b (load) and 3c (migration) in both copies; the two engineering write-ups; the migrated-data paragraph in `FE/src/pages/LumpSum/LumpSum.md`; the `MY…LS` inventory; this plan's Completion Log.

## Files touched

**Backend repo** (`02_refactored/myps-gis-backend`, branch `feat/data-migration-2023-2025-groups`)
```
mod   app/data_migration/queries.py, migration.py
new   app/data_migration/steps_for_2023_2025_groups.py
new   app/data_migration/migration_sql/rollback_program_group.sql
new   app/data_migration/test_sql/verify_component_grain.py, verify_itemization_notes.py
new   tests/unit/… (to_target and key-resolution tests)
```
**This repo**
```
new   Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
new   Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql
new   documents/docs/engineering/MYPS_BAK_PROGRAM_GROUP_LOAD.md
new   documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION.md
mod   documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md, Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md
mod   FE/src/pages/LumpSum/LumpSum.md
new   documents/plans/legacy-ls-migration.md
```
No C#, no views, no schema change on `dev_200`.

## Verification

1. Loader: per group, `verify_component_grain` 0 duplicates and Σ Total = Σ source; per-stage project counts equal to the source; `verify_itemization_notes` counts equal to the source.
2. Harness PASS before the real Phase C run; dry run read (scope by reason, CONVERTING table, Sub-Category picks).
3. Real run: `vLumpSumSet` 123, `vLumpSumChildSet` 4,055, invariant OK on 123, every counter 0, per-parent `ItemizedTotal` equal to `MYPS_BAK`'s Σ children, second run 0 in scope.
4. API / UI on a scratch build (5016 / 8090, connection string verified): `/lumpsum` lists 2023 / 2024 / 2025; `P00730052LS` and `P00900001LS` details; `UpdateLumpSum` echo → 200; `ls-contract`, `ls-list-tolerance`, `ls-module-ui-walkthrough.narrated`.
5. Commit at each phase boundary; backend commits with explicit pathspecs so the maintainer's staged files stay as found.

## Risks

| Risk | Mitigation |
|---|---|
| ~2M rows through pandas / pymssql with per-table-per-stage commits | Smallest group first, backup, rollback script per group, detached background run with a log |
| The "identical duplicate" assertion fails on the server copy | A differing pair is reported and skipped and surfaces as DRIFT, never averaged |
| Keyword Sub-Category wrong for some descriptions | Every pick printed and recorded; editable once a program is set back to Working; leaving `Thrust = 0` makes the project unusable invisibly |
| Stamping 4,037 civil-works projects `ProjectType 'LS'` | Exactly what `ImportItemizedProjects` writes; no reader keys on it except the parent seek, which also requires `ParentProjectId IS NULL` |
| D12 raises 22 existing funding lines | Only the migration's own line, old / new printed; the invariant is unsatisfiable otherwise |
| `ProjectType 'NULL'` and code-valued `ComponentType` keep arriving from the reference | By design; the migration flips only what it owns |
| `.env` names `192.168.50.200` for `MYPS_DB` | The loader never reads the target host from `.env` and refuses non-local hosts |

---

## Completion Log

Implemented 2026-09-14 on `feat/legacy-ls-migration` (this repo) and `feat/data-migration-2023-2025-groups` (backend). Localhost only throughout. Backups: `…pre_legacyls`, `…pre_2023_2025_load`, `…pre_phaseC`, `…pre_2023_full_load`, all `20260914`.

**First migration run (morning, 2024 only).** Before the load existed, the script was written for the 59 parents already on the target and run: 53 duplicate components retired, 531 empty per-year rows retired, 59 typed, 55 Sub-Categories set, 59 funding lines added, every counter 0, `vLumpSumSet` 62. Its load-bearing finding — "there are no children" — was wrong: the link is in `dbo.history`, which the search did not cover, so 22 parents' lines were written at the remaining balance and three green checks were vacuous. Nothing destructive; the stored balance was never wrong. The lesson is recorded in the migration write-up §5, and the plan was revised into this one.

**Phase A.** Baselined the maintainer's working tree (three files; the staged `migration_old.py` left as found after one commit swept it in and was redone). Fixed the component grain, mapped the target's columns on writes and reads, added the notes loader, the overflow fallback, the entrypoint with its localhost guard, the rollback script, the two verifiers and 27 unit tests. In the afternoon: every 2023 group inline (33 groups), skip-if-loaded default, empty-program guard, `--list`, and `OPTION (HASH JOIN)` on the per-year cost query after a 147-project program spun for an hour on a nested-loop plan.

**Phase B.** Morning: 2023 LP, 2023 OO-1, 2023 CSSP, 2025 OO-1 — 29,786 projects, 102,989 revisions, 161,756 components at one row each, 4,132 notes including 2,059 back-filled onto the 2024 groups, 4,037 links resolving, one source gap. Two false starts rolled back (a read-side column name; a `nohup` load killed with its shell, which exposed the rollback script's `ComponentCostFK = 0` blind spot). Afternoon: the remaining 29 groups of 2023 — 28,763 projects, 37,032 revisions, 49,164 components, 491,345 per-year rows — in 7 minutes once the RDIP stall was fixed and rolled back. All 48 source programs of 2023 match the target on projects, revisions and stages; both verifiers green over 33 groups.

**Phase C.** Revision 2 written (§5b children, §7 allocation reversed, §1 / §2 / §3 / §8 extended) and proven by the harness (PASS 8 of 8), dry-run, then run at 11:59: **83 in scope** (61 R1 / 4 R2 / 52 R3 / 0 R4), 4 `CW → LS` conversions, **4,037 children linked**, 2,237 duplicate child components retired (all 2024), 60 funding lines added, 23 raised, every counter 0, `vLumpSumSet` **123**, `vLumpSumChildSet` **4,055**, invariant OK on 123, second run 0 in scope. Two Sub-Category placeholders left for a person (`P00830018LS`, `P00730052LS`). Committed `585904f4`.

**UI / API pass** (scratch build on 5016 / Vite 8090 against `myps_db_dev_200`): `ls-contract`, `ls-list-tolerance`, `ls-module-ui-walkthrough.narrated` — **44 passed**. `LumpSumDetails` for `P00730052LS` 20,255,231,704.40 / 9,826,178,558.32 / 10,429,053,146.08 / 446 children stamped as Import stamps them; `P00900001LS` one `Lump Sum` component of 500,000,000; `P00830018LS` 7,998,736,757.37 / 0 / 242; faithful `UpdateLumpSum` echoes → 200 with no figure changed; both detail pages render the figures, the Approved banner and the one component.

**Phase D.** Nine documents written across the day were condensed into three on 2026-09-15: this plan, `MYPS_BAK_PROGRAM_GROUP_LOAD.md` and `MYPS_LEGACY_LS_MIGRATION.md` (with the `MY…LS` inventory as its appendix). The two backend-history notes that had been mirrored into `documents/python_migration/docs/` were removed; they live with the code in the backend repo's `documents/` folder. Runbook Steps 3b / 3c updated in both copies; `FE/src/pages/LumpSum/LumpSum.md` carries the migrated-data paragraph.

**Departures from the plan.** 2024's `ItemizedTotal` is 8,844,442,250.33, not the 8,864,442,250.33 first written (a transcription slip). The 2025 per-year row shows 7 parents / 18 children because the MyMYPS sample's three parents live under a 2025 program. §7 also raises a line the *loader* wrote on a revision it imported, not only this script's (`P00700002LS` needed it). The planned pointer from the `MY…LS` inventory to pre-2023 `'From MY…LS'` notes was dropped: `MYPS_BAK.dbo.history` holds no row mentioning a `MY…LS` id.

**Left open, deliberately.** `ProjectType = 'NULL'` on ~56,700 other projects and `ComponentType` as a code on ~353,000 other rows (their own decisions); ~174,000 duplicated component pairs outside the linked children (recorded); the older live revisions' shape (no view reads them); bring-up review finding #3 (the 2026-09-10 migration's guard fails open for a non-sysadmin login — this script demonstrates the `NOEXEC` fix); the RDIP training program loaded because it is on the 2023 list (one rollback command removes it).
