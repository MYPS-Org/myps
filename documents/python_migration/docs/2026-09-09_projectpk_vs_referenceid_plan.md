# ProjectPK vs ReferenceId — Assessment and Implementation Plan

**Date:** 2026-09-09
**Branch:** `16-update-to-data-migration-scripts`
**Scope:** `app/data_migration/migration.py`, `app/data_migration/queries.py` (+ new tests / verify scripts)
**Databases (this session, read-only so far):** source `localhost/MYPS_BAK`, target `localhost/myps_db_migrated`. No other DB touched.
**Status:** Steps 1–6 **done** (2026-09-09): helpers `build_first_stage_tracking` / `split_new_projects` / `resolve_project_fks` extracted and wired in, G1–G4 closed, 18 unit tests green, both verify scripts committed and run (`verify_projectpk_vs_referenceid` → RESULT: OK, identical counts to §3). **Step 7 is on hold by decision: do not run the load.**

---

## 1. Requirement (as stated)

> `ProjectPK` should be generated from the `ProjectId` and the `ProgramPK` for the first ProgramStage of the program and the project, same as `ReferenceId` from `migration_old.py`. Projects can start at any stage of the Program.

Formalised as the **ProjectPK contract**:

```
ProgramPK  = "MP_" + <source programid of the FIRST stage in the ordered group>      (constant per group)
ProjectPK  = ProgramPK + "_" + <source projectid at the stage where the project FIRST appears>
ProjectFK  (tProjectRevisions / tProjectStages) = the ProjectPK above, for every later stage of that project
```

- A project that starts at BP keeps its **BP projectid** in the key for NEP/HGAB/GAA/GAA-R even though its `projectid` changes (later stages carry the BP id in `alternate_id`).
- A project that first appears at NEP / HGAB / GAA… gets its key from **that** stage's `projectid`.
- This is exactly what `migration_old.py` did with `tProjects.ReferenceId` / `tProjectRevisions.ReferenceId`, minus the `ProgramPK` prefix.

---

## 2. How each file generates the key

| Aspect | `migration_old.py` → `ReferenceId` | `migration.py` → `ProjectPK` / `ProjectFK` |
|---|---|---|
| Key formula | `p.projectid` (bare) | `'{program_pk}_' + prj.projectid` (`queries.build_project_sql`, `build_project_revisions_sql`) |
| Program component | none (`ProgramId` = primary program, `ProgramUniqueId` = stage) | `program_pk = _generate_program_pk(first_program_id)` = `MP_<first programid>`, passed in from `migrate_programs_and_stages` — constant for all stages |
| First stage `tProjects` | `ReferenceId = projectid` | `ProjectPK = pk_projectid` |
| First-stage tracking (`PROJECTS_START_DF`) | from `projects_of_program_df_1st`; **BP swap**: `ProjectId ← alternate_id`, `AlternateId ← projectid` | from `project_revisions_df_1st` (+ `ProjectFK`); same BP swap — `migration.py:326-343` |
| Later stage — "is this project new?" | merge on `projectid == tracked ProjectId` (`left_only`), then 2nd catch `projectid ∉ tracked ProjectId ∪ AlternateId` | merge on `ProjectId` (`left_only`), then **exclude rows whose sanitised `alternate_id` ∈ tracked ProjectId ∪ AlternateId** (`migration.py:794-800`), then 2nd catch `ProjectPK ∉ tracked ProjectFK` (`:848-850`) |
| New project's key at later stage | `ReferenceId = projectid` at that stage | `ProjectPK = f"{program_pk}_{ProjectId}"` at that stage (`:837-839`) |
| Existing project's revision FK at later stage | inner merge on `ProjectId`, then `ReferenceId = AlternateId if AlternateId.startswith('BP') else ProjectId` (`migration_old.py:919-921`) | resolver dict built from tracking: `ProjectId → ProjectFK` and `AlternateId → ProjectFK`; lookup by `ProjectId` first, then `AlternateId` (`migration.py:983-996`) |
| Unresolvable revision | silently **dropped** by the inner merge | explicitly dropped (`:999-1002`), **no log** |
| Child tables (stages, funding, component cost, work items) | join on `ReferenceId` | join to `tProjectRevisions` on stage `(projectid, programid)` → `ProjectRevisionFK` / `ComponentCostFK`; they **inherit** the resolved `ProjectFK` — no separate key logic |

