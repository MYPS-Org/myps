# Handoff — MYPS Formal Revision Workflow Investigation — 2026-08-13

This document is a full session handoff, written for another agent (Codex) with no access to the original conversation. It captures what was asked, in what order, what was found, what's still open, and the exact point the session was paused. Read top to bottom — later sections depend on earlier ones.

Repo: `project_myps` (DPWH MYPS — Multi-Year Programming System). Branch at time of writing: `BE-projectdetails`. Repo root: `c:\Users\khen\source\repos\mf1027\project_myps`.

A parallel, purely-technical version of the findings below (without the session narrative) also exists at `memory/2026-08-13-revision-controller-analysis.md` — this handoff document supersedes it in scope (adds narrative + current status) but the technical content is the same, just reorganized.

---

## 1. How this session unfolded (chronological)

1. **Initial ask:** read and thoroughly analyze `WebAPI/Controllers/Revision/RevisionController.cs` (3180 lines) and the related DB objects in `myps_db`.
2. Did a full read-through (delegated part of it to a subagent to keep context light), produced an endpoint-by-endpoint breakdown and an initial list of ~10 code-level bugs, spot-verified the most serious ones directly against the source.
3. User asked to persist this analysis somewhere durable. Clarified via a question that a `memory/` folder already existed at repo root (one prior file, git-committed) and the user chose to keep using it. Findings were written to `memory/2026-08-13-revision-controller-analysis.md`.
4. **Follow-up ask:** "tRevisionRules the fields column" — audited the `ModificationRules`/`Field*` C# classes (`DBHelper/Models/Table/ModificationRules.cs`) that deserialize `tRevisionRules.Field` (a JSON blob), cross-checking every property name against the actual DTOs/entities used in the controller. Found several property-name mismatches that make certain rule flags silently non-functional, plus one new bug (`ComponentCostPerYear.Year` never persisted on insert).
5. **Follow-up ask:** "check first the fProjectDetails, fProjectFundingProfile, fProjectComponentCost, fProjectComponentCostPerYear, fProjectMajorWorkItem and fProjectMajorWorkLocations" (six SQL table-valued functions). While attempting this, the dev DB (`192.168.50.200`, see §2) — unreachable earlier in the session — became reachable. Direct live queries revealed the six functions are fine, **but also revealed a much bigger problem**: the live DB schema for the Formal Revision tables has already been migrated to a new, incompatible shape that the controller code doesn't know about (full detail in §4). Also found and live-verified a concrete crash bug in the `ReviseProject` endpoint.
6. Quantified real-world impact of the Fields-column bugs by querying the actual 347 active rows in `tRevisionRules` (not just theory).
7. User said **"put this on hold as well"** — work paused.
8. User resumed, specifically: **"tRevisionRules fields column it should be linked to the columns in the tRevisionProjects, tRevisionFundingProfile, tRevisionComponentCost, tRevisionComponentCostPerYear, tRevisionMajorWorkItem, tRevisionMajorWorkLocations"** — built a definitive, DB-verified linkage map between every `Field*` class property and every live column on those six tables, distinguishing real bugs from deliberate gaps (by checking whether "gap" fields ever appear in the live rule data — they don't, so they're deliberate). Produced a precise 6-item fix list.
9. User asked **"what db are you looking at?"** — answered: dev DB at `192.168.50.200` / `myps_db`, credentials from `Main/appsettings.Development.json`, explicitly **not** the production connection string in `Main/appsettings.json` (`10.0.10.226`), which was never queried.
10. User asked: **"create a clone and make sure it is our working db myps_db_revision"** — intent: clone the dev `myps_db` database into a new database named `myps_db_revision` and use that as the working target going forward (likely meaning: update `Main/appsettings.Development.json`'s connection string to point at the clone instead of `myps_db`, so further investigation/testing doesn't touch the shared dev DB). **This was not completed** — see §6, "Interrupted action," for exact state.
11. User then asked for this handoff document, to pass to Codex.

---

## 2. Environment & DB access details

