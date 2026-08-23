# MYPS `RevisionRequests` Refactoring Specification

Status: Code- and schema-informed focused plan  
Date: 2026-08-11  
Implementation status: Implemented in code; database deployment and IO/RO/CO acceptance verification pending  
Scope: Revision request-list retrieval only; no Revision write workflow is changed by this document

Implementation slice:

- thin `RevisionController.RevisionRequests` endpoint;
- `WebAPI/Features/Revisions/Queries/SearchRevisionQueue/SearchRevisionQueueQuery.cs` validation, actor resolution, authorization scope, filters, and cursor query;
- typed backend and frontend queue contracts;
- `Main/Resources/Internal/SQLScripts/Revision.Queue.sql` normalized queue read model;
- `Main/Resources/Internal/SQLScripts/Revision.Queue.Verification.sql` read-only post-deployment invariants;
- filtered React queue with stable Revision-detail navigation and First/Previous/Next/Last cursors.

The implementation is not production-certified until the deployment and acceptance gates in Sections 10 and 13 pass against the target `myps_db` instance.

## 1. Purpose

`RevisionRequests` must return the authenticated user's current Formal Revision request list accurately, securely, and with a frontend contract that matches the data actually returned. During the current compatibility phase, the list contains actionable not-yet-approved work plus terminal Disapproved rows for information. Fully approved rows are excluded.

This endpoint is not Revision history and is not the source of the effective Project. It answers:

> Which not-approved Formal Revision transactions should this actor currently see, which require action, and which are terminal informational outcomes within the actor's authorized Project scope?

The focused refactor must be released as one compatible slice across:

1. `RevisionController.RevisionRequests`;
2. the request/response DTOs;
3. `dbo.fRevisionQueue` or its replacement read model;
4. row-level Project visibility;
5. frontend list rendering, navigation, filters, and pagination;
6. automated contract, authorization, SQL-state, and pagination tests.

## 2. Evidence reviewed

### Application code

- `WebAPI/Controllers/Revision/RevisionController.cs`, lines 31-125;
- `WebAPI/Controllers/Revision/DTORevision.cs`;
- `Helpers/CursorPagination.cs`;
- `DBHelper/Models/Functions/Revision/RevisionQueue.cs`;
- `DBHelper/Models/Enums/Pagination.cs`;
- `WebAPI/Controllers/CoreController.cs`;
- `WebAPI/Controllers/AuthorizeSessionAttribute.cs`;
- `FE/src/pages/Modification/views/ModifcationList.tsx`;
- `FE/src/pages/Modification/Service.ts`;
- `FE/src/pages/Modification/Model.d.ts`;
- `FE/src/types/Pagination.d.ts`.

### Database and confirmed process evidence

- `sources/database/myps_db(08-10-2026-full-schema).sql`;
- `dbo.fRevisionQueue`;
- `dbo.fRevisionApprovalStatus`;
- `dbo.fUserVisibleProjects`;
- `dbo.tRevisionDetails`;
- `dbo.tRevisionApprovals`;
- `dbo.tRevisionDocuments`;
- confirmed IO upload-before-submit and CO upload-before-final-approval process;
- confirmed `IsApprovedDocument = 1` means the separate CO document.

## 3. Current behavior

The endpoint currently:

1. constructs raw filter tuples from `RevisionRequestsDTO.Filters`;
2. infers a string workflow level from user-group names;
3. queries `dbo.fRevisionQueue(@Level)` through `FilterDataCursor`;
4. orders by `Id DESC` and includes a total count;
5. returns `FilteredResult<RevisionQueue>`.

Current inferred levels are:

| User-group condition | Queue level |
|---|---|
| Contains `RPC` | `RO` |
| Contains `DPDAdmin` | `CO` |
| Anything else | `IO` |

CLIENT-CONFIRMED 2026-08-11: preserve this existing `RevisionRequests` mapping for now. That means `RPC -> RO`, `DPDAdmin -> CO`, and every other user who is authorized to call this action remains `IO`. The inconsistency with write endpoints that use `AUC` for CO remains documented as accepted technical debt; it must not be silently “corrected” during this focused change.

## 4. Confirmed defects

### 4.1 Project ID filter binds Transaction ID

When `ProjectId` is supplied, the controller currently adds:

