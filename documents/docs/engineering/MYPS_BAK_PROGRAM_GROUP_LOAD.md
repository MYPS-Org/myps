# Loading program groups from `MYPS_BAK` into `myps_db_dev_200`

**Dates:** 2026-09-14 (morning: four groups; afternoon: the remaining 29 groups of 2023)
**Source:** `localhost` / `MYPS_BAK` — the old data model (`dbo.program`, `dbo.project`, `dbo.projectcoststream`, `dbo.history`, …)
**Target:** `localhost` / `myps_db_dev_200` — the application's database
**Pipeline:** the reference python migration in the backend repo, `C:\Users\User\Eptisa\git_wsl\02_refactored\myps-gis-backend\app\data_migration`, branch `feat/data-migration-2023-2025-groups`, through the entrypoint `steps_for_2023_2025_groups.py`. That repo is the only home of the scripts; this repo keeps write-ups only.
**Backups:** `myps_db_dev_200_pre_2023_2025_load_20260914.bak` (before the morning load), `myps_db_dev_200_pre_2023_full_load_20260914.bak` (before the afternoon load)
**Result:** 33 program groups on the target — every program in `MYPS_BAK` with `yearstart = 2023` and the 2025 OO-1 group — 58,549 projects, 140,021 revisions, 210,920 components at one row each, 2,107,524 per-year rows, and 4,132 itemization notes. Every verifier green.

---

## 1. Why

`myps_db_dev_200` was restored on 2026-09-10 from the 192.168.50.200 server and carried the **2024** program groups only. The Lump Sum projects the maintainer asked about — ids ending in `LS`, some holding a component "not of LS type" — are in the **2023** and **2025** groups, which the restore never received. They live in `MYPS_BAK`, the backup of the old system, in the old data model.

The instruction was to bring them across with the reference pipeline rather than a new script, whole program groups rather than the Lump Sum rows alone, 2023 onwards only, localhost only. The morning load brought the three 2023 groups that hold Lump Sum parents and the 2025 OO-1 group. The afternoon instruction extended it to **the entire list of 2023 programs** in `MYPS_BAK.dbo.program`, grouped by

```sql
SELECT prg.programid, prg.name, prg.stage_id, prg.parent_program_category, cat.name
FROM MYPS_BAK.dbo.program prg
LEFT JOIN MYPS_BAK.dbo.category cat ON prg.parent_program_category = cat.categoryid
WHERE yearstart = 2023
```

`MyMYPS` is dummy data and was ignored throughout.

The reference is the pipeline that produced `dev_200`'s 2024 data in the first place. Its signature is on every row it writes: `ProgramPK = MP_<first-stage programid>`, `ProjectPK = ProgramPK_<projectid at first appearance>`, the literal string `'NULL'` in `ProjectType`, and the component-type **code** where the application expects the name. This load keeps that signature; the Lump Sum migration (`MYPS_LEGACY_LS_MIGRATION.md`) flips only what it owns.

## 2. How the source groups

The 2023 query returns 48 programs. With 2025 OO-1 they make 33 groups:

| Grouping | Groups | Stages | Note |
|---|---:|---|---|
| Category 16 OO-1, 17 OO-2, 18 CSSP, 19 LP (2023) | 4 | BP → NEP → HGAB → GAA → GAA-R | Annual groups, five stages each |
| 2025 OO-1 | 1 | BP → NEP → NEP-E → GAA → GAA-R | The four Lump Sum parents first appear at GAA |
| Category 5 FAPs, 7 DA FMR, 8 DepEd BEFF, 13 SRA (2023) | 4 | GAA-R only | One program each |
| Category 12 Trust Funds 2023 | 1 | TF-R only | |
| No category: STO Funds, Unprogrammed Appropriations, GAA 2023 Augmentation | 3 | GAA-R only | |
| No category: RDIP FY 2023-2028 Region VI Training | 1 | RDIP only | Created from host `P_TEST-W10PRO-03`; training data, loaded because it is on the list (§7) |
| Category 0: RBP FY 2023 *region* | 19 | RBP only | One per region, three of them BARMM; Region XII BARMM has no projects |