- **Dev DB used throughout this investigation:** SQL Server at `192.168.50.200`, database `myps_db`, login `sa` / password `***REMOVED***`. Source: `Main/appsettings.Development.json` → `ConnectionStrings:MYPSDb`. This server was intermittently unreachable (network-dependent) — confirm connectivity before assuming it's up (`Test-NetConnection -ComputerName 192.168.50.200 -Port 1433`, or just try a query).
- **Production connection string exists but was never used:** `Main/appsettings.json` → `ConnectionStrings:MYPSDb` = `Server=10.0.10.226;Database=myps_db;User Id=MYPSApplication;Password=***REMOVED***;...`. Do not query this without explicit user instruction.
- **Query tool used:** `sqlcmd` (Microsoft SQL Server command-line tool), confirmed installed and on PATH at `C:\Program Files\Microsoft SQL Server\...`. Example invocation used throughout:
  ```
  sqlcmd -S 192.168.50.200 -U sa -P '***REMOVED***' -d myps_db -C -Q "<query>" -s "|" -W -h -1
  ```
  `-C` trusts the server cert (needed, `TrustServerCertificate=True` in the connection string). For queries with embedded double-quotes/escaping that fight with Git Bash quoting, write the SQL to a scratch `.sql` file and use `-i <path>` instead of `-Q`.
- All DB access this session was **read-only** (`SELECT`, `INFORMATION_SCHEMA`, `sp_helptext`) except for the final, incomplete attempt to actually create a database clone (§6) — that attempt did not get past preliminary read-only diagnostics before being interrupted.
- **PCMA DB** (`ConnectionStrings:PCMADb`) exists but was not touched at all this session.

---

## 3. `RevisionController.cs` — structure and business workflow

File: `WebAPI/Controllers/Revision/RevisionController.cs`, 3180 lines, namespace `WebAPI.Controllers.Revision`, class `RevisionController : CoreController`, route `api/[controller]/[action]`.

**Business context:** DPWH's GAA-R (General Appropriations Act – Revision) change-request workflow for infrastructure projects that have already been approved/published. A "revision" is a proposed edit to specific fields of an approved project, gated by:

- **Field-level permission rules**: `tRevisionRules.Field` holds a JSON blob per revision-reason + PCMA construction-status + package-status combination. Deserialized into `ModificationRules` (`DBHelper/Models/Table/ModificationRules.cs`) with 6 sub-rule objects (`ProjectDetailsRules`, `ComponentCostRules`, `ComponentCostYearRules`, `MajorItemOfWorkRules`, `MajorItemLocationRules`, `FundingProfileRules`). Each (except `ProjectDetailsRules`, which is flat) has a `Fields` bag of per-column booleans and a `CRUD` block (`CanAdd`/`CanDelete`). A reflection-based helper `UpdateRevisionData<TSrc,TDest>()` (`Helpers/Functions.cs:733`) copies only allowed field names from the submitted DTO onto the tracked/destination entity and auto-generates `RevisionTransactionLog` audit rows per changed field. **Mechanism detail that matters for bug-hunting:** it does exact string `GetProperty(key)` reflection lookups on both source and destination types — a name that doesn't match either type is silently skipped, no error, no log.
- **Two-tier approval status** (as coded — see §4 for how this differs from the live DB): `EnumRevisionStatus` (Pending=0, Approved=1, Rejected=2, ForCorrection=3) tracked independently as `RegionStatus`/`COStatus` on `tRevisionDetails`. Actor resolved from `_Session.UserGroupNames`: `"RPC"` = Regional/RO reviewer, `"AUC"` = Central Office/CO reviewer, otherwise = submitting IO user.
- **Special revision categories** (`RevisionGroupId`): 9 = Termination (marks components terminated in `tRevisionDetailsComponentsStatus`), 13 = Mode of Implementation (forks the project into `"{ProjectId}-A"`).
- **Authorization**: every action is `[AllowAnonymous]`, no class-level `[Authorize]` — access control is entirely `_Session.UserGroupNames`-based, not enforced by the ASP.NET pipeline.

**Endpoints** (all `POST api/Revision/{action}`):

| Endpoint | Line | Purpose |
|---|---|---|
| `RevisionRequests` | 39 | Paginated/filtered queue listing via TVF `fRevisionQueue(@Level)` |
| `ViewReviseProject` | 136 | Loads an in-progress revision draft by `TransactionId` via `fRevisionProjectDetails`, `vRevisionLists`, `vRevisionRules` |
| `ReviseProject` | 375 | Loads the live/published project via `fProjectDetails` to start a new revision — **currently crashes, see §4** |
| `RequestRevision` | 609 (DTO `RequstRevisionsDTO` — typo in name) | Submits a new revision |
| `UpdateRevisionStatus` | 1725 | RO/CO approve/reject/return-for-correction |
| `ResubmitRevision` | 1933 | IO resubmits after ForCorrection |