```text
Clause:    v.TransactionId = @TransactionId
Parameter: @TransactionId
Value:     dto.Filters.TransactionId
```

Required behavior:

```text
Clause:    v.ProjectId = @ProjectId
Parameter: @ProjectId
Value:     normalized dto.Filters.ProjectId
```

Current impact:

- Project-only search normally compares `TransactionId` to `NULL` and returns no rows;
- supplying both Transaction ID and Project ID creates a duplicate `@TransactionId` and causes pagination validation to return an error;
- the only active search control on the current page therefore cannot work correctly.

### 4.2 Revision Type filter uses the wrong SQL parameter

The SQL clause references `@RevisionType`, but the tuple creates `@RevisionStatus`.

Current impact:

- Revision Type alone can fail with an undeclared `@RevisionType` SQL variable;
- Revision Type plus Revision Status creates duplicate `@RevisionStatus` parameters and is rejected by `ValidateParameters`.

### 4.3 Backend and frontend response contracts are incompatible

The backend returns `RevisionQueue`:

```text
Id
TransactionId
ProjectId
RevisionType
RevisionReason
RevisionStatus
CurrentStage
RevisionDate
Age
```

The frontend declares and reads the older `RevisionLists` shape:

```text
RevisionName
RevisionGroupId
CategoryName / CategoryId
Reason / ReasonId
RegionStatus / RegionStatusName
COStatus / COStatusName
CreatedDate
...
```

Consequences in `ModifcationList.tsx`:

- the Revision Type cell reads a property the API does not return;
- the Project ID column displays `TransactionId` even though the API returns `ProjectId`;
- Reason and Date read nonexistent properties;
- Status is recomputed from nonexistent legacy RO/CO properties instead of using `RevisionStatus`;
- View navigation uses missing `RevisionGroupId` and parses the display `TransactionId` to reconstruct business identity.

This is a release-blocking contract defect, not a cosmetic type-definition issue.

### 4.4 Pagination requests do not satisfy the backend protocol

The backend uses `PaginationNavigation` and cursor fields:

```text
Navigation
PreviousFilteredId
NextFilteredId
PageCursorId
```

The Revision page sends only `page` and `limit` and never sends `Navigation`. The backend therefore receives the enum default `First` and resets `requestedPage` to 1.

Current impact:

- clicking any numbered page can retrieve page 1 again;
- the UI's First/Last controls are not using the server's First/Last navigation modes;
- cursor IDs returned by the server are not retained;
- changing filters has no explicit cursor reset policy;
- the TypeScript `RevisionPagination` contract contains unused sort fields but omits the cursor-navigation contract actually required.

### 4.5 Unauthorized groups default to the IO queue

Any user who passes the route permission filter but is not recognized as RPC or DPDAdmin is silently assigned `IO`.

The recommended security behavior would normally be fail closed:

- resolve exactly one authorized workflow actor;
- return `403 REV_ACTOR_NOT_AUTHORIZED` for no match;
- apply an approved conflict policy when a user belongs to groups that map to multiple actors;
- never treat an unknown group as IO.

CLIENT DECISION 2026-08-11: do not change the existing queue mapping in this refactor. Route permission remains the outer gate, and non-`RPC`/non-`DPDAdmin` callers continue to resolve to IO. This exception must be covered by characterization tests and reconsidered when the complete Revision actor policy is unified.

### 4.6 Group-to-actor mapping is inconsistent

Observed mappings are not consistent between:

- `RevisionRequests`;
- `RequestRevision`;
- `UpdateRevisionStatus`;
- `ResubmitRevision`;
- Revision frontend dialogs.

One `IRevisionActorResolver` or equivalent policy must be the only authority. The queue must not embed its own mapping.

### 4.7 Workflow ownership is not row-level authorization

`dbo.fRevisionQueue(@Level)` filters by workflow state only. It does not accept a user and does not apply:

- `dbo.fUserVisibleProjects(@UserId)`;
- `_Session.ApplyFilter`;
- `_Session.RegCode`;
- IO creator or office ownership.

The route-level `PermissionFilter` only verifies that the user may invoke the action. It does not prove the user may view every returned Revision row.

Without a separate resource-scope predicate, an RO user may receive other regions' RO work, and an IO user may receive IO work belonging to other creators/offices.