**Conclusion of the code comparison:** the new code already implements the contract in §1. The `ProgramPK` is the first-stage program's, the projectid is the first-appearance projectid, and later stages resolve back to it via `ProjectId`/`AlternateId`.

---

## 3. Evidence (read-only simulation on live data)

A scratch script re-implemented both algorithms purely from `MYPS_BAK.dbo.project` (`projectid`, `alternate_id`) and diffed the resulting key per `(stage programid, projectid)` for every multi-stage group on both Excel sheets (`documents/migrated_programs_myps_db.xlsx`). `RBP`/`RDIP` single-stage groups skip the loop and were excluded.

| Sheet | Group | Stages | tProjects old / new | Revisions equal | DIFF | old dropped | new dropped |
|---|---|---|---|---|---|---|---|
| 2024_except_nogroup | CP | BP,NEP,HGAB,GAA,GAA-R | 1355 / 1355 | 5999 | 2 | 1 | 0 |
| 2024_except_nogroup | LFP | NEP,NEP-E,GAA,GAA-R | 391 / 391 | 1237 | 0 | 0 | 0 |
| 2024_except_nogroup | OO-1 | BP,NEP,HGAB,GAA,GAA-R | **6322 / 6309** | 26197 | 34 | 56 | 0 |
| 2024_except_nogroup | OO-2 | NEP,NEP-E,GAA,GAA-R | 3606 / 3606 | 11138 | 0 | 0 | 0 |
| 2024_except_nogroup | SSP | BP,NEP,HGAB,GAA,GAA-R | 17491 / 17491 | 46154 | 2 | 0 | 0 |
| 2025_all | CP | BP,NEP,NEP-E,HGAB,GAA,GAA-R | 1133 / 1133 | 4195 | **1872** | 0 | 0 |
| 2025_all | LFP | GAA,GAA-R,NEP | 317 / 317 | 760 | 0 | 0 | 0 |
| 2025_all | OO-1 | BP,NEP,NEP-E,GAA,GAA-R | 6447 / 6447 | 18954 | **6031** | 0 | 0 |
| 2025_all | OO-2 | NEP,HGAB,GAA,GAA-R | 3726 / 3726 | 11646 | 0 | 0 | 0 |
| 2025_all | SSP | BP,NEP,NEP-E,HGAB,GAA,GAA-R | 17172 / 17172 | 56844 | **838** | 0 | 0 |

Every difference was inspected; in **all** of them the new code is right and the old code was wrong:

1. **2025 sheet, 8 741 DIFFs (CP/OO-1/SSP, NEP-E stage).** At NEP-E the `alternate_id` is not the BP id (it is empty → sanitised to self, or a `DPWH-…` code). Old rule `AlternateId if startswith('BP') else ProjectId` therefore wrote `ReferenceId = P0093…` — a **dangling** reference (the `tProjects` row is `BP0093…`). New resolver maps `ProjectId → BP0093…` through the BP swap. Correct.
2. **CP 2024, 2 DIFFs.** Source `alternate_id` at GAA/GAA-R is the typo `BP0083245MN` (missing digit). Old copied the typo → dangling. New resolved by `ProjectId` → `BP00832450MN`. Correct.
3. **CP 2024, 1 old-dropped.** MY-linked project (`P00432237LZ`, BP-stage `alternate_id = MY00434230LZ`): old inner merge dropped its NEP revision; new resolves it via the tracked `AlternateId`. Correct.
4. **OO-1 2024, 13 extra old `tProjects` + 56 dropped + 34 DIFF.** The 13 cross-year projects (`P00801197VS…`, documented in the 2026-08-26 summary) are duplicated by the old code and resolved via `alternate_id` by the new code. Correct.
5. **SSP 2024, 2 DIFFs.** `P00801190VS` / `P00801534LZ` are tracked as their own project from an earlier stage (not linked to any BP row there), but at GAA-R their `alternate_id` says `BP…`. Old switched the key at GAA-R only (inconsistent with its own earlier revisions); new keeps the project's first-appearance key at every stage. Correct per contract.