---

## 4. CRITICAL — the live DB schema has moved on ahead of the code

This is the single most important finding of the session and should be resolved before any bug-fixing work here.

**What was found:** direct queries against the dev DB (`192.168.50.200`) prove the Formal Revision tables have already been migrated to a new, relational-FK-based schema that `RevisionController.cs` and its EF models (`DBHelper/Models/Table/Revision/*.cs`) do not know about:

- `tRevisionDetails` **has no `RegionStatus`/`COStatus` columns** (verified: `SELECT TOP 1 RegionStatus, COStatus FROM tRevisionDetails` → `Msg 207: Invalid column name 'RegionStatus'`/`'COStatus'`). Live columns: `Id, TransactionId, ProjectFK, ProjectRevisionFK, ProgramId, RevisionGroupId, CategoryId, ReasonId, IODocApprovalDate, IODocPath, IsCertified, CreatedBy, CreatedDate`. The two-tier status the whole controller is built around does not exist here.
- `tRevisionProjectComponentCost`, `...PerYear`, `tRevisionProjectFundingProfile`, `tRevisionProjectMajorWorkItem`, `tRevisionProjectMajorWorkLocations` **have no `TransactionId`/`ComponentId`** — verified the same way. They're now keyed by `RevisionDetailFK` (int → `tRevisionDetails.Id`), `RevisionComponentCostFK` (int → `tRevisionProjectComponentCost.Id`), and `RevisionWorkItemFK` (int → `tRevisionProjectMajorWorkItem.Id`) respectively.
- A new table `tRevisionProjectSnapshot` exists (`RevisionDetailFK`, `ProjectId`, same project-header columns as `tRevisionProjects`) — the new home for the "editable project snapshot," keyed by `RevisionDetailFK`.
- **`vRevisionLists` and `vRevisionRules` — queried directly by the controller — no longer exist at all** (`INFORMATION_SCHEMA.COLUMNS` returns 0 rows for both).
- A whole new function-based API exists instead: `fRevisionDetail`, `fRevisionComponentCost`, `fRevisionComponentCostPerYear`, `fRevisionFundingProfile`, `fRevisionMajorWorkItem`, `fRevisionMajorWorkLocations`, `fRevisionDocuments`, `fRevisionApprovalStatus`, `fRevisionApprovalTrail`, `fRevisionCorrectionHistory`, `fOpenRevision`, `fProjectEffectiveRevision`, `fRevisionRuleFor(@ReasonId, @PCMA_Status, @Package_Status)` (the `vRevisionRules` replacement — same columns as `tRevisionRules` plus `IsActive = 1` filter, but missing the `Reason`/`RevisionGroupId` text join the old view provided).
- `tRevisionProjects` and `tRevisionRules` are the **only** two revision tables whose live shape still matches the EF models/controller.

**The six `fProject*` functions asked about in step 5** (`fProjectDetails`, `fProjectFundingProfile`, `fProjectComponentCost`, `fProjectComponentCostPerYear`, `fProjectMajorWorkItem`, `fProjectMajorWorkLocations`) all exist, all have signature `(@ProjectPK NVARCHAR(200), @StageId INT)`, and are **fine** — they implement a "revision-aware overlay" (a CTE determines whether an approved-and-not-superseded revision exists via `fProjectEffectiveRevision`, then `UNION ALL`s a `Source='Revision'` branch reading the new FK-chained tables with a `Source='Base'` branch reading plain lifecycle tables). Full `sp_helptext` for all six was captured during the session (not reproduced here for brevity — re-run `sp_helptext '<name>'` against the dev DB if needed).

**Confirmed live crash bug, independent of the above:** `ReviseProject` (`RevisionController.cs:380-381`) calls `FROM fProjectDetails({dto.ProjectId})` with **one** argument; the function needs two. Reproduced directly:
```sql
SELECT * FROM fProjectDetails('TEST')
→ Msg 313: An insufficient number of arguments were supplied for the procedure or function fProjectDetails.
```
Every call to this endpoint throws and is caught by the generic exception handler. All 5 other `fProject*` call sites in the controller correctly pass 2 arguments — only this one is wrong.