### 4.8 `CurrentStage` has the wrong business name

`fRevisionQueue.CurrentStage` contains `IO`, `RO`, or `CO`. It is the current approval owner, not the Program or Project lifecycle stage.

The target name is `ApprovalOwner` or `CurrentOwner`. If Project stage is ever needed, it must be a separate `ProjectStage` field. Formal Revision eligibility remains tied to the published GAA-R baseline.

### 4.9 Queue SQL still contains the legacy post-RO IO-document gate

The current function routes this state back to IO:

```text
RO approved
+ CO pending
+ tRevisionDetails.IODocPath is null
= Awaiting Document at IO
```

That contradicts the client-confirmed process:

1. IO selects Submit/Resubmit;
2. the IO upload modal opens;
3. a valid IO document and transition are committed atomically;
4. RO approval moves directly to CO pending;
5. CO selects Approve;
6. the separate CO upload modal opens;
7. valid CO document + PCMA publication + final approval are one success boundary.

Therefore `IODocPath` must not control ownership after RO approval. Missing required IO evidence should cause the submit/resubmit command to fail; it must not create a later queue state.

### 4.10 The work queue and Revision history are not separated in the UI language

`fRevisionQueue` currently excludes fully approved and disapproved terminal transactions. The page title says `Revision List`, which can imply complete history.

Required separation:

- Work Queue: unresolved rows currently owned by the actor;
- Revision History: terminal and historical rows from a separate history query;
- Effective Project: current data only from the fully approved effective overlay.

CLIENT-CONFIRMED 2026-08-11: this page must contain only Revisions that are not approved. Fully approved Revisions must not appear. Terminal `Disapproved` rows must remain visible for now, but the contract and read model must make them easy to move to a separate History page later.

### 4.11 Raw database exception text can reach the client

`FilterDataCursor` converts caught exceptions into `ErrorMessage`; `RevisionRequests` returns that string in a 400 response. SQL object names, parameter details, and other implementation information can therefore be exposed.

Expected client errors must use stable error codes. Unexpected database errors must be logged with a correlation ID and returned as a generic 500 response.

## 5. Target queue state model

The active queue must be derived from the canonical RO and CO approval rows, not independently reimplemented in the controller.

| Approval condition | Owner | Display status | Work queue? |
|---|---|---|---|
| No RO approval row | None | Invalid/incomplete persistence state | No; diagnose and repair |
| RO `Pending` | RO | Submitted for RO Review | Yes |
| RO `ForCorrection` | IO | Returned by RO | Yes |
| RO `Approved`, CO `Pending` | CO | Pending CO Review | Yes |
| RO `Approved`, CO `ForCorrection` | IO | Returned by CO | Yes |
| RO `Disapproved` | None | Disapproved by RO | Yes for now; terminal and informational |
| RO `Approved`, CO `Disapproved` | None | Disapproved by CO | Yes for now; terminal and informational |
| RO `Approved`, CO `Approved`, publication confirmed | None | Fully Approved / Published | No; history and effective overlay |

Important rules:

- no queue rule may depend on an IO document being uploaded after RO approval;
- Save Draft is not supported;
- the Revision root, valid IO document, and initial RO Pending state must be created atomically during Submit;
- a transaction without an RO approval row is not a user-visible Draft and must be excluded/flagged for support;
- CO approval cannot appear in the queue as complete until PCMA publication has succeeded;
- a pending/returned/disapproved transaction never becomes effective;
- Disapproved rows have `IsTerminal = true`, `IsActionable = false`, and no allowed actions;
- terminal visibility is separate from approval ownership because Disapproved has no current owner;
- RO-disapproved rows are visible to the applicable scoped IO and RO audiences;
- CO-disapproved rows are visible to the applicable scoped IO, RO, and CO audiences;
- LS/wallet Revision remains pending and must not be admitted through this queue until its process is approved.

## 6. Target API contract

### 6.1 Request

Use one typed request. Property names must be identical in C# and TypeScript.