Other facts verified:
- `myps_db_migrated` currently holds **no migrated data** (4 app-created programs, 8 projects). The migration has not been run against it yet.
- `fn_GetProjectRevisionData_v3` (old `ReferenceId` source) does **not** exist in `myps_db_migrated` — `migration_old.py` cannot run against the new schema anyway.
- Key columns are `nvarchar(200)` (`tProjects.ProjectPK`, `tProjectRevisions.ProjectFK`, `tProjectStages.ProjectFK`, `ProgramPK/FK`); migrated keys are ≈43 chars.
- App-created rows use a different convention (`ProgramPK = <user>_<MMDDYYYY>_<HHMMSS>`, `ProjectPK = <bare projectid>`). The `MP_…` prefix keeps migrated keys disjoint from app-created ones; no collision.

**Root cause statement:** there is no key-generation defect in `migration.py` relative to the requirement. The remaining gaps are parity/robustness gaps (§4), not wrong keys.

---

## 4. Gaps found (what the plan fixes)

| # | Gap | Where | Impact today |
|---|---|---|---|
| G1 | The "2nd catch" compares the prefixed `ProjectPK` against `alternate_ids_set` (raw ids) — that half is dead code. Old semantics (`projectid ∈ tracked AlternateId`) is only partially covered (via the `ProjectFK` set, which works for BP-first groups but not for a non-BP-first group whose later-stage `projectid` equals a first-stage `alternate_id`). | `migration.py:846-851` | 0 rows in current data; latent duplicate-project risk |
| G2 | Revisions with unresolved `ProjectFK` are dropped silently. | `migration.py:999-1002` | 0 rows in current data; silent data-loss risk |
| G3 | No record of how each later-stage project was resolved (`ProjectId` vs `AlternateId` vs new). | loop | hard to audit a real run |
| G4 | `_generate_program_pk` docstring describes `MP_02272025_091315` but the function returns `MP_<full programid>`. | `migration.py:91-95` | misleading |
| G5 | The key-resolution logic is inline pandas inside a ~1 250-line function; no unit tests. The previous verify scripts (`tests/verify_*.py`) are gone (only `.pyc` left). | `migration.py`, `tests/` | no regression protection |
| G6 | End-to-end run into `myps_db_migrated` has never been done; integrity of the keys after a real load is unverified. | — | unknown until run |

---

## 5. Implementation plan

Ordered; each step is independently committable. Steps 1–4 are behaviour-preserving on current data (the simulation must still print identical results afterwards).

### Step 1 — Extract the key logic into pure, testable helpers (`migration.py`)
Add module-level functions (pandas-only, no DB):

```python
def build_first_stage_tracking(project_revisions_df, first_stage_name) -> pd.DataFrame
    # columns: ProjectFK, ProgramFK, ProjectId, AlternateId, StartingProgramId ; applies the BP swap
def split_new_projects(projects_df, tracking_df, program_pk) -> pd.DataFrame
    # returns the genuinely-new rows with ProjectPK = f"{program_pk}_{ProjectId}"
def resolve_project_fks(revisions_df, tracking_df) -> tuple[pd.Series, pd.DataFrame]
    # ProjectFK per revision (ProjectId first, then AlternateId) + a "how resolved" frame for logging
```
Replace the inline code at `migration.py:326-343`, `:783-851`, `:983-1002` with calls. No change to SQL builders.

### Step 2 — Close G1 (parity with the old 2nd catch)
In `split_new_projects`, a row is "existing" if any of: `ProjectId ∈ tracked ProjectId`, `ProjectId ∈ tracked AlternateId`, `AlternateId ∈ tracked ProjectId ∪ AlternateId`, `ProjectPK ∈ tracked ProjectFK`. Drop the dead `ProjectPK ∈ alternate_ids_set` comparison.

