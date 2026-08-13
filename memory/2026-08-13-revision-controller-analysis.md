# Analysis — RevisionController.cs & myps_db Revision Schema — 2026-08-13

## Master issues list (consolidated, ranked)

All file:line references are in `WebAPI/Controllers/Revision/RevisionController.cs` unless noted. "DB-verified" = confirmed by direct query against the live dev DB (`192.168.50.200`), not just static reading.

### Blocking — the controller does not work against the current dev DB target

1. **[DB-verified] Live schema drift.** `tRevisionDetails` has no `RegionStatus`/`COStatus` columns (the two-tier status this entire controller is built around). The child draft tables (`tRevisionProjectComponentCost`, `...PerYear`, `...FundingProfile`, `...MajorWorkItem`, `...MajorWorkLocations`) have no `TransactionId`/`ComponentId` — they're keyed by `RevisionDetailFK`/`RevisionComponentCostFK`/`RevisionWorkItemFK` instead. `vRevisionLists` and `vRevisionRules`, which the controller queries directly, don't exist at all. Root cause: `documents/docs/formal-revision/MYPS_FORMAL_REVISION_REDESIGN_AND_MIGRATION_PLAN.md` (2026-08-11, "Implementation authorization: Not granted by this document") appears to already be deployed on this dev box. **Needs a team decision before anything else here is fixed** — see "Next step."
2. **[DB-verified] `ReviseProject` always throws.** Line 380-381 calls `fProjectDetails({dto.ProjectId})` with 1 argument; the function requires 2 (`@ProjectPK`, `@StageId`). Confirmed live: `Msg 313: An insufficient number of arguments were supplied for the procedure or function fProjectDetails.` Every call to this endpoint fails.

### High — silent data loss / corruption (assuming current schema stays the target)

3. `RequestRevision`, line 1080: `if (ComponentCostRules.Count > 0)` should be `ComponentCostPerYearRules.Count > 0` (line 1072 also reads the wrong `CanDelete`). Existing ComponentCostPerYear rows are silently dropped from the new revision whenever the ComponentCost rule set has zero editable fields.
4. `RequestRevision`, line 1255: `MajorWorkItemRules.UpdateRevisionData(...)` called instead of `MajorItemLocationsRules` (also wrong at lines 1247, 1253). No Major Work Location field a user edits is ever applied — request succeeds, edit is silently discarded.
5. `ComponentCostPerYear.Year` dropped on insert in 3 of 4 code paths: `RequestRevision` update path (`AddRow`, lines 1085-1096), `RequestRevision` insert path (lines 1129-1138), `ResubmitRevision` insert path (lines 2681-2691) — none set `Year`, so new rows persist with `Year = 0` regardless of what was submitted. Only `ResubmitRevision`'s update-in-place path (lines 2570-2664) is correct.
6. **[DB-verified against 347 live rules]** `ModificationRules`/`Field*` classes (`DBHelper/Models/Table/ModificationRules.cs`) use stale property names that don't match the DTOs/entities/live JSON: `FieldFundingProfile.Source`/`.Agreement` should be `SourceOrg`/`AgreementCode` (65/347 active rules set these `true`, silently ignored); `FieldMajorItemOfWork.WorkTypeId`/`.InfraType` should be `WorkTypeFK`/`InfraTypeFK` (60/347 rules affected); `FieldComponentCostYear` is missing a `UACS` property that exists in the live JSON and is set `true` on **all 347/347 active rules**, universally ignored; `RuleProjectDetails.UACS` also has no matching property on the `ProjectDetails` class (consistent with an already-commented-out assignment in the controller).

### Medium

7. `UpdateRevisionStatus`, line 1731: `(x.RegionStatus != Rejected || x.COStatus != Rejected)` — De Morgan's law means this only excludes a transaction rejected on **both** sides; one rejected on just one side still passes the "actionable" filter. Likely should be `&&`.
8. RevisionGroupId 13 ("Mode of Implementation") project fork produces a malformed key two different ways in two duplicated code paths: `RequestRevision` (~line 1399-1402) omits the `"-A"` suffix (PK collision risk with the parent); `UpdateRevisionStatus` (~line 1805-1841) double-appends it, producing `"{original}-A-A"`.
9. `ResubmitRevision`, line 3173: catches only `DbUpdateException` instead of `Exception` like its sibling endpoints — other exception types skip `_exceptionHandler.Handle` and skip `transaction.RollbackAsync()`.
10. `ResubmitRevision`, line 2667: gates new ComponentCostPerYear inserts on `jsonRules.ComponentCostRules.CRUD.CanAdd` instead of `ComponentCostYearRules.CRUD.CanAdd`.
11. `ResubmitRevision` MajorWorkLocations block (~2829-2857): `CanDelete`/count guard reads `MajorItemOfWorkRules` instead of `MajorItemLocationRules` — milder than #4 since the actual field-copy call here is correct.

### Low

12. `RevisionRequests`, lines 56-61: the `ProjectId` filter branch builds the same clause/param as the `TransactionId` branch above it — filtering by `ProjectId` alone has no effect, it silently re-filters by `TransactionId` instead.
13. `ViewReviseProject`, line 150: `if (_Session.ApplyFilter && Project.Region == _Session.RegCode) return ...Permission Denied` reads inverted for a permission-denied check (denies when region *matches*). Not independently re-verified against `ApplyFilter`/`RegCode` semantics — confirm intent before fixing.
14. `ResubmitRevision`: several `if (OldXxx != null)` checks (FundingProfile ~2298-2308, ComponentCost ~2437-2445, ComponentCostPerYear ~2572-2583, MajorWorkItem ~2710-2719, MajorWorkLocations ~2833-2853) guard an object that was just constructed via `new` two lines earlier — always true, dead code, not a functional bug.
15. Design note: every action in the controller is `[AllowAnonymous]` with no class-level `[Authorize]` — access control is entirely `_Session.UserGroupNames`-based rather than enforced by the ASP.NET auth pipeline. Consistent throughout, but worth confirming this is deliberate given these are state-mutating approval endpoints.