```text
SearchRevisionQueueRequest
  Filters
    TransactionId?       normalized exact identifier
    ProjectId?           normalized anchored prefix; minimum 5 characters when supplied
    RevisionGroupId?     Type ID, preferred over display text
    CategoryId?          nullable optional Category ID
    ReasonId?            Reason ID
    StatusCode?          canonical workflow status code
    CreatedFrom?         optional inclusive date
    CreatedTo?           optional exclusive upper bound
  Limit                  1..200
  Navigation             First | Previous | Next | Last
  PreviousCursor?
  NextCursor?
  Page                   display page number
```

`ApprovalOwner` must not be accepted from the client for the normal personal work queue. It is derived from the authenticated actor.

If product needs an administrative cross-owner monitor, create a separately authorized endpoint instead of weakening this one.

### 6.2 Response row

```text
RevisionQueueItem
  RevisionDetailId
  TransactionId
  ProjectPK
  ProjectId
  RevisionGroupId
  RevisionType
  CategoryId?
  CategoryName?
  ReasonId
  RevisionReason
  StatusCode
  RevisionStatus
  ApprovalOwner
  IsTerminal
  IsActionable
  RevisionDate
  AgeDays
  AllowedActions[]
  ConcurrencyVersion?    required before mutation commands are introduced
```

`AllowedActions` is computed by the server from actor, state, required evidence, and row-level authorization. It is a UI aid; mutation endpoints must revalidate everything.

For Disapproved rows, `ApprovalOwner` is null/none, `IsTerminal` is true, `IsActionable` is false, and `AllowedActions` is empty. This explicit classification is the compatibility seam for moving those rows to Revision History later without changing their underlying status semantics.

### 6.3 Response page

The page response must use one casing convention and include:

```text
items
page
limit
total
totalPages
previousCursor
nextCursor
hasPrevious
hasNext
```

Do not maintain two frontend shapes (`RevisionLists` and `RevisionQueue`) for this endpoint.

## 7. Backend refactoring design

### 7.1 Thin controller

The controller should only:

1. accept and validate the request;
2. obtain the authenticated user ID;
3. call `SearchRevisionQueueQuery`;
4. map a typed success/error result to HTTP;
5. pass the cancellation token.

It must not construct arbitrary SQL tuples or map group names itself.

### 7.2 Canonical actor resolver

The long-term design remains one actor resolver shared by all Revision reads and writes. For this focused endpoint, preserve the client-confirmed existing mapping:

```text
RPC present      -> RO
DPDAdmin present -> CO (overrides RPC because it is evaluated last)
otherwise        -> IO, after route permission succeeds
```

Required resolver tests:

- RPC maps to RO;
- DPDAdmin maps to CO;
- DPDAdmin + RPC maps to CO under the existing evaluation order;
- every other action-authorized group combination maps to IO;
- case and whitespace behavior are defined, although stored group codes should be normalized.

Do not change AUC/DPC behavior inside this focused queue refactor. Unifying the broader `DPC`/`RPC`/`AUC`/`DPDAdmin` policy remains a later cross-endpoint task.

### 7.3 Server-authorized scope

The query must combine two independent predicates:

```text
workflow ownership
AND
resource visibility
```

Use stable `ProjectFK`, not display `ProjectId`, to join the queue row to `dbo.fUserVisibleProjects(@UserId)`.

CLIENT-CONFIRMED scope behavior:

- IO: only rows whose exact published baseline Project Revision belongs to the user's implementing office;
- RO: authorized Projects in the user's region;
- CO: all authorized Revisions nationwide;
- `ApplyFilter = 0` continues to be interpreted only by the canonical visibility function, not by ad hoc controller conditions.

For IO, compare the authenticated user's `_Session.PlantillaOffice` with `ImplementingOffice` on the exact published baseline identified by `tRevisionDetails.ProjectRevisionFK`. Do not use the editable Formal Revision snapshot or a newly proposed Implementing Office to grant access. Otherwise a candidate edit could transfer queue visibility before approval.

If `PlantillaOffice` is missing or cannot be resolved, return no IO rows and a controlled authorization/configuration error; never broaden the query.

For RO, use the canonical user/Project visibility function so the exact published baseline's Region is within the authenticated RO user's region. Do not accept Region from the request. CO receives nationwide rows only after route permission and the preserved CO actor mapping succeed.

The queue read model therefore needs to project `ProjectFK` and `ProjectRevisionFK` even if those values are not displayed.

### 7.4 Typed filters

