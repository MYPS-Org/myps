# Analysis — RevisionController.cs & myps_db Revision Schema — 2026-08-13

## Scope

Full read-through of `WebAPI/Controllers/Revision/RevisionController.cs` (3180 lines, all 6 actions) cross-referenced against the `myps_db` schema. No live DB connection was reachable from this machine (dev server `192.168.50.200:1433` unreachable, prod `10.0.10.226` untested/not attempted) — schema understanding is based on:

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

## Next step (as of this writing)

User wants to work through the rules/entries in `tRevisionRules` next. Bugs #1, #2, #4 (original pass) and the `Year`-drop + dead-flag findings (this pass) are the most impactful — all are silent data loss / silent no-ops, several specific to the field-level rules engine that governs what's editable per revision reason. Good candidates to fix first via the repo's `/create-plan` → `/implement-task` → `/code-review` pipeline.