### Step 3 — Close G2/G3 (observability)
- `resolve_project_fks` returns the resolution method per row; the loop logs per stage: `resolved_by_projectid`, `resolved_by_alternateid`, `new_projects`, `unresolved`.
- Unresolved revisions: log `WARNING` with the list of `(ProgramId, ProjectId, AlternateId)` before dropping. Keep the drop (writing a NULL/dangling FK is worse).

### Step 4 — Fix the G4 docstring (one line).

### Step 5 — Unit tests (`tests/unit/test_migration_project_pk.py`) — no DB
Fixtures cover every linkage pattern seen in the data:
1. BP-first, later stage `projectid = BP alternate_id` (normal case).
2. BP-first, later stage `alternate_id` empty / `DPWH-…` (the 8 741-row NEP-E case).
3. BP-first with an MY id in the BP `alternate_id` (`P00432237LZ` / `MY00434230LZ`).
4. Non-BP-first group (NEP → GAA), projectid unchanged.
5. Project first appearing at a later stage → key uses that stage's projectid; subsequent stages resolve to it.
6. Cross-year rename resolved only through `alternate_id` (`P00801197VS → P00706284VS`).
7. Typo'd `alternate_id` (`BP0083245MN`) still resolves by `ProjectId`.
8. Unresolvable revision → reported, not written.
9. G1 case: non-BP-first, later `projectid` equals first-stage `alternate_id` → **not** duplicated.
Assert `ProjectPK`/`ProjectFK` strings exactly (`MP_<prog>_<id>`).

### Step 6 — Commit the read-only verification scripts (`app/data_migration/__test__/`)
- `verify_projectpk_vs_referenceid.py` — the dual simulation from §3, parametrised by sheet; must report `only-new = 0`, `new-dropped = 0`, and the same DIFF/old-dropped counts as the table above (they are the old code's bugs, so they are expected).
- `verify_migrated_keys.py` — post-load integrity checks against the target: duplicate `tProjects` per project (linked by `ExternalId`), orphan `ProjectFK`s in `tProjectRevisions`/`tProjectStages`, revisions-per-`ProjectFK` distribution, and per-stage resolution counts. SELECT-only.

### Step 7 — End-to-end run (requires your go-ahead: it **writes** to `myps_db_migrated`)
1. Confirm `steps_for_migration.py` paths (`env_config` and the Excel path are placeholders `C:\Path\To\…`) and `TARGET_DB_NAME="myps_db_migrated"` (already set in the uncommitted diff).
2. Run for sheet `programs_2024_except_nogroup`.
3. Run `verify_migrated_keys.py`; expected: 0 duplicates, 0 orphans, 6 309 `tProjects` for OO-1, 1 355 for CP, etc. (numbers from §3).
4. Repeat for `programs_2025_all` if the target is meant to hold both years.

---

## 6. Out of scope / not changed
- The key **format** (`MP_<programid>_<projectid>`) — it satisfies the requirement and fits the columns; the app's own `<user>_<date>_<time>` / bare-projectid convention is a separate concern.
- `tProjects.ProgramId` for later-stage new projects **stays the stage programid** (decision 2026-09-09). Only the key is anchored to the first appearance: `ProjectPK = ProgramPK_<projectid at first appearance>`.
- Column-add scripts in `migration_sql/` and the 2024 vs 2025 sheet selection.

## 7. Files touched by the plan
| File | Steps |
|---|---|
| `app/data_migration/migration.py` | 1, 2, 3, 4 |
| `tests/unit/test_migration_project_pk.py` (new) | 5 |
| `app/data_migration/__test__/verify_projectpk_vs_referenceid.py` (new) | 6 |
| `app/data_migration/__test__/verify_migrated_keys.py` (new) | 6, 7 |
| `app/data_migration/queries.py` | none |