**Root cause identified:** `documents/docs/formal-revision/MYPS_FORMAL_REVISION_REDESIGN_AND_MIGRATION_PLAN.md` (dated 2026-08-11) documents exactly this redesign. Its header states **"Status: Planning baseline"** and **"Implementation authorization: Not granted by this document."** It lists the same in-scope tables, keeps `tRevisionRules`/`vRevisionRules`/`fRevisionRuleFor` as "must remain unchanged" dependencies, and states invariants like *"`TransactionId` is a business/idempotency identifier at the root. It must not be the physical child-table parent key"* and *"A Formal Revision child belongs to one `tRevisionDetails.Id` through `RevisionDetailFK`."* This matches the live schema almost exactly.

**Open question, unresolved, needs a human/team decision — not something to guess at:** the schema described in a document that explicitly says implementation was "not granted" is already deployed on the shared dev box this branch's dev config points to, while the code on this branch is written entirely against the pre-migration schema. Possible explanations, none confirmed: (a) someone deployed ahead of the plan's authorization gate on the shared dev server; (b) this dev box is a sandbox for the redesign work and isn't meant to be this branch's target right now; (c) there's a newer status update superseding "Not granted" that wasn't found. **Do not assume which one it is — surface this to the user/team before doing substantial rewrite work on the controller.**

---

## 5. Full bug list (consolidated, ranked)

All file:line references are in `WebAPI/Controllers/Revision/RevisionController.cs` unless noted. "DB-verified" = confirmed by live query, not just static reading.

### Blocking

1. **[DB-verified] Live schema drift** — see §4 in full. Needs a team decision before further fixes here are worthwhile.
2. **[DB-verified] `ReviseProject` always throws** — missing function argument, see §4.

### High — silent data loss / corruption (assuming the current/old schema stays the target)

3. `RequestRevision`, line 1080: `if (ComponentCostRules.Count > 0)` should be `ComponentCostPerYearRules.Count > 0` (line 1072 also reads the wrong `.CanDelete`). Existing `ComponentCostPerYear` rows silently dropped from the new revision whenever the ComponentCost rule set has zero editable fields.
4. `RequestRevision`, line 1255: `MajorWorkItemRules.UpdateRevisionData(...)` called instead of `MajorItemLocationsRules` (also wrong at 1247, 1253). No Major Work Location field edit is ever applied — request succeeds, edit silently discarded.
5. `ComponentCostPerYear.Year` dropped on insert in 3 of 4 code paths: `RequestRevision` update path (`AddRow`, 1085-1096), `RequestRevision` insert path (1129-1138), `ResubmitRevision` insert path (2681-2691) — none set `Year`; persists as `0`. Only `ResubmitRevision`'s update-in-place path (2570-2664) is correct.
6. **[DB-verified against 347 live rows]** `ModificationRules`/`Field*` classes use stale property names — see §7 for the full, definitive breakdown.

### Medium

7. `UpdateRevisionStatus`, line 1731: `(x.RegionStatus != Rejected || x.COStatus != Rejected)` — De Morgan inversion; only excludes a transaction rejected on **both** sides. Likely should be `&&`.
8. RevisionGroupId-13 ("-A" project fork) malformed two different ways in two duplicated code paths: `RequestRevision` (~1399-1402) omits the suffix (PK collision risk); `UpdateRevisionStatus` (~1805-1841) double-appends it (`"-A-A"`).
9. `ResubmitRevision`, line 3173: catches only `DbUpdateException` instead of `Exception` like its siblings — other exception types skip rollback and the exception handler.
10. `ResubmitRevision`, line 2667: gates new `ComponentCostPerYear` inserts on `ComponentCostRules.CRUD.CanAdd` instead of `ComponentCostYearRules.CRUD.CanAdd`.
11. `ResubmitRevision` MajorWorkLocations block (~2829-2857): `CanDelete`/count guard reads `MajorItemOfWorkRules` instead of `MajorItemLocationRules` — milder than #4, the actual copy call here is correct.