## Scope

Full read-through of `WebAPI/Controllers/Revision/RevisionController.cs` (3180 lines, all 6 actions) cross-referenced against the `myps_db` schema. **Update:** the dev DB (`192.168.50.200`) was unreachable for the initial pass but became reachable later in this investigation — see the "CRITICAL — live schema check" section below for direct, DB-verified findings that supersede some of the inference-based notes in this section. Initial schema understanding (before live access) was based on:

- EF Core model classes: `DBHelper/Models/Table/Revision/*.cs`, `DBHelper/Models/Views/*.cs`, `DBHelper/Models/Functions/Revision/*.cs`, `DBHelper/Models/Functions/Project/*.cs`
- `DBHelper/Data/MYPSDbContext.cs` (DbSet declarations)
- `Main/LOCAL-MYPS(table-schema).sql` (2453 lines — **stale**, see note below)
- `Main/Resources/Internal/SQLScripts/Revision.Queue.sql` (146 lines) and `Revision.Queue.Verification.sql` (103 lines)
- `documents/docs/architecture/database/MYPS_FORMAL_REVISION_SCHEMA_V2_SAMPLE.sql` (524 lines — marked "SUPERSEDED SCOPE NOTICE — DO NOT DEPLOY")

**Note on schema drift:** the raw schema dump (`LOCAL-MYPS(table-schema).sql`) does not match the current EF models/controller code (e.g. its `tRevisionProjects` is missing `ProjectFK`/`ProgramFK`/`ProgramId`/`CreatedBy`/`CreatedDate` columns the controller actively reads/writes). The EF models were treated as source of truth. Separately, `Revision.Queue.sql` and the formal V2 schema sample describe a newer three-tier IO/RO/CO approval redesign (numeric status codes, `fRevisionApprovalStatus`, dated 2026-08-11) that **the live controller does not yet implement** — it still runs the older two-tier `EnumRevisionStatus` model. This is an in-flight migration; the two artifacts are not currently in sync.

## Business workflow

DPWH's **GAA-R (General Appropriations Act – Revision)** change-request workflow for already-approved infrastructure projects.