Replace handwritten tuple construction with a typed query specification or fixed query handler.

At minimum:

- trim identifier filters;
- when Project ID is supplied, require at least 5 characters after trimming;
- apply Project ID as an anchored prefix (`value%`), never `%value%`;
- reject a nonempty Project ID shorter than 5 characters instead of silently returning an unfiltered list;
- use one property, SQL column, parameter name, and value per filter;
- use IDs for Type/Category/Reason where possible;
- reject invalid enum/status values before SQL;
- keep Transaction ID exact while Project ID uses the confirmed minimum-5-character prefix search;
- reset pagination cursors whenever any filter changes;
- never accept a client-provided raw column, direction, clause, or table name.

The generic `FilterDataCursor` may remain temporarily only if all SQL fragments are private constants and every filter combination has a regression test. A dedicated typed Revision query is preferred because it makes invalid field/parameter combinations unrepresentable.

### 7.5 Read model changes

Refactor `fRevisionQueue` or replace it with an equivalent dedicated view/query so it:

- exposes stable root and Project keys;
- exposes selector IDs and names needed by the client;
- returns one canonical status code and display name;
- names the owner `ApprovalOwner`;
- removes the legacy post-RO `IODocPath` branch;
- includes Disapproved only as explicitly terminal, nonactionable compatibility rows;
- derives approval state only through `fRevisionApprovalStatus` or its approved replacement;
- remains one row per `RevisionDetailFK`.

`UQ_tRevisionApprovals_Level (RevisionDetailFK, Level)` already protects the one-row-per-level assumption in the supplied schema.

### 7.6 Error handling

Recommended error contract:

| Condition | HTTP | Code |
|---|---:|---|
| Invalid filters/pagination | 400 | `REV_QUEUE_REQUEST_INVALID` |
| Authenticated user has no Revision actor | 403 | `REV_ACTOR_NOT_AUTHORIZED` |
| Actor conflict | 403 | `REV_ACTOR_AMBIGUOUS` |
| Cursor no longer valid after queue mutation | 409 | `REV_QUEUE_CURSOR_STALE` |
| Database/unexpected failure | 500 | `REV_QUEUE_UNAVAILABLE` |

The response must not include raw SQL exception text.

## 8. Frontend changes

`ModifcationList.tsx` should be changed with the backend contract, not afterward.

Required changes:

1. replace `RevisionLists` with `RevisionQueueItem`;
2. render `RevisionType`, `ProjectId`, `RevisionReason`, `RevisionDate`, and `RevisionStatus` directly;
3. optionally show `AgeDays` and `ApprovalOwner` if useful to the actor;
4. navigate using `RevisionDetailId`, not by parsing `TransactionId`;
5. remove status recomputation from legacy `RegionStatus`/`COStatus` fields;
6. consume server `AllowedActions`;
7. use the canonical cursor-pagination hook/component;
8. reset the cursor map and page to 1 when filters change;
9. remove ignored `SortField`/`sortDirection` until sorting is explicitly supported;
10. use a neutral `Revision Requests` title during the compatibility phase because terminal Disapproved rows remain visible;
11. remove console logging of responses and any Revision payload that can include documents.

The UI must render Disapproved rows with a terminal badge and no action button. The API must provide `IsTerminal`/`IsActionable`; the frontend must not infer terminal behavior by parsing display text. A later History separation should become a query/page-routing change, not a status rewrite.

### Pagination decision

CLIENT-CONFIRMED 2026-08-11: use newest-first ordering and First/Previous/Next/Last keyset navigation by stable `RevisionDetailId DESC`.

Do not provide arbitrary numbered-page jumps during this phase. A queue changes while users approve and return items, and a page number alone does not satisfy the current cursor protocol. Reset all cursors to First when any filter changes.

## 9. Database integrity and performance checks

Before adding indexes, capture an actual execution plan and representative row counts. Verify:

- `tRevisionDetails.TransactionId` has or receives an approved unique constraint;
- `tRevisionDetails.ProjectFK` supports authorization joins;
- the queue's `Id DESC` access path remains stable;
- approval lookups use the unique `(RevisionDetailFK, Level)` key;
- Type/Category/Reason joins cannot duplicate a queue row;
- `fUserVisibleProjects(@UserId)` returns unique `ProjectPK` values;
- the total-count query applies exactly the same actor, visibility, and filter predicates as the page query.

