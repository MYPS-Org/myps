# ProjectFK / ProjectPK Migration Fix — Session Summary

**Date:** 2026-08-26
**Branch:** `fix-projectfk-programpk-generation` (cut from `12-…modirevi-tables`)
**Commit:** `5034539` — *[#12] Fix ProjectFK/ProjectPK generation from ProgramPK; map loop stages via alternate_id* (11 files, +788 / −89)
**Scope:** `app/data_migration/` (plus DB-name cleanup across three other query modules)
**Related report:** [`alternate_id_only_resolutions.md`](alternate_id_only_resolutions.md)

---

## 1. Executive summary

The migration into `tProjectRevisions` was broken twice over:

1. **A hard crash.** `queries.build_project_revisions_sql` interpolated `'{project_pk}'`, a name that was never a parameter of that function — the f-string raised `NameError` on every call.
2. **A silent grouping bug.** Even with the crash fixed, later-stage projects were matched back to first-stage projects **by `ProjectId` only**. Projects whose `projectid` changes across stages (linked instead by `alternate_id`) were either duplicated under a fresh `ProjectPK` or written with a `NULL ProjectFK`.

Both are fixed. The business key is now uniform end-to-end:

```
ProjectPK = ProjectFK = {ProgramPK}_{source projectid}
e.g. MP_P_CO-PS-800_07152024_143901_BP00900770MN
```

`ProgramPK` is computed **once** from the first program in the ordered stage list and stays constant for every stage of the group, which makes the key unique per **Project × ProgramGroup × ProgramYear** while collapsing the same project across stages (BP → NEP → HGAB → GAA → GAA-R) into **one** PK/FK.

The `alternate_id` fallback is **not** defensive-only: it resolves **39 real rows** (13 distinct projects × 3 stages) in the OO-1 2024 group on production data that the old logic would have mis-mapped.

---

## 2. Root cause

### 2.1 The crash — `queries.py`

```python
# before — 'project_pk' is not a parameter of build_project_revisions_sql
'{project_pk}' AS ProjectFK,
```

The commented-out fallback beside it was also wrong: it built the FK from `MPP_ + raw stage programid + _ + projectid`, whereas `build_project_sql` generated the PK from a different expression. Even without the `NameError`, the FK would never have joined to the PK.

### 2.2 The grouping gap — `migration.py`

Inside `# region LOOP through remaining program stages`, two merges resolved loop-stage projects against the first-stage tracking frame `PROJECTS_START_DF`:

| Merge | Purpose | Match key (before) |
|-------|---------|--------------------|
| A (~line 784) | detect genuinely-new projects | `ProjectId` only |
| B (~line 967) | attach `ProjectFK` to each revision | `ProjectId` only |

`alternate_id` was never a match key. The BP-first case worked only *by accident* of an existing column swap that relocates `alternate_id` into the tracked `ProjectId`.

### 2.3 Source-schema fact

Verified directly against the live schema: `MYPS_BAK.dbo.project` has **`alternate_id`** and **no `external_id`** column — `ExternalId` is derived from `alternate_id` downstream. So `alternate_id` is the only correct linkage field.

Observed linkage patterns in the source data:

```
BP stage    : projectid = BP00900770MN , alternate_id = P00909002MN   (canonical downstream id)
Later stage : projectid = P00909002MN  , alternate_id = BP00900770MN  (points back to BP)
Cross-year  : projectid = P00801197VS  , alternate_id = P00706284VS   (id changed 2007 -> 2008)
```

The third pattern is the one that `ProjectId`-only matching cannot see.

---

## 3. Changes applied

### 3.1 `app/data_migration/queries.py`

| Function | Change |
|----------|--------|
| `build_project_sql` | `ProjectPK` now `'{program_pk}_'+prj.projectid` (was raw stage `programid`); dropped the `migrated_project_pk_prefix` parameter |
| `build_project_revisions_sql` | Replaced the broken `'{project_pk}'` with the **identical** expression `'{program_pk}_'+prj.projectid`; dropped the prefix parameter |

Current signatures:

```python
def build_project_sql(source_db_name, program_id, program_pk, is_deleted) -> str
def build_project_revisions_sql(source_db_name, target_db_name, program_id, program_pk, is_deleted) -> str
```

### 3.2 `app/data_migration/migration.py`

1. **New-project detection (Merge A)** — after the `ProjectId` left-only merge, rows whose `alternate_id` matches any tracked `ProjectId`/`AlternateId` are excluded from "new", so they reuse the `ProjectPK` generated at their first stage.
2. **Revision → ProjectFK (Merge B)** — the `ProjectId`-only outer merge was replaced by an explicit resolver built from `PROJECTS_START_DF` that maps **both** `ProjectId → ProjectFK` **and** `AlternateId → ProjectFK`, resolving each revision by `ProjectId` first, then `AlternateId`:

   ```python
   _id_to_fk = {}
   for _pid, _aid, _fk in zip(PROJECTS_START_DF["ProjectId"],
                              PROJECTS_START_DF["AlternateId"],
                              PROJECTS_START_DF["ProjectFK"]):
       if pd.notna(_pid): _id_to_fk.setdefault(_pid, _fk)
       if pd.notna(_aid): _id_to_fk.setdefault(_aid, _fk)

   project_revisions_df_loop["ProjectFK"] = project_revisions_df_loop.apply(
       lambda row: _id_to_fk.get(row["ProjectId"]) or _id_to_fk.get(row["AlternateId"]),
       axis=1,
   )
   ```

   Unresolvable revisions are **dropped** rather than written with a `NULL` FK.
3. **New projects found in later stages** now build `ProjectPK` from the constant `program_pk` (`f"{program_pk}_{row}"`) instead of the stage-specific `current_program_u_id`.
4. **Deprecated `"MPP_"` prefix removed** — the `MIGRATED_PROJECT_PK_PREFIX` constant, the loop-local copy, the dead `_generate_project_pk` helper (no callers), and the argument at all three builder call sites. It was redundant once the `ProgramPK` became part of the key.

### 3.3 Hard-coded `myps_db` → in-scope variable

Every hard-coded database literal was routed through a variable, resolving to **`myps_db_dev`** for this work:

| File | Literal | Now |
|------|---------|-----|
| `app/projects_and_programs/queries.py` | `[myps_db].[dbo]` x17 | `[{db_name}]` (function param; call sites pass `settings.myps_db_database`) |
| `app/infrastructure_inventory/queries.py` | `[myps_db].[dbo]` x2 | `[{settings.myps_db_database}]` |
| `app/data_migration/queries.py` | `[myps_db].[dbo]` x9 | `[{target_db_name}]` (function param) |
| `app/data_migration/migration.py` | `myps_db.dbo.tOptionInfraType` x2 | `{target_db_name}.dbo…` |
| `app/data_migration/steps_for_migration.py` | `TARGET_DB_NAME="myps_db"` | `TARGET_DB_NAME="myps_db_dev"` |
| `tests/verify_projectfk_fix.py` | `TARGET_DB_NAME = "myps_db"` | `TARGET_DB_NAME = "myps_db_dev"` |

The app runtime already resolved to `myps_db_dev` via `.env`; these literals were **bypassing** the variable. At least one was a latent bug — `import_road_sections_cleanup` mixed `{settings.myps_db_database}` with a hard-coded `[myps_db]` in the same statement.

`[LOCAL-MYPS]` in `get_project_work_location_v1` and the `…_myps_db.xlsx` filename are different strings and were left untouched.

---

## 4. Verification

All verification was **read-only** (`SELECT` only) against `localhost` / `myps_db_dev`. **No migration writes or inserts were performed at any point.**

### 4.1 Offline render check

`build_project_sql` and `build_project_revisions_sql` render byte-identical key expressions:

```
ProjectPK: 'MP_P_CO-PS-220_02272025_091315_'+prj.projectid AS ProjectPK,
ProjectFK: 'MP_P_CO-PS-220_02272025_091315_'+prj.projectid AS ProjectFK,
MATCH: True
```

### 4.2 Live query execution — OO-1 2025 (`tests/verify_projectfk_fix.py`)

ProgramPK `MP_P_CO-PS-800_07152024_143901`, constant across all stages.

| Check | Result |
|-------|--------|
| `tProjects` rows (`build_project_sql`) | 4,701 |
| `tProjectRevisions` rows (`build_project_revisions_sql`) | 4,701 |
| ProjectFK values with no matching ProjectPK | **0** |
| Rows with unexpected key format | **0** |
| Later NEP stage rows, all embedding the same ProgramPK | 5,019 |

The previously-crashing code path now executes cleanly.

### 4.3 Loop resolver simulation — single group (`tests/verify_loop_projectfk_mapping.py`)

OO-1 2025, BP → NEP: 4,701 BP projects get fresh PKs; **4,685** NEP projects resolve to the existing BP `ProjectPK`; **334** are genuinely new. In this group all matches landed via `ProjectId` (the BP swap had already aligned ids), so the `alternate_id` path fired **0** times here.

### 4.4 All-groups simulation (`tests/verify_loop_mapping_all_groups.py`)

Run against the **`programs_2025_all`** and **`programs_2024_except_nogroup`** sheets, faithfully replicating first-stage tracking (including the BP swap only when the first stage is BP).

**Total `alternate_id`-only resolutions: 39** — all in the **OO-1 2024** group (first stage `P_CO-PS-635_07202023_140408`), the same 13 distinct projects carried across three later stages:

| Stage | ProgramId | ProgramName | Rows |
|-------|-----------|-------------|------|
| HGAB | `P_CO-PS-635_12222023_143205` | HGAB 2024 OO-1 | 1–13 |
| GAA | `P_CO-PS-635_01222024_171946` | GAA 2024 OO-1 as Approved | 14–26 |
| GAA-R | `P_CO-PS-634_03252024_123925` | GAA 2024 OO-1 | 27–39 |

The 13 distinct ProjectIds:
`P00801197VS, P00801198VS, P00801223VS, P00801224VS, P00801225VS, P00801226VS, P00801227VS, P00801228VS, P00801229VS, P00801230VS, P00801231VS, P00801232VS, P00801280MN`

Two linkage patterns:
- **Cross-year id change** (2 projects): `P008011xxVS → alternate_id P007062xxVS` — the id changed between program years; only `alternate_id` links them.
- **BP-derived** (11 projects): `P008012xxVS → alternate_id BP008xxxxxVS`.

Every resolved `ProjectFK` maps to a real tracked `ProjectPK` (integrity assertion held for all groups, both sheets). Single-stage groups (RBP x19, STO, TF) correctly skip the loop.

Full per-row table: [`alternate_id_only_resolutions.md`](alternate_id_only_resolutions.md).

### 4.5 Post-prefix-removal re-run

Both sheets were re-run after `"MPP_"` was dropped. Results **identical** — 39 alternate-only matches, all groups consistent — confirming the removal changed only the key *string*, not the matching logic. Keys are now e.g. `MP_P_CO-PS-635_07202023_140408_P00706284VS` (was `MPP_MP_…`).

---

## 5. Why the fix is both safe and load-bearing

- **Behavior-preserving** wherever `ProjectId` already matched — the fallback only fires when the `ProjectId` lookup misses, so no project changes hands relative to the old logic.
- **Load-bearing on real data** — the 39 OO-1 2024 rows would previously have become duplicate `ProjectPK`s or `NULL ProjectFK`s. This is a real production defect, not a hypothetical.
- **Cross-stage grouping** of a BP project with its later-stage continuation continues to be handled by the existing `PROJECTS_START_DF` merge, which was left intact apart from switching new-project PK generation to the constant `program_pk`.

---

## 6. Artifacts produced

| Path | Purpose |
|------|---------|
| `tests/verify_projectfk_fix.py` | Read-only: executes both builders against the live DB, asserts FK↔PK integrity and key format |
| `tests/verify_loop_projectfk_mapping.py` | Read-only: simulates the loop resolver for a single BP-first group |
| `tests/verify_loop_mapping_all_groups.py` | Read-only: parametrized by sheet name; tallies `ProjectId` vs `alternate_id`-only vs new across every group, writes the resolutions report |
| `documents/alternate_id_only_resolutions.md` | The 39-row report (ProjectId, ProgramId, ProgramName, ProgramStageName, alternate_id, resolved ProjectFK) |
| `documents/` | Created this session; the three root-level `.md` files were moved in |

---

## 7. Environment and working constraints

- **Python interpreter:** `.pixi/envs/default/python.exe` — the system Python 3.13 lacks the project deps (sqlalchemy, pymssql, geopandas, osgeo/GDAL). Recorded in project memory as `pixi-python-env`.
- **DB access restricted to `localhost` / `server.local`** for the session; both reachable on port 1433.
- **Target DB:** `myps_db_dev`.
- `.claude/settings.local.json` gained a prefix-wildcard allow rule for the pixi `$py` PowerShell invocation. Left **uncommitted** — local machine config with absolute paths.

---

## 8. Open items and caveats

1. **The full load was never run.** `steps_for_migration.py` performs inserts; it was deliberately not executed. End-to-end confirmation that the 39 projects land as revisions under the right `ProjectPK` (rather than as duplicates) still requires a real run against `myps_db_dev`.
2. **Two verify scripts are stale.** `tests/verify_projectfk_fix.py` and `tests/verify_loop_projectfk_mapping.py` still reference the removed `migration.MIGRATED_PROJECT_PK_PREFIX` and pass the removed positional argument to the builders — they will error if rerun. `verify_loop_mapping_all_groups.py` was already updated (`prefix = ""`). Fixing the other two is a one-line change each.
3. **Hard-coded connection details.** `steps_for_migration.py` still inlines `SOURCE_DB_HOSTNAME` / `TARGET_DB_HOSTNAME = "localhost"` and `sa/***REMOVED***` rather than reading `.env`. Confirm `myps_db_dev` exists on `localhost` before a real run.
4. **Mixed commit.** `migration.py`, `data_migration/queries.py`, and `projects_and_programs/queries.py` carried pre-existing uncommitted edits from the same feature area (branch #12). Git commits whole files, so those hunks are inside `5034539` and could not be cleanly separated.
5. **Deliberately excluded from the commit:** `app/auth.py`, `app/admin_org_mgmt/services.py` (pre-existing, untouched this session), and unrelated untracked items (`.claude/`, `migration_old.py`, `app/utils/`, `logs/`, `myps-gis-backend.zip`, `notebooks/`, `pytest.ini`, `requirements.txt`, `sql/`, `web.config`, pre-existing `tests/` scaffolding).
6. **Nothing was pushed.** The branch is local only; no PR opened.
7. **`documents/API_ROUTES copy.md`** looks like an accidental duplicate of `API_ROUTES.md` — moved as-is, not diffed or deleted.