- **Field-level permission rules**: `tRevisionRules.Field` holds a JSON blob per revision-reason + PCMA construction-status + package-status combination, exposed read-only via view `vRevisionRules`. Deserialized into `ModificationRules` (`DBHelper/Models/Table/ModificationRules.cs`) with sub-rule objects (`RuleProjectDetails`, `RuleComponentCost`, `RuleComponentCostYear`, `RuleMajorItemOfWork`, `RuleMajorItemLocation`, `RuleFundingProfile`), each with a `Fields` bag of per-column booleans and a `CRUD` block (`CanAdd`/`CanDelete`). A reflection-based helper `UpdateRevisionData<TSrc,TDest>()` (`Helpers/Functions.cs:733`) copies only allowed fields from the submitted DTO onto the tracked entity and auto-generates `RevisionTransactionLog` audit rows per changed field.
- **Two-tier approval**: `EnumRevisionStatus` (Pending=0, Approved=1, Rejected=2, ForCorrection=3) tracked independently as `RegionStatus` and `COStatus` on `tRevisionDetails`. Actor resolved from `_Session.UserGroupNames`: `"RPC"` = Regional/RO reviewer, `"AUC"` = Central Office/CO reviewer, otherwise = submitting IO user. CO approval of a revision submitted directly by a CO user auto-approves both tiers.
- **Special revision categories** (`RevisionGroupId`): **9 = Termination** (marks affected components' construction status terminated in `tRevisionDetailsComponentsStatus`), **13 = Mode of Implementation** (forks the project into a new `"{ProjectId}-A"` project record).
- **Authorization model**: every single action carries `[AllowAnonymous]` with no class-level `[Authorize]` — access control is entirely application-managed via `_Session.UserGroupNames`, not the ASP.NET auth pipeline.

## Endpoints

All `POST api/Revision/{action}`.

| Endpoint | Line | Purpose |
|---|---|---|
| `RevisionRequests` | 39 | Paginated/filtered queue listing via TVF `fRevisionQueue(@Level)` and `_db.FilterDataCursor<RevisionQueue, RevisionRequestsFilter>` |
| `ViewReviseProject` | 136 | Loads an in-progress revision draft by `TransactionId` via `fRevisionProjectDetails`, `vRevisionLists`, `vRevisionRules` |
| `ReviseProject` | 375 | Loads the live/published project via `fProjectDetails` to seed a brand-new revision form |
| `RequestRevision` | 609 (DTO: `RequstRevisionsDTO` — typo in DTO name) | Submits a new revision: opens a DB transaction, validates project/program, resolves rules, diffs submitted sub-entities against live `fProject*` data, stages `RevisionProject*` draft rows + audit log, writes `tRevisionDetails` header, uploads approved document, applies Group 9/13 side effects if CO, deactivates prior active draft, commits |
| `UpdateRevisionStatus` | 1725 (DTO: `UpdateRevisionStatusDTO`) | RO/CO approve / reject / return-for-correction. Flips `RegionStatus`/`COStatus`, re-runs Group 9/13 side effects on CO approval, writes `tRevisionForCorrectionDetails` on ForCorrection |
| `ResubmitRevision` | 1933 (DTO: `ResubmitRevisionDTO`) | IO resubmits after ForCorrection — edits existing tracked `tRevisionProject*` draft rows in place (not the live project), resets status to Pending |

## DB objects (myps_db)

### Tables

| Table | Purpose | Keys |
|---|---|---|
| `tRevisionDetails` | Revision transaction header — approval status (`RegionStatus`, `COStatus`), approver/date per tier, `RevisionGroupId`, `ReasonId`, `CategoryId` | `TransactionId` is the business key shared by all child tables |
| `tRevisionProjects` | Draft revised project snapshot (Description, Category, Origin, location fields, Tier, etc.) + `IsActive` (one active draft per ProjectId) + `RevisionId` | `TransactionId` → `tRevisionDetails`; `ProjectId`/`ProjectFK` → `tProjects` |
| `tRevisionProjectFundingProfile` | Draft funding-source rows (SourceOrg, AgreementCode, Amount, Percentage) | `TransactionId` |
| `tRevisionProjectComponentCost` | Draft component cost rows (ComponentType, ComponentId, Description, Total) | `TransactionId`, `ComponentId` |
| `tRevisionProjectComponentCostPerYear` | Draft component cost by year (Amount, StartDate/EndDate, UACS) | `TransactionId`, `ComponentId` |
| `tRevisionProjectMajorWorkItem` | Draft major work items (YearOfWork, WorkTypeFK, InfraTypeFK) | `TransactionId`, `ComponentId` |
| `tRevisionProjectMajorWorkLocations` | Draft work-item locations (InfraId, coordinates, chainages, PhysicalTarget) | `TransactionId`, `ComponentId` |
| `tRevisionTransactionLog` | Field-level audit trail (`AffectedTable`, `AffectedColumn`, `OldValue`/`NewValue`, `TypeOfTransaction`) — populated entirely by `UpdateRevisionData<TSrc,TDest>()` | `TransactionId`, optional `ReferenceId` |
| `tRevisionDocuments` | Uploaded supporting documents; `IsApprovedDocument` distinguishes IO submission doc from CO approval doc | `TransactionId` |
| `tRevisionForCorrectionDetails` | One row per "sent back for correction" event; `IsCentralOffice` flags RO vs CO | `TransactionId` |
| `tRevisionDetailsComponentsStatus` | Construction-status override rows for Group 9 (Termination) / 13 (Mode of Implementation) | `TransactionId`, `ComponentId` |
| `tOptionRevisionHeader` | Revision category lookup (`RevisionGroupId` → `RevisionName`) | `RevisionGroupId` |
| `tOptionRevisionCategory` | Sub-category lookup under a `RevisionGroupId` | `CategoryId`, `RevisionGroupId` |
| `tOptionRevisionReasons` | Revision reason lookup, drives `vRevisionRules` | `ReasonId`, `RevisionGroupId` |
| `tOptionRevisionDocuments` | Document-naming convention per category/group | `CategoryId` or `RevisionGroupId` |
| `tOptionRevisionStatus` | Display name/description per `EnumRevisionStatus` value | `Enum` |
| `tRevisionRules` | Admin-editable source of the `ModificationRules` JSON (`Field` column) per reason/PCMA-status/package-status | exposed via `vRevisionRules` |

### Views

- `vRevisionRules` (`DBHelper/Models/Views/RevisionRules.cs`) — projection of `tRevisionRules` (`Reason`, `RevisionGroupId`, `ReasonId`, `PCMA_Status`, `Package_Status`, `Field`)
- `vRevisionLists` (`DBHelper/Models/Views/RevisionLists.cs`) — denormalized status list (joins `RevisionName`, `Reason`, status names, approver names); used for `ViewReviseProject` display and the "pending modification already exists" guard (queried via raw `TransactionId LIKE '{ProjectId}%'`)

### Functions (TVFs, all invoked via raw `FromSqlInterpolated`)

- `fRevisionQueue(@Level)` — powers `RevisionRequests`. Its SQL definition (`Revision.Queue.sql`) reflects the newer three-tier redesign (StatusCode, ApprovalOwner, IsTerminal/IsActionable, AgeDays, `CROSS APPLY fRevisionApprovalStatus`) and doesn't line up 1:1 with the EF shape (`RevisionQueue.cs`: `RevisionStatus`, `CurrentStage`, `Age`) the controller expects — further evidence of the schema/controller drift noted above.
- `fRevisionProjectDetails(TransactionId)` — full draft detail for `ViewReviseProject`
- `fPendingProjectComponentCost(TransactionId)` — components pending termination, used in `UpdateRevisionStatus` Group-9 branch
- `fProjectDetails`, `fProjectComponentCost`, `fProjectComponentCostPerYear`, `fProjectMajorWorkItem`, `fProjectMajorWorkLocations` — **live/published** project data (not revision-scoped), used as the diff baseline in `RequestRevision`/`ReviseProject`

## Bugs found (ranked by severity; ✅ = spot-verified directly against source)

1. **✅ Data loss — `RequestRevision`, ComponentCostYear block, line 1080.** `if (ComponentCostRules.Count > 0)` should be `if (ComponentCostPerYearRules.Count > 0)` — the wrong rule-list variable gates the entire update block, including `NewComponentPerYear.Add(AddRow)` (line 1096). Line 1072 also reads `jsonRules.ComponentCostRules.CRUD.CanDelete` instead of `ComponentCostYearRules.CRUD.CanDelete`. **Effect: whenever the ComponentCost rule set has zero editable fields, existing per-year cost rows are silently dropped from the new revision, regardless of the ComponentCostYear config.**
2. **✅ Edits silently discarded — `RequestRevision`, MajorWorkLocations block, line 1255.** `MajorWorkItemRules.UpdateRevisionData(...)` is called instead of `MajorItemLocationsRules` (the correctly-named list declared at line 1238). Line 1247 also reads `jsonRules.MajorItemOfWorkRules.CRUD.CanDelete` instead of `MajorItemLocationRules.CRUD.CanDelete`, and line 1253 guards on `MajorWorkItemRules.Count > 0` instead of `MajorItemLocationsRules.Count > 0`. Since the Major-Work-Item field names (`ComponentId`, `YearOfWork`, `WorkTypeId`, `InfraType`) don't exist on the Location DTO/entity, the reflection-based field copy matches nothing. **Effect: no Major Work Location field edit submitted by a user is ever applied — the request appears to succeed but the persisted row keeps its original values.**
3. **Malformed/colliding key — the "-A" project fork (RevisionGroupId 13, "Mode of Implementation").** `RequestRevision` (~line 1399-1402) computes `NewProjectId = "{ProjectId}-A"` but builds the new project row with `ProjectPK = ProjectFK` (the unsuffixed original key) — risk of PK collision with the parent project. `UpdateRevisionStatus` (~line 1805-1841) does the opposite: it overwrites `ProjectDetails.ProjectFK` with the suffixed value at line 1813, then appends `"-A"` again at line 1841, producing a double-suffixed `"{original}-A-A"` key. Same feature, two independently-diverged bugs across duplicated code paths. (Not independently re-verified line-by-line beyond the subagent's report; recommend confirming before fixing.)
4. **✅ Logic inversion — `UpdateRevisionStatus`, line 1731.** `x.TransactionId == dto.TransactionId && (x.RegionStatus != EnumRevisionStatus.Rejected || x.COStatus != EnumRevisionStatus.Rejected)`. By De Morgan's law this only excludes a row when **both** sides are Rejected simultaneously — a transaction rejected on just one side still passes the "is this actionable" filter. Almost certainly should be `&&`.
5. **Weaker error handling — `ResubmitRevision`, line 3173.** Catches only `DbUpdateException`, unlike `RequestRevision` (line 1716) and `UpdateRevisionStatus` (line 1924) which catch generic `Exception`. Any other exception type (e.g. a `NullReferenceException` from an unguarded `FirstOrDefault()` dereference) skips `_exceptionHandler.Handle` and skips `transaction.RollbackAsync()`.
6. **Wrong permission flag — `ResubmitRevision`, line 2667.** `if (jsonRules.ComponentCostRules.CRUD.CanAdd)` gates new `ComponentCostPerYear` row inserts — should read `jsonRules.ComponentCostYearRules.CRUD.CanAdd` (compare the correct version in `RequestRevision` line 1115).
7. **Milder guard mismatch — `ResubmitRevision` MajorWorkLocations block (~2829-2857).** Same wrong-list pattern as #2 (`MajorItemOfWorkRules.CRUD.CanDelete` / `MajorWorkItemRules.Count > 0` instead of the Location variants) for the `CanDelete`/guard check only — but the actual field-copy call at line 2857 correctly targets `MajorItemLocationsRules`, so this instance is milder (guard wrong, copy correct).
8. **✅ `RevisionRequests` filter bug, lines 56-61.** The `ProjectId` filter branch (`if (!string.IsNullOrWhiteSpace(dto.Filters.ProjectId))`) builds the same clause/param as the `TransactionId` branch above it (`"v.TransactionId = @TransactionId"`, using `dto.Filters.TransactionId` instead of `dto.Filters.ProjectId`) — filtering by ProjectId alone has no effect; it silently re-applies the TransactionId filter instead.
9. **`ViewReviseProject`, line 150.** `if (_Session.ApplyFilter && Project.Region == _Session.RegCode) return ... "Permission Denied"` — reads inverted for a permission-denied check (denies access when the region *matches* the user's region). Likely should be `!=`. Not independently re-verified beyond the subagent's report; recommend confirming intent before fixing, since `ApplyFilter`/`RegCode` semantics weren't fully traced.
10. **Cosmetic — `ResubmitRevision`.** Several sub-entity blocks (FundingProfile ~2298-2308, ComponentCost ~2437-2445, ComponentCostPerYear ~2572-2583, MajorWorkItem ~2710-2719, MajorWorkLocations ~2833-2853) build an `Old*` snapshot via `new SomeType {...}` and immediately check `if (OldXxx != null)`, which is always true since it was just constructed — dead code, not a functional bug, but reads as defensive code that isn't. Worth cleaning up opportunistically.

## Follow-up — `tRevisionRules.Field` (the `ModificationRules` JSON) audit

`tRevisionRules.Field` is a JSON blob deserialized into `ModificationRules` (`DBHelper/Models/Table/ModificationRules.cs`), containing 6 sub-rule groups, each with a `Fields` bag of per-column booleans (except `ProjectDetailsRules`, which is a flat bool bag with no `Fields`/`CRUD` wrapper) and (for the other 5) a `CRUD` block (`CanAdd`/`CanDelete`).

The mechanism that consumes these flags, `List<string>.UpdateRevisionData<TSrc,TDest>()` (`Helpers/Functions.cs:733`), works by exact **string property-name lookup via reflection**: for each enabled flag name in the `Fields` bag, it does `sourceType.GetProperty(key)` and `destType.GetProperty(key)` on the submitted DTO and the destination entity/view. If either type lacks a property with that *exact* name, the key is silently skipped — no error, no log, the original value is just never touched.

Cross-checked every `Field*` class's property names against the actual DTOs (`WebAPI/Controllers/Revision/DTORevision.cs`), the destination entities (`DBHelper/Models/Table/Revision/*.cs`), and the live-data function-view types used as the diff baseline in `RequestRevision` (`DBHelper/Models/Functions/Project/*.cs`). Result:

### Dead/no-op rule flags (name mismatch — toggling them in `tRevisionRules.Field` has zero effect, in any endpoint)

| Rule flag | Rule class expects | Actual property name (DTO/entity/view all agree) | Verified against |
|---|---|---|---|
| `FundingProfileRules.Fields.Source` | `Source` | `SourceOrg` | `RevisionFundingProfileDTO`, `RevisionProjectFundingProfile`, `ProjectFundingProfile` (note: `ProjectFundingProfile` *does* have an unrelated `Source` field — a data-provenance tag, not the funding source — but the DTO-side lookup already fails first, so it's moot) |
| `FundingProfileRules.Fields.Agreement` | `Agreement` | `AgreementCode` | same three types |
| `MajorItemOfWorkRules.Fields.WorkTypeId` | `WorkTypeId` | `WorkTypeFK` | `RevisionMajorWorkItemDTO`, `RevisionProjectMajorWorkItem`, `ProjectMajorWorkItem` |
| `MajorItemOfWorkRules.Fields.InfraType` | `InfraType` | `InfraTypeFK` | same three types |
| `ProjectDetailsRules.UACS` | `UACS` | **no such property exists anywhere** | `DBHelper/Models/Functions/Project/ProjectDetails.cs` (the type used as both source and destination for this rule group) has no `UACS` field at all. Consistent with the already-commented-out `//NewRevisionProject.UACS = ProjectRevision.UACS;` in `RequestRevision`. |

**Practical effect:** confirmed by reading the manual row-construction code that runs after each `UpdateRevisionData` call (e.g. `RequestRevision` lines 1002-1010 for ComponentCost, 1178-1186 for MajorWorkItem, 916-924 for FundingProfile) — since the reflection copy never touches `SourceOrg`/`AgreementCode`/`WorkTypeFK`/`InfraTypeFK`, the row that gets persisted always carries the **original/baseline value** for these four columns, never the value the user submitted in the revision request — no matter how `tRevisionRules.Field` is configured for these flags. This is the same class of bug as the already-documented MajorWorkLocations issue (#2 above), but rooted in the `Field*` class definitions themselves rather than a wrong-variable reference in the controller. `MajorItemLocationRules`/`FieldMajorItemLocation`, `ComponentCostRules`/`FieldComponentCost`, and `ComponentCostYearRules`/`FieldComponentCostYear` were all checked and have no naming mismatches — every property name in those three classes matches the corresponding DTO/entity/view exactly.

### New bug found during this audit — `ComponentCostPerYear.Year` silently dropped despite a *correctly*-named rule field

`FieldComponentCostYear.Year` **does** match `RevisionComponentCostPerYearDTO.Year`, `ProjectComponentCostPerYear.Year` (live baseline view), and `RevisionProjectComponentCostPerYear.Year` (destination entity) — the reflection copy in `UpdateRevisionData` correctly reads/writes it. But three of the four code paths that build the row to persist never copy `Year` across at all:

- `RequestRevision`, update path, `AddRow` at lines 1085-1096 — sets `TransactionId, ComponentId, Amount, StartDate, EndDate, UACS, DateOfApproval, IsDeleted`, **no `Year`**.
- `RequestRevision`, insert path (new rows, `Id == 0`) at lines 1129-1138 — same fields, **no `Year`**.
- `ResubmitRevision`, insert path (new rows, `Id == 0`) at lines 2681-2691 — same fields, **no `Year`**.
- **Only** `ResubmitRevision`'s update path (lines 2570-2664) is correct — it mutates the already-tracked `RevisionProjectComponentCostPerYear` entity in place via reflection, so `Year` is preserved/updated there, and the diff-logging even explicitly checks `Year` at line 2604.

**Effect:** every brand-new ComponentCostPerYear row (via either endpoint) and every `RequestRevision`-updated row is persisted with `Year = 0` (int default), regardless of what the user submitted and regardless of the `ComponentCostYearRules.Fields.Year` setting. `Year` is a `[Required]` field on the DTO and entity, so this silently corrupts the per-year cost breakdown for every new revision. This was not part of the original endpoint-by-endpoint pass — found by systematically tracing each `Fields` flag through to the final persisted row.

### Fields-column audit summary

| Finding | Severity | Status |
|---|---|---|
| `Year` dropped on ComponentCostPerYear insert/RequestRevision-update (3 of 4 paths) | **High** — silent data corruption (defaults to 0) on every new revision | New, found in this pass |
| `Source`/`Agreement` flags dead in `FundingProfileRules` | Medium — admin-configured permission has no effect; submitted SourceOrg/AgreementCode edits silently ignored | New, found in this pass |
| `WorkTypeId`/`InfraType` flags dead in `MajorItemOfWorkRules` | Medium — same pattern, submitted WorkTypeFK/InfraTypeFK edits silently ignored | New, found in this pass |
| `UACS` flag dead in `ProjectDetailsRules` | Low — property doesn't exist anywhere; already effectively disabled (matches commented-out assignment) | New, found in this pass |
| `MajorItemLocationRules`/`ComponentCostRules`/`ComponentCostYearRules` field names | — | Verified clean, no mismatches |
| Insert-path field completeness for ComponentCost, MajorWorkItem, FundingProfile, MajorWorkLocations | — | Verified complete, no other dropped fields found |

## CRITICAL — live schema check on the dev DB (192.168.50.200 / myps_db)

The dev SQL Server that `Main/appsettings.Development.json` points to (`192.168.50.200`, `sa`/`***REMOVED***`) became reachable partway through this investigation (it was unreachable earlier in the session — network-dependent). Direct, read-only queries against it (`INFORMATION_SCHEMA`, `sp_helptext`, and targeted `SELECT`s that trigger `Invalid column name` errors on purpose) prove something bigger than isolated code bugs: **the live schema for the Formal Revision tables has already been migrated to a new FK-based model that `RevisionController.cs` and its EF models do not know about.**

### What actually changed on the DB

- `tRevisionDetails` **no longer has `RegionStatus` or `COStatus` columns** — confirmed via `SELECT TOP 1 RegionStatus, COStatus FROM tRevisionDetails` → `Msg 207: Invalid column name 'RegionStatus'` / `'COStatus'`. Live columns instead: `Id, TransactionId, ProjectFK, ProjectRevisionFK, ProgramId, RevisionGroupId, CategoryId, ReasonId, IODocApprovalDate, IODocPath, IsCertified, CreatedBy, CreatedDate`. The two-tier approval status this whole controller is built around (`RegionStatus`/`COStatus` on `tRevisionDetails`) **does not exist on this database.**
- `tRevisionProjectComponentCost`, `tRevisionProjectComponentCostPerYear`, `tRevisionProjectFundingProfile`, `tRevisionProjectMajorWorkItem`, `tRevisionProjectMajorWorkLocations` **no longer have `TransactionId` or (for most) `ComponentId` as their parent key** — confirmed the same way (`Invalid column name 'TransactionId'` / `'ComponentId'`). They now key off `RevisionDetailFK` (int, → `tRevisionDetails.Id`), `RevisionComponentCostFK` (int, → `tRevisionProjectComponentCost.Id`), and `RevisionWorkItemFK` (int, → `tRevisionProjectMajorWorkItem.Id`) respectively — a fully relational parent-child chain instead of the string `TransactionId`/`ComponentId` keys the controller and EF models use everywhere.
- A new table `tRevisionProjectSnapshot` exists (`RevisionDetailFK`, `ProjectId`, and the same project-header columns as `tRevisionProjects`/`ProjectDetails`) — it's the new home for the "editable project snapshot" role, keyed by `RevisionDetailFK` instead of `TransactionId`.
- **`vRevisionLists` and `vRevisionRules` — the two views the controller queries directly (`_db.vRevisionLists`, `_db.vRevisionRules`) — no longer exist at all** (`INFORMATION_SCHEMA.COLUMNS` returns 0 rows for both).
- In their place, a whole new function-based API surface exists: `fRevisionDetail`, `fRevisionComponentCost`, `fRevisionComponentCostPerYear`, `fRevisionFundingProfile`, `fRevisionMajorWorkItem`, `fRevisionMajorWorkLocations`, `fRevisionDocuments`, `fRevisionApprovalStatus`, `fRevisionApprovalTrail`, `fRevisionCorrectionHistory`, `fOpenRevision`, `fProjectEffectiveRevision`, and `fRevisionRuleFor(@ReasonId, @PCMA_Status, @Package_Status)` (the direct `vRevisionRules` replacement — same `tRevisionRules` columns plus an `IsActive = 1` filter, but note it does **not** include `Reason`/`RevisionGroupId` text the way the old view did, so callers need an extra join).
- `tRevisionProjects` and `tRevisionRules` themselves are the **only** two revision tables whose live shape still matches what the EF models/controller expect.

### `fProjectDetails`/`fProjectFundingProfile`/`fProjectComponentCost`/`fProjectComponentCostPerYear`/`fProjectMajorWorkItem`/`fProjectMajorWorkLocations` (the six functions checked in this pass)

All six are confirmed-existing table-valued functions, signature `(@ProjectPK NVARCHAR(200), @StageId INT)` in every case. Full `sp_helptext` pulled for all six. They implement a "revision-aware overlay" pattern: a CTE (`ctx`) determines per project+stage whether an approved-but-not-yet-superseded Formal Revision exists (`dbo.fProjectEffectiveRevision(ProjectFK)`, `p.IsPublished`, `tOptionProgramStage.StageHierarchy` comparison) and the function `UNION ALL`s a `Source = 'Revision'` branch (reading from `tRevisionProject*` via the new `RevisionDetailFK`/`RevisionComponentCostFK`/`RevisionWorkItemFK` chain, joined through `tRevisionProjectSnapshot`) with a `Source = 'Base'` branch (reading the plain lifecycle `tProject*` tables). `fProjectComponentCostPerYear` and `fProjectMajorWorkLocations` call the other functions internally (`fProjectComponentCost(@ProjectPK,@StageId)`, `fProjectMajorWorkItem(@ProjectPK,@StageId)`) rather than querying base tables directly.

**Confirmed live bug in `ReviseProject` (`RevisionController.cs:380-381`):** the call `FROM fProjectDetails({dto.ProjectId})` passes only **one** argument to a function that requires two (`@ProjectPK`, `@StageId`, no defaults). Verified by running the exact call shape against the live DB:
```
SELECT * FROM fProjectDetails('TEST')
→ Msg 313: An insufficient number of arguments were supplied for the procedure or function fProjectDetails.
```
Every call to `ReviseProject` — the endpoint that starts a brand-new revision — throws this SQL error and gets caught by the generic exception handler. **This endpoint cannot succeed as currently written**, independent of the broader schema-drift issue above. (All five other `fProject*` calls elsewhere in the controller correctly pass two arguments, e.g. `fProjectComponentCost({dto.ProjectId}, {EnumProgramStage.GAAR})` — only this one call site is wrong.)

### Root cause — this is a known, planned, but not-yet-authorized migration

`documents/docs/formal-revision/MYPS_FORMAL_REVISION_REDESIGN_AND_MIGRATION_PLAN.md` (dated 2026-08-11) documents exactly this redesign — header states **"Status: Planning baseline"** and **"Implementation authorization: Not granted by this document."** It explicitly lists `tRevisionDetails`, `tRevisionProjects`, `tRevisionProjectComponentCost(PerYear)`, `tRevisionProjectFundingProfile`, `tRevisionProjectMajorWorkItem(Locations)`, `tRevisionDocuments`, `tRevisionForCorrectionDetails`, `tRevisionDetailsComponentsStatus`, `tRevisionTransactionLog` as in-scope tables, keeps `tRevisionRules`/`vRevisionRules`/`fRevisionRuleFor` "unchanged," and states invariants like *"`TransactionId` is a business/idempotency identifier at the root. It must not be the physical child-table parent key"* and *"A Formal Revision child belongs to one `tRevisionDetails.Id` through `RevisionDetailFK`."* This matches the live schema found on `192.168.50.200` almost exactly.

**In other words: the schema changes described in a "not yet authorized" planning document have already been deployed to the shared dev SQL Server this branch's `appsettings.Development.json` points to, while `RevisionController.cs` on this branch (`BE-projectdetails`) is still written entirely against the pre-migration schema.** This is not a set of isolated bugs — the entire revision read/write path in this controller is targeting tables/columns/views that partially no longer exist on this dev database. Whether that's because (a) someone jumped ahead of the plan's authorization gate on the shared dev box, (b) this dev box is being used as a sandbox for the redesign work and isn't the intended target for this branch right now, or (c) there's a newer status update superseding "Not granted" that wasn't found in this pass, is unknown and worth confirming with the team/plan owner before doing any further work here.

### `tRevisionRules.Field` — live data, ties back to the earlier Fields-column audit

`tRevisionRules` itself is untouched by the migration (confirmed: same 6 columns as the EF entity — `Id, ReasonId, PCMA_Status, Package_Status, Field, IsActive`). Live contents: **347 rows, all `IsActive = 1`, 47 distinct `ReasonId`s × 4 distinct `PCMA_Status` values × 2 distinct `Package_Status` values ("Packaged"/"Not Packaged")**.

Pulled the actual `Field` JSON for row `Id = 1` (ReasonId 1, PCMA_Status "Not yet started", Package_Status "Packaged") — this **directly overturns part of the earlier Fields-column audit's root-cause framing**:

```json
"MajorItemOfWorkRules":{"Fields":{"ComponentId":false,"YearOfWork":false,"WorkTypeFK":false,"InfraTypeFK":false}, ...}
"FundingProfileRules":{"Fields":{"SourceOrg":false,"AgreementCode":false,"Amount":false,"Percentage":false}, ...}
"ComponentCostYearRules":{"Fields":{"UACS":true,"Year":false,"Amount":false,"StartDate":false,"EndDate":false}, ...}
```

**The live JSON already uses the correct property names** (`WorkTypeFK`, `InfraTypeFK`, `SourceOrg`, `AgreementCode`) — matching the DTOs/entities exactly. It is the C# `Field*` classes in `DBHelper/Models/Table/ModificationRules.cs` (`FieldMajorItemOfWork.WorkTypeId`/`.InfraType`, `FieldFundingProfile.Source`/`.Agreement`) that are stale and use the *wrong* names. Since `JsonConvert.DeserializeObject<ModificationRules>()` silently ignores JSON properties with no matching C# property (Newtonsoft default behavior), any `true` value an admin sets for `WorkTypeFK`/`InfraTypeFK`/`SourceOrg`/`AgreementCode` in the database is **silently discarded at deserialization time** — it never even reaches the reflection-based `UpdateRevisionData` logic. Same net effect as documented before (edits to these fields are always dropped), but the fix is squarely "update the stale C# class names to match the DB," not "the DB data is wrong."

**New finding, not previously documented:** `ComponentCostYearRules.Fields` in the live JSON has a `"UACS":true` flag — but `FieldComponentCostYear` (`DBHelper/Models/Table/ModificationRules.cs:36-42`) only declares `Year, Amount, StartDate, EndDate` — **no `UACS` property exists on this C# class at all**, so this flag is silently dropped for every rule that sets it.

**Real-world impact, quantified directly against the 347 active rules:**

| Flag | Rules with it set to `true` | Effect |
|---|---|---|
| `MajorItemOfWorkRules.Fields.WorkTypeFK` | 60 / 347 | Admin-granted edit permission silently ignored — `WorkTypeFK` edits during a revision are always dropped |
| `MajorItemOfWorkRules.Fields.InfraTypeFK` | 60 / 347 | Same, for `InfraTypeFK` |
| `FundingProfileRules.Fields.SourceOrg` | 65 / 347 | Same, for `SourceOrg` |
| `FundingProfileRules.Fields.AgreementCode` | 65 / 347 | Same, for `AgreementCode` |
| `"UACS":true` (either `ProjectDetailsRules.UACS` or `ComponentCostYearRules.Fields.UACS`) | 347 / 347 (all active rules) | Universal — every single active rule grants UACS edit permission, and every single one is silently ignored, for both `ProjectDetailsRules.UACS` (no such property on `ProjectDetails` class) and `ComponentCostYearRules.Fields.UACS` (no such property on `FieldComponentCostYear` class) |

This confirms the Fields-column mismatches aren't theoretical edge cases — they're actively configured, in production rule data, at meaningful scale (17-19% of rules for the FK fields, 100% for UACS), and have presumably been silently non-functional since whenever these C# classes and the DB rule data diverged.

## Definitive `Field*` class ↔ live table column linkage map

Requested follow-up: verify that every property in each `ModificationRules`/`Field*` class (`DBHelper/Models/Table/ModificationRules.cs`) is properly linked to a real column on its corresponding live table. Re-pulled fresh `INFORMATION_SCHEMA.COLUMNS` for all six tables (`tRevisionProjects`, `tRevisionProjectFundingProfile`, `tRevisionProjectComponentCost`, `tRevisionProjectComponentCostPerYear`, `tRevisionProjectMajorWorkItem`, `tRevisionProjectMajorWorkLocations` — confirmed these are the only `tRevision*` tables matching those roles; no separate non-"Project" variants exist) and cross-checked every property name against every column name. Also checked whether the "no coverage" columns ever appear anywhere in the 347 active `tRevisionRules` rows, to distinguish real gaps from deliberate exclusions.

| Rule class | Table | Result |
|---|---|---|
| `RuleProjectDetails` (flat, 23 props) | `tRevisionProjects` (38 cols) | **22 of 23 match exactly.** System/key columns (`Id, IsActive, TransactionId, RevisionId, ProjectFK, ProgramFK, ProgramId, ProjectId, CreatedBy, CreatedDate, IsDeleted`) correctly have no Fields flag. `UACS` is the one broken property — see below. Five live columns (`ExternalId, MYId, AlternateId, IslandCode, Rank`) have no Fields flag and never appear in any of the 347 rules — consistently absent on both sides, presumably PCMA/system-derived and intentionally outside the rule engine's scope; not a mismatch, just noted. |
| `FieldComponentCost` (4 props) | `tRevisionProjectComponentCost` (7 cols) | **Fully clean — 4/4 match exactly** (`ComponentType, ComponentId, Description, Total`). No gaps. |
| `FieldComponentCostYear` (4 props) | `tRevisionProjectComponentCostPerYear` (9 cols) | **3 of 4 core props match** (`Year, Amount, StartDate, EndDate`). Missing a `UACS` property entirely — the live column exists (`UACS nvarchar`) and the live JSON sets this flag `true` on **all 347/347 active rules** (confirmed previously) — this is a real, high-impact gap, fixable by simply adding `public bool UACS { get; set; }` to the class. `DateOfApproval` (live column) has no Fields flag and never appears in any rule's JSON — consistently absent on both sides (looks like a system-set approval-date field, not IO-editable), not a mismatch. |
| `FieldFundingProfile` (4 props) | `tRevisionProjectFundingProfile` (8 cols) | **2 of 4 match** (`Amount, Percentage`). `Source`/`Agreement` are wrong names — should be `SourceOrg`/`AgreementCode` (confirmed: 65/347 active rules set these `true`, silently dropped). `IsWalletDraw` (live column) has no Fields flag and never appears in any rule's JSON — ties to the migration plan's explicit note that *"LS/wallet Project behavior remains an open decision and must not inherit standard behavior silently"* — this looks deliberate, not a bug. |
| `FieldMajorItemOfWork` (4 props) | `tRevisionProjectMajorWorkItem` (7 cols) | **2 of 4 match** (`ComponentId, YearOfWork`). `WorkTypeId`/`InfraType` are wrong names — should be `WorkTypeFK`/`InfraTypeFK` (confirmed: 60/347 active rules affected). No coverage gaps otherwise — full 1:1 once renamed. |
| `FieldMajorItemLocation` (14 props) | `tRevisionProjectMajorWorkLocations` (17 cols) | **Fully clean — 14/14 match exactly.** No gaps, no naming issues. (The earlier controller bug on this table — `RequestRevision` line 1255 — was a wrong-variable reference in the controller, not a problem with this class.) |

### Important nuance on `RuleProjectDetails.UACS`

This is **not the same kind of bug** as the `Source`/`Agreement`/`WorkTypeId`/`InfraType` renames. Those have a real live column to rename *to*. `UACS` does not: **`tRevisionProjects` has no `UACS` column at all**, and — confirmed by checking all 347 active rules — **no rule's JSON ever sets a top-level `"UACS"` key inside `ProjectDetailsRules`** (only inside `ComponentCostYearRules.Fields`, which is the legitimate, needed one). This property looks like dead/abandoned code that was never wired up on either the DB or the data side — consistent with the already-commented-out `//NewRevisionProject.UACS = ProjectRevision.UACS;` line in the controller. The correct fix is almost certainly to **delete `UACS` from `RuleProjectDetails`**, not to add a column for it — unless the business actually wants UACS to become part of the Formal Revision project snapshot, which would be a schema change decision, not a code fix.

### Summary — exactly what needs to change in `DBHelper/Models/Table/ModificationRules.cs`

1. `FieldFundingProfile.Source` → rename to `SourceOrg`
2. `FieldFundingProfile.Agreement` → rename to `AgreementCode`
3. `FieldMajorItemOfWork.WorkTypeId` → rename to `WorkTypeFK`
4. `FieldMajorItemOfWork.InfraType` → rename to `InfraTypeFK`
5. `FieldComponentCostYear` → add missing `UACS` property
6. `RuleProjectDetails.UACS` → remove (dead property, no backing column, unused in live data)

`FieldComponentCost` and `FieldMajorItemLocation` need no changes. This is now a complete, DB-verified, ready-to-implement fix list for the Fields-column layer specifically (independent of the bigger schema-drift/blocking issues #1-#2 in the master list above, which remain a separate, larger decision).

## Next step (as of this writing)

**Open question for the team before any fix work starts:** is the dev DB at `192.168.50.200` the intended target for this branch (`BE-projectdetails`) right now, or has it been migrated ahead of schedule for the (explicitly not-yet-authorized) Formal Revision redesign? If the former, `RevisionController.cs` needs a substantial rewrite to the new `RevisionDetailFK`/`RevisionComponentCostFK`/`RevisionWorkItemFK` schema and the new `fRevision*` function API before any of the smaller bugs below matter. If the latter, this branch may need to point at a different/rolled-back dev DB to keep working against the current schema, and the schema-drift section above should be flagged to whoever owns the migration.

Smaller, independently-fixable issues found (all silent data loss / silent no-ops, assuming the current schema is the one to keep targeting): bugs #1, #2, #4 (original pass), the `ReviseProject` missing-argument crash (verified live), the `Year`-drop bug, and the dead-flag findings in `ModificationRules`/`Field*` classes (this pass — fix is to rename `WorkTypeId→WorkTypeFK`, `InfraType→InfraTypeFK`, `Source→SourceOrg`, `Agreement→AgreementCode`, and add a `UACS` property to both `FieldComponentCostYear` and `RuleProjectDetails`'s backing type). Good candidates for the repo's `/create-plan` → `/implement-task` → `/code-review` pipeline once the schema-target question above is resolved.
