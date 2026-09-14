# Loading the rest of the 2023 programs from `MYPS_BAK` into `myps_db_dev_200`

**Date:** 2026-09-14 (afternoon; follows `MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md`)
**Source:** `localhost` / `MYPS_BAK` — every `dbo.program` row with `yearstart = 2023`
**Target:** `localhost` / `myps_db_dev_200`
**Pipeline:** `steps_for_2023_2025_groups.py` in the backend repo, `C:\Users\User\Eptisa\git_wsl\02_refactored\myps-gis-backend\app\data_migration`, branch `feat/data-migration-2023-2025-groups`. Nothing is copied into this repo.
**Backup taken:** `myps_db_dev_200_pre_2023_full_load_20260914.bak`
**Result:** 29 more program groups loaded — 28,763 projects, 37,032 revisions, 49,164 components, 491,345 per-year rows. Every 2023 program in the source now has a matching group on the target. Both verifiers green.

---

## 1. Why

The morning load brought across the three 2023 groups that hold Lump Sum parents (CSSP, LP, OO-1) and 2025 OO-1. The instruction this afternoon was to make the loader able to migrate **the entire list** of 2023 programs in `MYPS_BAK.dbo.program`, grouped by

```sql
SELECT prg.programid, prg.name, prg.stage_id, prg.parent_program_category, cat.name
FROM MYPS_BAK.dbo.program prg
LEFT JOIN MYPS_BAK.dbo.category cat ON prg.parent_program_category = cat.categoryid
WHERE yearstart = 2023
```

and to run it, localhost to localhost.

## 2. How the 48 programs group

That query returns 48 rows. They fall into 32 groups:

| Grouping | Groups | Stages | Note |
|---|---:|---|---|
| Category 16 OO-1, 17 OO-2, 18 CSSP, 19 LP | 4 | BP → NEP → HGAB → GAA → GAA-R | Annual groups; three were already loaded, **OO-2 is new** |
| Category 5 FAPs, 7 DA FMR, 8 DepEd BEFF, 13 SRA | 4 | GAA-R only | One program each |
| Category 12 Trust Funds | 1 | TF-R only | |
| No category: STO Funds, Unprogrammed Appropriations, GAA 2023 Augmentation | 3 | GAA-R only | |
| No category: RDIP FY 2023-2028 Region VI Training | 1 | RDIP only | Created from host `P_TEST-W10PRO-03`; loaded because it is on the list — see §6 |
| Category 0: RBP FY 2023 *region* | 19 | RBP only | One per region, including three BARMM programs |

A single-stage program is its own group, keyed `MP_<its own programid>` with one revision and one stage. That is exactly how the 2024 server load keyed `RBP FY 2024 <region>`, `STO Funds 2024`, `Trust Funds 2024` and `GAA 2024 DA FMR`, so the new rows sit beside their 2024 counterparts in the same shape. The target's `tOptionProgramStage` already carries RBP (8), RDIP (9) and TF-R (13); nothing was added to it.

The grouping is written into `PROGRAM_GROUPS` in the entrypoint with the SQL above quoted beside it, and a start-up check confirmed the 48 configured stage ids equal the 48 source ids with nothing missing and nothing extra.

## 3. What changed in the loader

- **Every 2023 group is inline.** `PROGRAM_GROUPS` grew from 4 to 33 entries; `GROUP_ORDER` names every one, small single-stage programs first so a defect shows early and costs little to roll back, `2023 OO-2` last. `--list` prints the plan.
- **The default run skips what is already there.** It used to refuse if any group's `ProgramPK` existed. Now, with no `--group`, it loads every group whose key is absent and logs the ones it skipped; `--group` still refuses a loaded group. The check is by `ProgramPK` only, so a group whose load died half-way counts as loaded — roll it back first (the docstring says so).
- **Empty programs.** `RBP FY 2023 Region XII BARMM` has no `dbo.project` rows. The project loader assumes a non-empty first stage, so a group whose stages hold no projects gets its program, revision and stage rows and a warning, nothing else. The 2024 server load simply omitted its empty sibling `RBP FY 2024 BARMM Region X`; this one is on the target as a program with no projects, which is what the source says.
- **`OPTION (HASH JOIN)` on the per-year cost query.** See §5 — the run stalled on it.
- **Both verifiers derive their group lists from the entrypoint** (`GROUP_ORDER`, `program_pk_for`, the last stage of each group for notes) instead of carrying their own copies. `verify_component_grain` also now leaves out components whose `ComponentType` is `'Lump Sum'`: that is the marker the Lump Sum SQL migration writes when it takes a parent over, and those components' `Total` is re-derived as `Remaining + Σ children` on purpose, so comparing them to the source is the migration's check, not the loader's.

## 4. What was loaded

Counted back from the target through `ProgramFK`, after the run.