Candidate indexes must be justified by the plan, not added blindly. Candidates for measurement include:

- unique `tRevisionDetails(TransactionId)`;
- `tRevisionDetails(ProjectFK, Id)` with only necessary included queue columns;
- an approval status access path if the actual plan shows repeated scans by `Level` and `Status`.

## 10. Test plan

### 10.1 Controller and request validation

- null/missing Filters is rejected consistently or replaced by an explicit empty object policy;
- limit below 1 and above 200 follows the approved validation policy;
- invalid Navigation is rejected;
- required cursor missing for Previous/Next is rejected;
- cancellation is honored;
- unexpected errors do not disclose SQL text.

### 10.2 Filter regression tests

Test each alone and in combinations:

- Transaction ID;
- Project ID;
- Revision Type ID;
- optional Category ID;
- Reason ID;
- Status code;
- created-date range;
- no filters;
- all filters;
- leading/trailing whitespace;
- Project ID prefix of exactly 5 characters;
- Project ID prefix longer than 5 characters;
- nonempty Project ID of 1-4 characters returns a validation error and never an unfiltered result;
- Project ID `%` and `_` characters are rejected or safely escaped and never become free SQL wildcards;
- values containing SQL wildcard and quote characters;
- nonmatching values.

Mandatory regressions:

- Project ID never binds Transaction ID;
- Revision Type never binds Revision Status;
- combining any two filters does not create duplicate SQL parameters;
- count and item queries return the same filtered scope.

### 10.3 Actor tests

- approved IO group;
- approved RO group;
- approved CO group;
- unknown group;
- no group;
- multiple nonactor groups;
- conflicting actor groups;
- inactive user;
- action permission absent.

### 10.4 Workflow-state matrix

For one transaction at a time, assert it appears in exactly the expected queue:

- missing RO approval row is excluded as invalid/incomplete persistence, not displayed as Draft;
- RO Pending;
- RO For Correction;
- RO Approved + CO Pending;
- RO Approved + CO For Correction;
- RO Disapproved;
- CO Disapproved;
- fully approved/published.

For both Disapproved cases, assert `IsTerminal = true`, `IsActionable = false`, `ApprovalOwner = null/none`, and `AllowedActions` is empty. Assert RO-disapproved visibility for the applicable scoped IO and RO audiences, and CO-disapproved visibility for the applicable scoped IO, RO, and CO audiences. Unrelated offices/regions must not receive the row.

Critical regression:

> RO Approved + CO Pending belongs to CO regardless of the legacy `IODocPath` value. IO evidence is enforced at submit/resubmit, not by post-RO queue routing.

### 10.5 Row-level security

- IO cannot see another unauthorized creator/office's transaction;
- RO Region A cannot see Region B work;
- a user can see a transaction only when its stable `ProjectFK` is returned by the canonical visibility function;
- authorized CO scope behaves according to the approved central policy;
- changing display `ProjectId` does not break authorization because scope uses `ProjectFK`;
- totals and page cursors do not reveal the existence of unauthorized rows.

### 10.6 Pagination

- first, next, previous, and last navigation;
- empty and single-page results;
- exactly limit, limit+1, and multiple-page results;
- filter change resets cursors;
- stale cursor returns the defined conflict;
- no duplicates or omissions across a stable data set;
- stable `Id DESC` ordering when two rows share the same timestamp;
- totals reflect only authorized rows.

### 10.7 Frontend contract

- every rendered field exists in the response type;
- Project ID column renders `ProjectId`, not `TransactionId`;
- View uses `RevisionDetailId` and does not parse identity from Transaction ID;
- status text comes from the canonical queue status;
- actor actions follow `AllowedActions`;
- Disapproved rows have a terminal badge and no action control;
- work queue and history labels are unambiguous;
- loading, empty, 400, 403, 409, and 500 states are usable.

## 11. Implementation sequence

### Phase 0 - decisions and characterization

1. record the confirmed preservation of the current queue group mapping;
2. record IO scope as the exact published baseline's implementing office;
3. record that Save Draft is unsupported;
4. record that Disapproved remains visible as terminal, nonactionable information using the confirmed actor audience;
5. record Project ID as anchored prefix search with a minimum normalized length of 5;
6. capture current endpoint and SQL behavior in characterization tests.