### Low

12. `RevisionRequests`, lines 56-61: `ProjectId` filter branch builds the same clause/param as the `TransactionId` branch above it — filtering by `ProjectId` alone silently re-applies the `TransactionId` filter instead.
13. `ViewReviseProject`, line 150: `if (_Session.ApplyFilter && Project.Region == _Session.RegCode) return ...Permission Denied` reads inverted (denies when region *matches*). Not independently re-verified — confirm `ApplyFilter`/`RegCode` intent before fixing.
14. `ResubmitRevision`: several `if (OldXxx != null)` checks guard an object just constructed via `new` two lines earlier — always true, dead code, not functional.
15. Design note: `[AllowAnonymous]` everywhere, no `[Authorize]` — consistent pattern, worth confirming deliberate given these mutate approval state.

---

## 6. `tRevisionRules.Field` — definitive Fields-column ↔ table-column linkage map

This is the most recently completed, most concrete, independently-actionable piece of work from this session — it does **not** depend on resolving the schema-drift question in §4, because `tRevisionRules` itself and the six `tRevisionProject*` tables it's meant to govern (in their *pre-migration* shape, which is what `ModificationRules.cs` targets) were both directly inspected.

**Live data facts:** `tRevisionRules` has 347 rows, all `IsActive = 1`, spanning 47 distinct `ReasonId` values × 4 distinct `PCMA_Status` values × 2 distinct `Package_Status` values ("Packaged"/"Not Packaged"). Table itself is untouched by the §4 migration (same 6 columns as the EF entity: `Id, ReasonId, PCMA_Status, Package_Status, Field, IsActive`).

**Method:** every property in each `ModificationRules`/`Field*` class (`DBHelper/Models/Table/ModificationRules.cs`) was checked against the live `INFORMATION_SCHEMA.COLUMNS` for its corresponding table. Any "gap" (a live column with no Fields-flag, or a Fields-flag with no live column) was further checked against all 347 rows' actual JSON content, to distinguish a real bug from a deliberate design choice.

| Rule class | Table | Result |
|---|---|---|
| `RuleProjectDetails` (23 flat props, no `Fields`/`CRUD` wrapper) | `tRevisionProjects` (38 cols) | **22/23 match exactly.** `UACS` is broken — see below. 5 live columns (`ExternalId, MYId, AlternateId, IslandCode, Rank`) have no flag and never appear in any of the 347 rows — consistently absent both sides, presumably PCMA/system-derived, not a bug. |
| `FieldComponentCost` (4 props) | `tRevisionProjectComponentCost` (7 cols) | **Fully clean, 4/4 match** (`ComponentType, ComponentId, Description, Total`). |
| `FieldComponentCostYear` (4 props) | `tRevisionProjectComponentCostPerYear` (9 cols) | 3/4 match (`Year, Amount, StartDate, EndDate`). **Missing a `UACS` property** — live column exists, and the live JSON sets `"UACS":true` on **all 347/347 active rules** — real, high-impact, easy fix (add the property). `DateOfApproval` (live column) has no flag and never appears in any rule — deliberate, not a bug. |
| `FieldFundingProfile` (4 props) | `tRevisionProjectFundingProfile` (8 cols) | 2/4 match (`Amount, Percentage`). `Source`/`Agreement` are wrong names — should be `SourceOrg`/`AgreementCode` (65/347 active rules set these `true`, silently dropped). `IsWalletDraw` (live column) has no flag and never appears in any rule — ties to the migration plan's note that *"LS/wallet Project behavior remains an open decision"* — looks deliberate. |
| `FieldMajorItemOfWork` (4 props) | `tRevisionProjectMajorWorkItem` (7 cols) | 2/4 match (`ComponentId, YearOfWork`). `WorkTypeId`/`InfraType` wrong — should be `WorkTypeFK`/`InfraTypeFK` (60/347 active rules affected). |
| `FieldMajorItemLocation` (14 props) | `tRevisionProjectMajorWorkLocations` (17 cols) | **Fully clean, 14/14 match exactly.** No gaps. |