| Group | Projects | Revisions | Components | Per-year | Work items | Funding |
|---|---:|---:|---:|---:|---:|---:|
| 2023 OO-2 (5 stages) | 3,166 | 11,435 | 16,719 | 167,073 | 11,277 | 11,435 |
| GAA 2023 DepEd BEFF | 2,231 | 2,231 | 4,471 | 44,611 | 1,255 | 2,224 |
| Unprogrammed Appropriations 2023 | 1,885 | 1,885 | 3,778 | 37,762 | 1,277 | 1,883 |
| GAA 2023 DA FMR | 1,016 | 1,016 | 1,819 | 18,163 | 1,015 | 1,016 |
| STO Funds 2023 | 210 | 210 | 204 | 2,040 | 27 | 2 |
| RDIP FY 2023-2028 Region VI Training | 147 | 147 | 147 | 1,454 | 448 | 117 |
| Trust Funds 2023 | 136 | 136 | 139 | 1,381 | 116 | 94 |
| GAA 2023 Augmentation | 61 | 61 | 103 | 1,030 | 49 | 38 |
| SRA 2023 Farm-to-Mill | 37 | 37 | 75 | 741 | 36 | 37 |
| GAA 2023 FAPs | 11 | 11 | 24 | 240 | 22 | 9 |
| RBP FY 2023, 19 regions | 19,863 | 19,863 | 21,685 | 216,850 | 21,656 | 19,737 |
| **Total, 29 groups** | **28,763** | **37,032** | **49,164** | **491,345** | **37,178** | **36,592** |

The RBP line is the sum of the 19 regional groups; Region X is the largest at 1,936 projects, Region XII BARMM has none.

Per source stage, `dbo.project` count = target `tProjectRevisions` count = target `tProjectStages` count on **all 48** 2023 programs, and source `projectcoststream` rows = target per-year rows on every one of the 29 new ones. `tProjectNotes` did not move: none of the new programs carry itemization history.

Database totals, before → after:

| Table | Before | After | Loaded |
|---|---:|---:|---:|
| `tPrograms` | 44 | 73 | 29 |
| `tProgramRevisions` | 108 | 141 | 33 |
| `tProjects` | 86,597 | 115,360 | 28,763 |
| `tProjectRevisions` | 221,534 | 258,566 | 37,032 |
| `tProjectStages` | 221,534 | 258,566 | 37,032 |
| `tProjectFundingProfile` | 221,185 | 257,777 | 36,592 |
| `tProjectComponentCost` | 515,186 | 564,350 | 49,164 |
| `tProjectComponentCostPerYear` | 5,148,181 | 5,639,526 | 491,345 |
| `tProjectMajorWorkItem` | 358,851 | 396,029 | 37,178 |
| `tProjectMajorWorkLocations` | 510,710 | 555,998 | 45,288 |
| `tProjectNotes` | 4,138 | 4,138 | 0 |

`tPrograms` with `StartYear = 2023`: 32, all `MP_`-keyed.

## 5. What went wrong on the way

**The per-year cost query stalled for an hour on a 147-project program.** `RDIP FY 2023-2028 Region VI Training` has 1,454 cost-stream rows, all component `CW1`. `build_project_component_cost_per_year_sql` joins the source rows to `tProjectComponentCost` on `ProjectRevisionFK` and `ComponentId`. For this small program the optimizer estimated 28,641 rows and chose nested loops that reached the target through its `ComponentId` index — so every source row matched every `CW1` component on the target before the revision predicate applied. `sys.dm_exec_query_profiles` showed the seek at **494 million rows** after an hour, 8,300 s of CPU, no blocking. The big programs never hit this because their estimates were large enough for a hash join.

Fix: `OPTION (HASH JOIN)` on that query, with the reason in its docstring. Killed the session, rolled back the partial RDIP group (147 projects, 147 revisions, 147 components, 117 funding lines, no per-year rows — the rollback script's counts, then its delete), and reloaded it alone: **7 seconds**. The remaining 23 groups then loaded in 7 minutes, 2023 OO-2's five stages in 2 min 7 s.

**Nothing else.** The RDIP stall was the only failure; the killed loader's traceback was the pymssql connection reset, not a data error.

## 6. Things to know, none of them defects of this run

- **The RDIP program is training data.** Created from `P_TEST-W10PRO-03`, projects named `RVI_Training1…`, ids `MY007…`. It is on the 2023 list, so it was loaded; it is one group, `MP_P_TEST-W10PRO-03_10242022_123507`, and `rollback_program_group.sql` removes it in seconds if it should not be there.
- **20 Lump Sum parents disagree with the source on `Total`** — all in the morning's 2023 CSSP / LP / OO-1 GAA-R stages, all `ComponentType = 'Lump Sum'`, `UpdatedBy` the Lump Sum migration or the application. That is the migration's `Remaining + Σ children` re-derivation and is intended; the verifier now leaves those out (§3).
- **Ten per-year rows short on two morning stages.** `BP 2023 CSSP` has 68,170 cost-stream rows and 68,160 per-year rows; `GAA 2023 CSSP as Approved` 294,720 and 294,710. In each case the 10 rows belong to one project id (`BP00731224LZ`, `P00741341LZ`) that has **no `dbo.project` row** in the source, so the loader's inner join drops them. Source orphans; the same shape as the `P00851066VS` note gap recorded this morning.

## 7. Verification

- `verify_component_grain --all-2023-2025`, 33 groups: **210,920 (revision, component) pairs, one live row each; every non-Lump-Sum Total equals the source Σ cost.** Green.
- `verify_itemization_notes --all`: counts match on all six note-bearing programs, 4,037 links resolve, no duplicates. Green; unchanged by this load.
- Per-stage counts as in §4, on all 48 programs.

## 8. Where the code is

Backend repo, branch `feat/data-migration-2023-2025-groups`, two commits on top of the morning's: `Load every 2023 program group, not just the three with Lump Sum parents` (entrypoint, query hint, verifier lists) and the verifier's Lump Sum exclusion. Run:

```
.pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups --list
.pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups
```

The second command is safe to repeat: it loads only what is missing.
