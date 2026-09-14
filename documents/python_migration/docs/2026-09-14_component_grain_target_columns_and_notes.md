# Data migration — component grain, target columns, itemization notes

**Date:** 2026-09-14
**Branch (backend):** `feat/data-migration-2023-2025-groups` in `02_refactored/myps-gis-backend`
**Files changed:** `app/data_migration/queries.py`, `app/data_migration/migration.py`; new `steps_for_2023_2025_groups.py`, `migration_sql/rollback_program_group.sql`, `test_sql/verify_component_grain.py`, `test_sql/verify_itemization_notes.py`, `tests/unit/test_migration_target_columns.py`
**Where the scripts are:** `C:\Users\User\Eptisa\git_wsl\02_refactored\myps-gis-backend\app\data_migration` — the backend repo is the only copy; this folder holds write-ups only (decision 2026-09-14, after a mirror was removed).

## 1. `build_project_component_cost_sql` produced one row per yearly cost shape — fixed

The query selected `p_cost_s.cost`, `start_date`, `end_date`, `date_of_approval` beside a correlated `SUM(cost)` over all years, under `SELECT DISTINCT`. Those columns differ per year, so DISTINCT could not collapse them: a component with 9 distinct (cost, dates) shapes landed as **9 component rows**, each with the whole Total, and `build_project_component_cost_per_year_sql` — which joins on `(revision, ComponentId)` — then attached every per-year row to every copy.

Measured on `myps_db_dev_200`, which the previous form loaded: 176,316 `(ProjectRevisionFK, ComponentId)` pairs with more than one live row, up to 27 copies.

Now `GROUP BY t_prj_rev.Id, projectid, component, description, componenttype, userid, datecreated, datechanged, programid` with `SUM(cost) AS Total`. The per-year columns are dropped rather than aggregated: they are not this table's data. Verified against the 27-copy case (`P00201118LZ`, HGAB 2024 OO-1): one row per component. `verify_component_grain.py` checks a loaded group for one row per pair and Total = source Σ cost.

## 2. The application database names the provenance columns differently — mapped, not renamed

`TARGET_COLUMN_MAP` (in `queries.py`, one definition) says how each table's `DataImportProgramId` / `DataImportProjectId` is called on the app's schema: a single `DataImportId` on `tPrograms`, `tProgramRevisions`, `tProgramStages`, `tProjects`, `tProjectRevisions`, `tProjectStages`, `tProjectFundingProfile`; the full triple, unchanged, on the component, per-year and work tables. `migration.to_target(df, table)` applies it before every `to_sql`; `queries.target_column_name(table, column)` applies it where a query reads the column back (`build_project_stages_sql`). Renaming columns on the app's database — what `import_id_rename.sql` does for `myps_db_migrated` — would break its EF model.

## 3. Itemization history now travels

The old model records an itemization as a `dbo.history` row against the **child**: `'Itemized from Project: <parent>'`, in the GAA-R program only. `alternate_id` does not carry it (0 of 42,589). `build_project_notes_sql` copies those rows, and the parent-side `'Cost reduced due to itemization…'` ones, into `tProjectNotes` on the child's revision, at every stage, guarded by `NOT EXISTS` so it repeats safely. `migrate_notes_for_programs` back-fills programs already loaded.

## 4. `build_program_revisions_sql` falls back to the cost stream on overflow

`tProgramRevisions.Cost` is `decimal(18,5)`. One `MYPS_BAK` program (`GAA 2023 CSSP as Approved`) stores `cost = 300,585,464,920,206`, 772× its own cost stream. Where `ABS(cost) >= 1e13`, `SUM(projectcoststream.cost)` for the program is written instead and the loader logs both figures. Maintainer's decision; the app recomputes this column itself (`pRecomputeProgramCost`) on the same basis.

## 5. The new entrypoint, and how to run it

```
.pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups                 # all four groups
.pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups --group "2023 LP"
.pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups --notes-only      # 2024 back-fill
```

Source `localhost/MYPS_BAK` and target `localhost/myps_db_dev_200` are constants; both hosts must resolve to loopback or this machine or the script refuses. It also refuses if a group's `ProgramPK` is already present. Undo a group with `rollback_program_group.sql -v ProgramPK="MP_…"`.

Non-BP-first groups are handled by the reference as it stands: `build_first_stage_tracking` swaps ids only when the first stage is BP, and a project first seen later is keyed from that stage. List a group's true first stage.

Do not run the load inside a `nohup … &` from a shell that then exits — the process is killed mid-group and the group is left half loaded.