A single-stage program is its own group, keyed `MP_<its own programid>` with one revision and one stage — exactly how the 2024 server load keyed `RBP FY 2024 <region>`, `STO Funds 2024`, `Trust Funds 2024` and `GAA 2024 DA FMR`, so the new rows sit beside their 2024 counterparts in the same shape. The target's `tOptionProgramStage` already carries RBP (8), RDIP (9) and TF-R (13); nothing was added to it.

A group's first stage is whichever stage it actually starts at. `build_first_stage_tracking` applies its BP id-swap only when the first stage is BP, and `split_new_projects` keys a project first seen at a later stage by that stage's id — which is why every itemized child (they exist only at GAA-R) and the four 2025 parents (first seen at GAA) carry that stage's id in their key. That is the reference's contract, not a gap.

The grouping is written into `PROGRAM_GROUPS` in the entrypoint with the SQL above quoted beside it. A start-up cross-check confirmed the 48 configured 2023 stage ids equal the 48 source ids, nothing missing and nothing extra.

## 3. What changed in the reference pipeline

Six changes, all in the backend repo, all committed on `feat/data-migration-2023-2025-groups` on top of a baseline commit of the maintainer's working tree.

### 3.1 One component row per (revision, component) — a defect, fixed before loading

`queries.build_project_component_cost_sql` selected the per-year columns (`cost`, `start_date`, `end_date`, `date_of_approval`) alongside a correlated `SUM` over all years and relied on `SELECT DISTINCT` to collapse them. DISTINCT cannot collapse rows that differ, so a component with *N* distinct (cost, dates) shapes became *N* component rows, each carrying the whole Total — and the per-year query then joined its rows to every copy.

Evidence, on `dev_200` as loaded by that form: **176,316** (revision, component) pairs with more than one live row, up to 27 copies, every copy with the same Total. `P00201118LZ`'s `CW1` in HGAB 2024 OO-1: 10 cost-stream rows, 9 distinct shapes, **9 component rows** of ₱2,673,766,590 each. The 53 duplicate Lump Sum components the migration retired on its first run were this; the itemized children of the 2024 parents carry exactly two copies each, which would double their parents' `ItemizedTotal` the moment they were linked.

Fix: `GROUP BY` at component grain, `Total = SUM(cost)`, per-year columns dropped from the query (they belong to the per-year loader). Verified on the 27-copy case: one row. The ~174,000 duplicated pairs outside the linked children remain on `dev_200` from the server load, recorded and untouched.

### 3.2 The target's column names — mapped, not renamed

The reference writes provenance as `DataImportProgramId` / `DataImportProjectId` / `DataImportComponentId`, the shape of `myps_db_migrated`, which its own `data_import_ids.sql` adds by hand. The application's database has a single `DataImportId` on the program, project, revision, stage and funding tables and the full triple on the component, per-year and work tables. The reference's answer for `myps_db_migrated` is `import_id_rename.sql`; on the app's EF-mapped schema a rename would break the model.