**On `RuleProjectDetails.UACS` specifically:** this is *not* a rename-target bug like the others. `tRevisionProjects` has **no `UACS` column at all**, and no rule (of 347) ever sets a top-level `"UACS"` key inside `ProjectDetailsRules` (only inside `ComponentCostYearRules.Fields`, the legitimate one). This looks like dead/abandoned code — consistent with an already-commented-out `//NewRevisionProject.UACS = ProjectRevision.UACS;` line in the controller (`RequestRevision`, ~line 859). Correct fix is almost certainly to **delete** this property, not add a column for it.

**Exact fix list for `DBHelper/Models/Table/ModificationRules.cs`:**

1. `FieldFundingProfile.Source` → rename to `SourceOrg`
2. `FieldFundingProfile.Agreement` → rename to `AgreementCode`
3. `FieldMajorItemOfWork.WorkTypeId` → rename to `WorkTypeFK`
4. `FieldMajorItemOfWork.InfraType` → rename to `InfraTypeFK`
5. `FieldComponentCostYear` → add missing `public bool UACS { get; set; }`
6. `RuleProjectDetails.UACS` → remove (dead property)

`FieldComponentCost` and `FieldMajorItemLocation` need no changes. **This fix list is ready to implement as-is** and is independent of the bigger §4 schema question — these are pure C# property renames/additions in one file, matching the pre-migration schema that's still what `RevisionController.cs`, the DTOs, and (for now) `tRevisionRules`'s consuming code all target.

Real-world impact of leaving these unfixed (quantified against the 347 active rules):

| Flag | Rules with it set `true` |
|---|---|
| `WorkTypeFK` | 60/347 |
| `InfraTypeFK` | 60/347 |
| `SourceOrg` | 65/347 |
| `AgreementCode` | 65/347 |
| `UACS` (ComponentCostYear) | 347/347 — universal |

---

## 7. Interrupted action — NOT completed, needs explicit re-instruction

The user's most recent actionable request before asking for this handoff was:

> "create a clone and make sure it is our working db myps_db_revision"

**Intent (as understood, not confirmed with the user):** clone the dev `myps_db` database (at `192.168.50.200`) into a new database named `myps_db_revision`, and make that the "working" database going forward — most likely meaning updating `Main/appsettings.Development.json`'s `MYPSDb` connection string to point at `myps_db_revision` instead of `myps_db`, so that further investigation/testing/fixes don't touch the shared dev database other developers may be using.

**What actually happened:** a first diagnostic Bash tool call was issued (listing existing databases via `sys.databases`, checking `myps_db`'s file sizes/paths via `sys.database_files`, and checking the server's default data/log paths via `SERVERPROPERTY`) — **this tool call was rejected/interrupted by the user before it ran.** Nothing was created, modified, or queried as part of this specific request. `myps_db_revision` **does not exist** (as of this writing — verify with `SELECT name FROM sys.databases WHERE name = 'myps_db_revision'` before assuming either way, since state may have changed).

**What still needs to happen if this is picked back up:**

1. Confirm with the user the exact scope of "make sure it is our working db" — specifically whether it means only *creating* the database (so it exists for direct querying/testing), or *also* editing the checked-in `Main/appsettings.Development.json` connection string (a git-tracked file affecting whatever else uses that config) to point at it. This is a real fork in scope that wasn't resolved.
2. On a standard on-prem SQL Server (confirmed: SQL Server 2022 Developer Edition, not Azure SQL, so no `CREATE DATABASE ... AS COPY OF`), the standard clone method is `BACKUP DATABASE myps_db TO DISK = '<server-side-path>'` then `RESTORE DATABASE myps_db_revision FROM DISK = '<same-path>' WITH MOVE '<logical-data-file>' TO '<new-server-side-.mdf-path>', MOVE '<logical-log-file>' TO '<new-server-side-.ldf-path>'`. These paths are **on the SQL Server host's own disk**, not the machine running sqlcmd — the diagnostic query that was about to run (before being interrupted) was checking `SERVERPROPERTY('InstanceDefaultDataPath')`/`InstanceDefaultLogPath` and `sys.database_files` for exactly this reason. Re-run that check before attempting the backup/restore.
3. Check available disk space on the SQL Server host before backing up (not checked yet).
4. This is a shared dev SQL Server other developers may use — creating a new multi-GB database on it is a real, if low-risk and reversible (`DROP DATABASE`), action with a footprint beyond just this session. Treat it as worth a quick confirmation with the user on approach before executing, even though the original request was fairly explicit — the *method* (how much disk, whether to also touch the checked-in config file) wasn't nailed down.
5. Given §4's finding that the *live* `myps_db` schema is already ahead of what the controller code expects, cloning `myps_db` as-is will produce a `myps_db_revision` with the **same** already-migrated (FK-based) schema, not the older schema the controller currently targets. If the actual goal is to get a working dev DB that matches the controller's current expectations, a straight clone of `myps_db` will **not** achieve that — this is worth surfacing to the user, since it may change what "working db" should even mean here (a clone of current `myps_db`, vs. a clone rolled back to pre-migration state, vs. something else).