Exit: all queue semantics have an approved owner decision.

### Phase 1 - safe backend contract

1. create typed request/response records;
2. create canonical actor resolver;
3. create typed queue query handler;
4. apply IO implementing-office, RO regional, and CO nationwide scope using stable baseline identity;
5. fix filters and safe error handling;
6. add controller/query tests.

Exit: backend returns only authorized rows with a stable tested contract.

### Phase 2 - SQL workflow alignment

1. update/replace `fRevisionQueue`;
2. remove legacy IO-document routing;
3. expose required IDs, owner, and status code;
4. include Disapproved as an explicitly terminal/nonactionable compatibility result without assigning it a false owner;
5. validate unique row behavior;
6. test the complete workflow-state matrix;
7. measure and tune the execution plan.

Exit: each unresolved transaction has exactly one correct active owner.

### Phase 3 - frontend compatibility

1. replace the legacy `RevisionLists` interface;
2. update rendering and navigation;
3. implement the selected cursor UX;
4. reset cursors on filters;
5. use `AllowedActions`;
6. show Disapproved without actions and preserve a clean future History split;
7. use only First/Previous/Next/Last navigation.

Exit: frontend contract tests and actor-specific UI tests pass.

### Phase 4 - integrated release gate

1. run backend, SQL, frontend, security, and pagination suites;
2. test with representative IO, RO, and CO accounts;
3. test cross-region access denial;
4. verify no document/SQL data is logged or exposed;
5. compare queue counts against direct approved SQL diagnostics;
6. deploy backend/SQL/frontend as one compatible release or behind a coordinated feature flag.

## 12. Required owner clarifications

### Confirmed 2026-08-11

1. Preserve the current `RevisionRequests` mapping: `RPC -> RO`, `DPDAdmin -> CO`, otherwise IO for an action-authorized caller.
2. IO visibility is implementing-office-wide, not creator-only and not region-wide.
3. The implementing-office comparison uses the exact published baseline, so an editable candidate value cannot alter pending access.
4. RO visibility is regional; CO visibility is nationwide after authorization.
5. Save Draft is not supported.
6. Fully approved Revisions are excluded from this page.
7. Disapproved Revisions remain visible for now but are terminal, informational, and ready for later History separation.
8. Project ID uses anchored prefix search only after the trimmed input length is greater than 4.
9. Filters are Project ID, Transaction ID, Type, optional Category, Reason, status, and submitted-date range. The misleading `CurrentStage` filter is removed.
10. Ordering is newest first with First/Previous/Next/Last cursor navigation and no arbitrary numbered-page jumps.
11. RO-disapproved rows are visible to the applicable scoped IO and RO audiences.
12. CO-disapproved rows are visible to the applicable scoped IO, RO, and CO audiences.

No business clarification remains open for the focused `RevisionRequests` refactor. Technical verification against the live database and implementation tests remain required before release.

## 13. Definition of done

`RevisionRequests` is complete only when:

- every filter maps to its own correct field and typed parameter;
- backend and frontend use one versioned contract;
- the preserved `RPC`/`DPDAdmin`/fallback-IO mapping behaves exactly as characterized;
- each row satisfies both workflow ownership and resource visibility;
- IO rows match `_Session.PlantillaOffice` against the exact published baseline's `ImplementingOffice`;
- RO rows remain inside the authenticated user's region and CO rows use authorized nationwide scope;
- no user-visible Draft state exists;
- the corrected IO-before-submit and CO-before-approve document sequence is reflected in queue ownership;
- Project identity and navigation use stable relational keys;
- pagination functions correctly across filters and mutations;
- Disapproved rows are visibly terminal/nonactionable and can be moved to History without changing the API status model;
- Disapproved visibility follows the confirmed RO-to-IO/RO and CO-to-IO/RO/CO audience matrix without crossing office/region security boundaries;
- Project ID prefix search requires at least 5 normalized characters;
- pagination is newest-first First/Previous/Next/Last keyset navigation;
- raw SQL errors are never returned;
- all tests in Section 10 pass;
- IO, RO, and CO acceptance testing confirms the same queue membership as the approved process matrix.