Fix: `TARGET_COLUMN_MAP` in `queries.py` (one definition), applied by `migration.to_target()` before every write and by `queries.target_column_name()` on the one read that names the column (`build_project_stages_sql` stamps the stage rows from the revision's provenance). The read half was missing at first and cost one run.

### 3.3 Itemization notes travel

The old model records an itemization as a `dbo.history` row against the **child**, in the GAA-R program only: `'Itemized from Project: <parent>'`. `alternate_id` does not carry it — of 42,589 such notes in `MYPS_BAK`, not one has the child's `alternate_id` equal to the parent it names. `build_project_notes_sql` copies those rows, and the parent-side `'Cost reduced due to itemization…'` ones, into `tProjectNotes` on the child's revision at every stage, with a `NOT EXISTS` guard so it repeats safely. `migrate_notes_for_programs` back-fills programs already loaded; it was run once for the three 2024 GAA-R programs (2,059 notes). This is how the parent/child link — recorded nowhere else in the old model — reaches the target, and the Lump Sum migration reads it from there.

### 3.4 A program-cost overflow fallback

`GAA 2023 CSSP as Approved` stores `program.cost = 300,585,464,920,206` — 772× its own cost stream (₱389,179,466,579) and 1,900× its sibling stages — and overflows `tProgramRevisions.Cost decimal(18,5)`. It is the only such row in `MYPS_BAK`. By the maintainer's decision, a program whose stored cost reaches the column ceiling gets `SUM(projectcoststream.cost)` instead: derived from its own rows, and the same basis `pRecomputeProgramCost` uses when the app recomputes this column, which it does. The substitution is logged with both figures; it fired exactly once.

### 3.5 A hash-join hint on the per-year cost query

`build_project_component_cost_per_year_sql` joins the source rows to `tProjectComponentCost` on `ProjectRevisionFK` and `ComponentId`. For a tiny program the optimizer estimated 28,641 rows and chose nested loops through the `ComponentId` index, so every source row matched every `CW1` component on the target before the revision predicate applied. On the 147-project RDIP program `sys.dm_exec_query_profiles` showed that seek at **494 million rows** after an hour, 8,300 s of CPU, no blocking. The big programs never hit it because their estimates were large enough for a hash join. `OPTION (HASH JOIN)` makes the small ones finish in seconds and costs the large ones nothing.

### 3.6 The entrypoint, a rollback, two verifiers

- **`steps_for_2023_2025_groups.py`.** Inline group config (no Excel); source and target as constants with a guard that refuses any host not loopback or this machine (`.env` names `192.168.50.200` for `MYPS_DB` and is read for credentials only); `SQL_ECHO` off. A default run loads every group whose `ProgramPK` is not yet on the target and logs the ones it skips, so the same command brings a partial target up to the full list; `--group` refuses a loaded group. A group with no source projects (RBP FY 2023 Region XII BARMM) gets program, revision and stage rows only, with a warning. `--list` prints the plan; `--notes-only` runs the 2024 back-fill.
- **`migration_sql/rollback_program_group.sql`.** The reference commits per table per stage, so a mid-group failure leaves it half loaded and nothing else can undo that short of a restore. Deletes one `MP_…` group in dependency order, collecting work items by stage `DataImportProgramId` as well as by component (the loader stamps `ComponentCostFK = 0` on work items with no matching cost row); refuses an application-created key.
- **`test_sql/verify_component_grain.py`** — one live row per (revision, component) and Total = source Σ cost, for every group the entrypoint knows. Components the Lump Sum migration has taken over (`ComponentType = 'Lump Sum'`) are left out: their Total is re-derived as `Remaining + Σ children` on purpose.
- **`test_sql/verify_itemization_notes.py`** — notes on the target = notes in the source per program, every `'Itemized from Project'` link resolves, no duplicates.

Both verifiers derive their group lists from the entrypoint so the three cannot drift apart.

## 4. What was loaded

Per group, counted back from the target through `ProgramFK` after the runs. The RBP line sums the 19 regional groups.

| Group | Stages | Projects | Revisions | Components | Notes | Wall time |
|---|---|---:|---:|---:|---:|---|
| 2023 LP | 5 | 392 | 1,594 | 2,263 | 2 | 80 s |
| 2023 OO-1 | 5 | 5,506 | 24,833 | 38,272 | 12 | 5 min |
| 2023 CSSP | 5 | 17,441 | 51,577 | 81,939 | 2,059 | 9 min |
| 2025 OO-1 | 5 | 6,447 | 24,985 | 39,282 | 0 | 5 min |
| 2024 (notes back-fill only) | — | — | — | — | 2,059 | seconds |
| 2023 OO-2 | 5 | 3,166 | 11,435 | 16,719 | 0 | 2 min |
| GAA 2023 DepEd BEFF | 1 | 2,231 | 2,231 | 4,471 | 0 | 26 s |
| Unprogrammed Appropriations 2023 | 1 | 1,885 | 1,885 | 3,778 | 0 | 26 s |
| GAA 2023 DA FMR | 1 | 1,016 | 1,016 | 1,819 | 0 | 15 s |
| STO Funds 2023 | 1 | 210 | 210 | 204 | 0 | seconds |
| RDIP FY 2023-2028 Region VI Training | 1 | 147 | 147 | 147 | 0 | 7 s (after §5) |
| Trust Funds 2023 | 1 | 136 | 136 | 139 | 0 | seconds |
| GAA 2023 Augmentation | 1 | 61 | 61 | 103 | 0 | seconds |
| SRA 2023 Farm-to-Mill | 1 | 37 | 37 | 75 | 0 | seconds |
| GAA 2023 FAPs | 1 | 11 | 11 | 24 | 0 | seconds |
| RBP FY 2023, 19 regions | 1 each | 19,863 | 19,863 | 21,685 | 0 | ~15 s each |
| **All 33 groups** | | **58,549** | **140,021** | **210,920** | **4,132** | |

Group keys for the annual groups: `MP_P_CO-PS-535_09102022_074918` (2023 LP), `MP_P_CO-PS-282_08232022_121112` (2023 OO-1), `MP_P_CO-PS-291_08222022_145740` (2023 CSSP), `MP_P_CO-PS-535_09102022_075020` (2023 OO-2), `MP_P_CO-PS-800_07152024_143901` (2025 OO-1). `--list` prints the rest.

Database totals across the day. "After Lump Sum migration" is the state the afternoon load started from; that migration adds 60 funding lines and physically deletes nothing, so every other row count belongs to the loads. Each group's contribution was counted back through its `ProgramFK` and stage `DataImportId`, and the groups sum exactly to the difference on every table.

| Table | Before any load | After the morning load | After the afternoon load | Loaded in total |
|---|---:|---:|---:|---:|
| `tPrograms` | 40 | 44 | 73 | 33 |
| `tProgramRevisions` | 88 | 108 | 141 | 53 |
| `tProjects` | 56,811 | 86,597 | 115,360 | 58,549 |
| `tProjectRevisions` | 118,545 | 221,534 | 258,566 | 140,021 |
| `tProjectStages` | 118,545 | 221,534 | 258,566 | 140,021 |
| `tProjectFundingProfile` | 118,432 | 221,185 (+ 60 by the migration) | 257,777 | 139,285 |
| `tProjectComponentCost` | 353,430 | 515,186 | 564,350 | 210,920 |
| `tProjectComponentCostPerYear` | 3,532,002 | 5,148,181 | 5,639,526 | 2,107,524 |
| `tProjectMajorWorkItem` | 251,251 | 358,851 | 396,029 | 144,778 |
| `tProjectMajorWorkLocations` | 324,888 | 510,710 | 555,998 | 231,110 |
| `tProjectNotes` | 6 | 4,138 | 4,138 | 4,132 |

`tPrograms` with `StartYear = 2023`: 32, all `MP_`-keyed.

## 5. What went wrong on the way

- **First 2023 LP attempt** failed on the read-side column name (§3.2) after writing the program, its five revisions and 294 projects. The rollback script removed them cleanly.
- **`nohup … &` inside a backgrounded shell** was killed when the wrapper exited, leaving 2023 OO-1 loaded to two of five stages. Rolled back — and the rollback left **2 work items and 4 locations** behind, because the loader stamps `ComponentCostFK = 0` on work items with no matching cost row and the script reached work items only through their component. Fixed to collect by stage `DataImportProgramId` as well; the 6 rows were removed by id. The database also carries **33 other `ComponentCostFK = 0` work items and 57 orphan locations from the 2024 server load** — pre-existing, left alone.
- **The per-year query stalled for an hour** on the 147-project RDIP program (§3.5). Killed the session, rolled the partial group back (147 projects, 147 revisions, 147 components, 117 funding lines, no per-year rows), added the hint, reloaded it alone in 7 seconds; the remaining 23 groups then loaded in 7 minutes.
- **A pathspec-less commit** in the backend repo swept in the maintainer's already-staged `migration_old.py`. Reverted and redone with an explicit pathspec; that file is back to staged-and-uncommitted, as found.
- **A mirror of the scripts** into `documents/python_migration/scripts/` was made and removed the same day at the maintainer's instruction. The backend repo is the only copy.

## 6. Verification

- Per source stage, `dbo.project` count = target `tProjectRevisions` count = target `tProjectStages` count on **all 48** 2023 programs and the five 2025 OO-1 stages; source `projectcoststream` rows = target per-year rows on every group except the two morning stages in §7.
- `verify_component_grain --all-2023-2025`, 33 groups: **210,920 (revision, component) pairs, one live row each; every non-Lump-Sum Total equals the source Σ cost.**
- `verify_itemization_notes --all`: counts match on all six note-bearing programs, **4,037 links**, every one resolving to a loaded parent, 0 duplicates, 1 known source gap (`P00851066VS` has a note and no `dbo.project` row).

## 7. Things to know, none of them defects of this load

- **The RDIP program is training data.** Created from `P_TEST-W10PRO-03`, projects named `RVI_Training1…`, ids `MY007…`. It is on the 2023 list, so it was loaded; it is one group, `MP_P_TEST-W10PRO-03_10242022_123507`, and the rollback script removes it in seconds if it should not be there.
- **Ten per-year rows short on two morning stages.** `BP 2023 CSSP` has 68,170 cost-stream rows and 68,160 per-year rows; `GAA 2023 CSSP as Approved` 294,720 and 294,710. In each case the 10 rows belong to one project id (`BP00731224LZ`, `P00741341LZ`) that has **no `dbo.project` row** in the source, so the loader's inner join drops them. Source orphans, the same shape as the `P00851066VS` note gap.
- **The loader does not touch** `ProjectType = 'NULL'` (the reference writes it, on purpose) or the code-vs-name `ComponentType` artifact on the ~353,000 rows outside the Lump Sum parents. It does not link the children or bring the Lump Sum parents onto the model; that is the SQL migration's job, and the loader's only contribution to it is carrying the notes.

## 8. How to run it again

```
cd C:\Users\User\Eptisa\git_wsl\02_refactored\myps-gis-backend        # branch feat/data-migration-2023-2025-groups
.pixi\envs\default\python.exe -m app.data_migration.steps_for_2023_2025_groups --list
.pixi\envs\default\python.exe -m app.data_migration.steps_for_2023_2025_groups                 # every group not yet on the target
.pixi\envs\default\python.exe -m app.data_migration.steps_for_2023_2025_groups --group "2023 LP"
.pixi\envs\default\python.exe -m app.data_migration.steps_for_2023_2025_groups --notes-only    # the 2024 back-fill
.pixi\envs\default\python.exe -m app.data_migration.test_sql.verify_component_grain --all-2023-2025
.pixi\envs\default\python.exe -m app.data_migration.test_sql.verify_itemization_notes --all
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -v ProgramPK="MP_…" -i app\data_migration\migration_sql\rollback_program_group.sql
```

Back up first: the loader commits per table per stage, and only the rollback script or the backup undoes a half-loaded group. "Already on the target" means the `ProgramPK` exists, nothing finer — roll a half-loaded group back before the next default run, or it stays half-loaded. Run from a foreground shell, or as a detached background task with its own log; not `nohup … &` from a shell that then exits. Both engines use the `MYPS_BAK_DB_*` credentials because both point at localhost; the `MYPS_DB_*` pair is the remote server's and fails to log in here, which is the right outcome.

The reference's own history — the 2026-08-26 `ProjectFK`/`ProjectPK` fix and the 2026-09-09 `ProjectPK` vs `ReferenceId` assessment — lives with the code, in the backend repo's `documents/` folder.

## Related

- `MYPS_LEGACY_LS_MIGRATION.md` — the Lump Sum migration that follows this load
- `MYPS_DEV_200_DATABASE_BRINGUP.md` — Step 3b is this load in runbook form
- `documents/plans/legacy-ls-migration.md` — the plan, with its Completion Log