---

## 8. Key file reference

- `WebAPI/Controllers/Revision/RevisionController.cs` — the controller itself (3180 lines)
- `WebAPI/Controllers/Revision/DTORevision.cs` — all request DTOs (`RequstRevisionsDTO`, `ResubmitRevisionDTO`, `UpdateRevisionStatusDTO`, etc.)
- `DBHelper/Models/Table/ModificationRules.cs` — the `Field*`/`Rule*` classes deserializing `tRevisionRules.Field`; the file needing the §6 fixes
- `DBHelper/Models/Table/Revision/*.cs` — EF entities for `tRevisionDetails`, `tRevisionProjects`, `tRevisionProjectComponentCost(PerYear)`, `tRevisionProjectFundingProfile`, `tRevisionProjectMajorWorkItem`, `tRevisionProjectMajorWorkLocations`, `tRevisionTransactionLog`, `tRevisionDocuments`, `tRevisionForCorrectionDetails`, `tRevisionRules`, etc. — these reflect the **pre-migration** schema (see §4)
- `DBHelper/Models/Views/RevisionRules.cs`, `DBHelper/Models/Views/RevisionLists.cs` — EF models for the now-nonexistent `vRevisionRules`/`vRevisionLists` views
- `DBHelper/Models/Functions/Project/*.cs` — EF shapes for the six `fProject*` functions (confirmed accurate against live definitions)
- `Helpers/Functions.cs:733` — `UpdateRevisionData<TSrc,TDest>()`, the reflection-based field-copy mechanism
- `documents/docs/formal-revision/MYPS_FORMAL_REVISION_REDESIGN_AND_MIGRATION_PLAN.md` — the migration plan, "Not granted" for implementation as of 2026-08-11, but apparently already (partially) deployed on the dev DB
- `documents/docs/architecture/database/MYPS_FORMAL_REVISION_SCHEMA_V2_SAMPLE.sql` — exploratory sample referenced by the plan, marked "SUPERSEDED SCOPE NOTICE — DO NOT DEPLOY"
- `Main/Resources/Internal/SQLScripts/Revision.Queue.sql`, `Revision.Queue.Verification.sql` — SQL scripts reflecting the newer three-tier redesign, don't match the EF `RevisionQueue.cs` shape the controller expects
- `Main/LOCAL-MYPS(table-schema).sql` — a static schema dump, confirmed **stale** relative to both the EF models and the live DB; not reliable as a source of truth
- `Main/appsettings.Development.json` / `Main/appsettings.json` — dev vs. prod connection strings, see §2
- `memory/2026-08-13-revision-controller-analysis.md` — the technical-findings-only version of this document, built incrementally during the session

---

## 9. Suggested next steps (not yet decided by the user — present as options, don't assume)

1. Resolve the §4 schema-target question with the team/plan owner before investing in controller fixes that assume either schema.
2. If the pre-migration schema stays the target (at least for now): implement the §6 fix list (`ModificationRules.cs`, 6 small changes, no ambiguity) and the §5 High-severity bugs (#3, #4, #5) via the repo's documented `/create-plan` → `/implement-task` → `/code-review` pipeline (see root `CLAUDE.md`).
3. Fix the live-verified `ReviseProject` crash (§4, bug #2) regardless of the schema decision — it's broken either way and the fix (pass `@StageId`) is small, though what value to pass depends on resolving whether `StageId` in the new schema means the same thing it did before.
4. Decide on the `myps_db_revision` clone (§7) — needs a scope decision and a resumed, careful execution (disk-space check, server-side path check, confirm blast radius on the shared dev box) before proceeding.
