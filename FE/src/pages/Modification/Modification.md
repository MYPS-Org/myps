# Modification Module — Developer Reference

The **Modification** module handles the full lifecycle of project revision requests within MYPS — from initiating a revision (from the Project module), editing allowed project fields, submitting with a supporting document, and progressing through a Region → Central Office approval workflow.

> **Existing documentation in this folder (supplementary, not replaced by this file):**
> - `ARCHITECTURE_DIAGRAMS.md` — Jotai architecture visual guide
> - `FILE_REFERENCE.md` — Jotai store/hook file inventory
> - `EXCESS_COMPONENT_IMPLEMENTATION.md` / `EXCESS_COMPONENT_QUICK_REF.md` — EXC component logic
> - `CRUD_USAGE_EXAMPLE.md` — Example usage patterns

---

## Folder Structure

```
Modification/
  Model.d.ts                           # All TypeScript interfaces
  Service.ts                           # All API call functions

  views/
    ModifcationList.tsx                # Paginated list of revision requests
    ModificationDetails.tsx            # (mirror of ModifyProject — loads project for modification)
    ModifyProject.tsx                  # Main edit view — initiates revision from project context
    ViewRevision.tsx                   # Read+action view for reviewers (approve/reject/review)

  projectmodification/components/
    ProjectForm.tsx                    # Master form — orchestrates all sub-forms + dialogs
    RevisionForm.tsx                   # Top panel: shows category, reason, docs, field rules summary
    ProgramDetailsForm.tsx             # Program fields (mostly read-only in modification context)
    ProjectDetailsForm.tsx             # Project fields (editable based on field rules)
    ComponentCostForm.tsx              # Component costs table + add/edit/delete
    MajorItemOfWorksForm.tsx           # Major items of work table + add/edit/delete + copy
    WorkLocationTable.tsx              # Nested work location rows per major item
    FundingProfileForm.tsx             # Funding profile section
    NotesForm.tsx                      # Notes section
    ActivitySection.tsx                # Activity/transaction log section

  dialogs/
    ModifiyProjectDialog.tsx           # Legacy adjustment dialog (mostly stub — see notes)
    RevisedProjectDialog.tsx           # Submit new revision request (first submission)
    ResubmitRevisionDialog.tsx         # Resubmit after "For Review" rejection
    ApproveModifyDialog.tsx            # Approve revision (CO/Region reviewer)
    RejectModifyDialog.tsx             # Disapprove revision with reason
    ForReviewModifyDialog.tsx          # Return to requester for corrections
    TerminationDialog.tsx              # Termination: asks "Has unfinished work?"
    NonImplementableDialog.tsx         # Select components to mark non-implementable
    ExcessPrompt.tsx                   # Warn user when project cost > component total
    ComponentCostDialog.tsx            # Add/Edit component cost (with per-year rows)
    AddMajorItemDialog.tsx             # Add/Edit major item of work
    CopyMajorItemDialog.tsx            # Copy an existing major item
    AddProjectDialog.tsx               # (stub)
    deleteDialog/
      DeleteComponentDialog.tsx        # Confirm delete component (cascades to major items/locations)
      DeleteMajorItemDialog.tsx        # Confirm delete major item
      DeleteWorkLocationDialog.tsx     # Confirm delete work location

  atoms/
    componentCosts.atom.ts             # componentCostsAtom, componentCostPerYearAtom
    majorItemOfWorks.atom.ts           # MajorItemOfWorksAtom, MajorItemLocationsAtom, ScopeOfWorkEnumAtom, derived MajorItemOfWorksWithDropdownAtom
    majorItemLocations.atom.ts         # Standalone MajorItemLocationsAtom (duplicate reference)

  store/
    fieldPermissionStore.ts            # Jotai atoms for PCMA/package status, case, field rules
    routeContextStore.ts               # transactionIdAtom (URL param source of truth)
    deleteWorkLocationDialogStore.ts   # Dialog state atoms for work location deletion

  hooks/
    useFieldPermissions.ts             # Hooks to read/check field editability from Jotai
    useComponentCosts.ts               # CRUD + delete-dialog logic for component costs (cascades)
    useMajorItemOfWorks.ts             # CRUD for major items of work
    useMajorItemLocations.ts           # CRUD for work locations, decoupled from major items
    useDeleteWorkLocationDialog.ts     # Wrapper hook for delete work location dialog atoms
    useTransactionId.ts                # Reads transactionId from URL param, writes to atom

  conditions/
    ExcessComponentAutomation.ts       # Detect project cost > component total, prompt EXC creation
    AddExcessComponent.ts              # Helper to construct EXC ComponentCost object
    TerminationNoDisbursementAutomation.ts  # Auto-zero terminated components, add EXC for reasonId=37
    ExcessComponentAutomation.examples.ts   # Examples (non-production)
    README.md                          # Conditions usage guide

  utils/
    revisionNavigation.ts              # Route builders per RevisionGroupId, TransactionId parser
    pcmaStatusHelper.ts                # Derive PCMA + Package status from ComponentsStatus array

  components/
    AdjustmentRulesTester.tsx          # Dev-only rules tester UI
    LocationDetails.tsx                # View for location detail data
    MajorItemWorkLocationTable.tsx     # Table for major item work locations
    modificationCases.tsx              # Case visualization (dev tool)
    OrganizationalResponsibilities.tsx # Org responsibilities display
    WorkLocationTable.tsx              # Standalone work location table (standalone component)
```

---

## Routing

Routes are constructed by `getRevisionNavigationPath()` in `utils/revisionNavigation.ts`.

| RevisionGroupId | Path Pattern | Category |
|---|---|---|
| 1 | `/revision/modification/{project}:{stage}` | Modification |
| 6 | `/revision/adjustment-details/{project}:{stage}` | Adjustment |
| 7 | `/revision/change-in-authority/{project}:{stage}` | Change in Authority |
| 8 | `/revision/non-implementable/{project}:{stage}` | Non Implementable |
| 9 | `/revision/termination/{project}:{stage}` | Termination |
| 10 | `/revision/additional-funding/{project}:{stage}` | Additional Funding |
| 11 | `/revision/for-savings/{project}:{stage}` | For Savings |
| 12 | `/revision/change-in-funding/{project}:{stage}` | Change in Funding |
| 13 | `/revision/mode-of-implementation/{project}:{stage}` | Mode of Implementation |
| 14 | `/revision/multi-year-costing-changes/{project}:{stage}` | Multi-Year Costing |
| 15 | `/revision/expire-funding/{project}:{stage}` | Expired Funding |
| 16 | `/revision/change-of-creditor/{project}:{stage}` | Change of Creditor |

**View route** (from ModificationList): `/revision/view/{modificationType}/{transactionId}`

### TransactionId Format

```
{ProjectId}-{RevisionNumber}    e.g.  P00900117LZ-1
```

`parseTransactionId()` splits on `-`: first part = ProjectId, second = revision number. StageName is extracted from the last 2 characters of ProjectId.

---

## Navigation State

All modification views receive context via React Router `location.state`. Key fields passed:

| Field | Type | Source |
|---|---|---|
| `stageName` | `string` | Project context |
| `revisionTypeId` | `number` | RevisionGroupId |
| `revisionGroupId` | `number` | Same as revisionTypeId |
| `revisionTypeDescription` | `string` | Human-readable revision name |
| `categoryDesc` | `string` | Category name (from project selection) |
| `reasonDesc` | `string` | Reason description |
| `categoryId` | `number \| null` | Category numeric ID |
| `reasonId` | `number` | Reason numeric ID |
| `transactionId` | `string` | Present in view mode |
| `isViewMode` | `boolean` | `true` in ViewRevision |

---

## Service Layer (`Service.ts`)

All calls use `httpClient.post<T>()`.

| Function | Endpoint | Body | Return |
|---|---|---|---|
| `fetchRevisionData(projectId, header, category, reason)` | `POST /Revision/ReviseProject` | `{ ProjectId, RevisionHeader, RevisionCategory, RevisionReason }` | `RevisionProjectPayload` |
| `fetchReviseProjectDetails(transactionId)` | `POST /Revision/ViewReviseProject` | `{ TransactionId }` | `RevisionProjectPayload` |
| `fetchModificationList(data)` | `POST /Revision/RevisionRequests` | `RevisionPagination` (cursor pagination — see below) | `PaginationResponse<RevisionLists>` |
| `submitModificationRequest(payload)` | `POST /Revision/RequestRevision` | Full payload (see below) | `ApiTransactionResult` (`{ Title, Message, TransactionId }`) |
| `ResubmitRevisionRequest(payload)` | `POST /Revision/ResubmitRevision` | Full payload + TransactionId | `ApiTransactionResult` |
| `updateRevisionRequestStatus(txId, status, doc?, date?, remarks?)` | `POST /Revision/UpdateRevisionStatus` | `{ TransactionId, Status: EnumRevisionStatus, Document?, ApprovalDate?, Remarks? }` | `ApiMessageResult` |
| `getLabelField(payload)` | `POST /IORevision/GetLabelField/` | `{ categoryDesc, reasonId, projectId }` | — |

### Submit Payload Structure

```ts
{
  RevisionDetails: {
    CategoryId?: number | null;
    ReasonId: number;
    ApprovalDate: string;
    ApprovedDocument: FileUpload; // { Name, Extension, ContentType, DataUrl }
  };
  ProjectDetails: ProjectDetails;
  ComponentCosts: ComponentCost[];
  ComponentCostPerYear: ComponentCostPerYear[];
  MajorItemOfWorks: MajorItemOfWork[];
  MajorItemLocations: MajorItemLocations[];
  FundingProfile: FundingProfile[];
}
```

Resubmit adds a `TransactionId` field at the top level.

### Cursor Pagination (`RevisionPagination` / `RevisionFilter`)

`RevisionPagination` is now `PaginatedRequest<RevisionFilter>` (the same keyset-cursor convention used by `Project`/`Program` list pages — see `FE/src/types/Pagination.d.ts` and `FE/src/hooks/usePagination.ts`). `ModifcationList.tsx` uses the shared `usePagination` hook + `PaginationBar` component instead of hand-rolled page state. `RevisionFilter` fields: `TransactionId`, `ProjectId`, `RevisionType`, `RevisionStatus`, `CurrentStage` (only `ProjectId` is currently wired to a search input).

### Status Codes (`EnumRevisionStatus`, `Model.d.ts`)

Exposed as a `const` object + type (not a real TS `enum` — this project's tsconfig sets `erasableSyntaxOnly`, which disallows enums since they emit non-erasable runtime code):

| Value | Meaning |
|---|---|
| `EnumRevisionStatus.Pending` (0) | Pending |
| `EnumRevisionStatus.Approved` (1) | Approved |
| `EnumRevisionStatus.Rejected` (2) | Disapproved (Rejected) |
| `EnumRevisionStatus.ForCorrection` (3) | For Review / Return for Corrections |

---

## `Model.d.ts` — Type Reference

### `RevisionProjectPayload`

Extends `ProjectFormPayload` (from Project module). Additional fields:

```ts
Header: OptionRevisionHeader;       // Revision header (RevisionGroupId, RevisionName)
Category: OptionRevisionCategory;   // CategoryId, CategoryName
Reason: OptionRevisionReasons;      // ReasonId, Reason
ProjectStatus: PackageStatus;       // ConstructionStatus, PackageStatus, RevisionStatus
Rules: Rules;                       // Field editability rules from API
ComponentsStatus: ProjectComponentStatus[];
RevisionDetails?: RevisionDetails;
ForCorrectionsDetails?: ForCorrectionsDetails[];
RevisionDocs?: RevisionDoc[];
```

### `Rules`

```ts
interface Rules {
  Id: number;
  Reason: string;
  RevisionGroupId: number;
  ReasonId: number;
  PCMA_Status?: string;
  Package_Status?: string;
  Field: string;  // JSON string — parsed into FieldRules
}
```

### `FieldRules` (parsed from `Rules.Field`)

```ts
interface FieldRules {
  ProjectDetailsRules?: Record<string, boolean>;
  ComponentCostRules?: FieldRuleSection;
  ComponentCostYearRules?: FieldRuleSection;
  MajorItemOfWorkRules?: FieldRuleSection;
  MajorItemLocationRules?: FieldRuleSection;
  FundingProfileRules?: FieldRuleSection;
}

interface FieldRuleSection {
  Fields: Record<string, boolean>;  // field name → editable (true/false)
  CRUD: CRUDRules;                   // CanAdd, CanDelete, Message
}

interface CRUDRules {
  Message?: string;
  CanAdd: boolean;   // real boolean — was previously (incorrectly) typed/compared as string
  CanDelete: boolean;
}
```

### `RevisionDetails`

Key status fields:

```ts
interface RevisionDetails {
  TransactionId: string;
  RevisionGroupId: number;
  RegionStatus: number;    // Region approval status code
  COStatus: number;        // Central Office approval status code
  IODocApprovalDate?: string;
  ...
}
```

### `PackageStatus`

```ts
interface PackageStatus {
  ConstructionStatus: string;   // 'Not yet started' | 'On-going' | 'Completed' | 'Terminated'
  PackageStatus: string;        // 'packaged' | 'not packaged'
  RevisionStatus: string;       // Current revision workflow status text
}
```

---

## Jotai State Architecture

### `store/fieldPermissionStore.ts` — Field Permission Atoms

| Atom | Type | Purpose |
|---|---|---|
| `pcmaStatusAtom` | `string` | PCMA construction status |
| `packageStatusAtom` | `string` | Package status |
| `modificationContextAtom` | `ModificationContext` | `{ category, reason, reasonId }` |
| `fieldRulesAtom` | `FieldRules \| null` | Parsed API field rules (set after `Rules.Field` is JSON-parsed) |
| `currentCaseAtom` | `'CaseA' \| 'CaseB' \| 'CaseC' \| undefined` | Derived from PCMA + package status |
| `fieldPermissionsAtom` | `FieldPermissions \| null` | Derived: full permissions object including `editableFields[]` |
| `isFieldEditableAtom(name)` | factory → derived atom | `true/false` for a specific field |
| `fieldEditStatusAtom(name)` | factory → derived atom | `{ canEdit, reason, ruleGroup }` |
| `setStatusFromAPIAtom` | write-only | Sets pcma + package status from API |
| `setModificationContextAtom` | write-only | Updates category/reason/reasonId |
| `setFieldRulesAtom` | write-only | Sets parsed `FieldRules` from API |
| `resetStatusAtom` | write-only | Clears all status + rules |
| `crudRulesAtom` | derived | CRUD permissions per section |
| `canAddItemAtom` | derived | Can add items (from CRUD rules) |
| `canDeleteItemAtom` | derived | Can delete items (from CRUD rules) |

### Case Determination Logic

```
PCMA "Not yet started" + Package "not packaged"   → CaseA  (most permissive — all fields)
PCMA "Not yet started" OR "On-going" + "packaged"  → CaseB  (limited fields)
PCMA "Completed" OR "Terminated"                   → CaseC  (no fields editable)
Default (unrecognized)                             → CaseC
```

### `store/routeContextStore.ts`

| Atom | Purpose |
|---|---|
| `transactionIdAtom` | Source of truth for the current transactionId. Read by approval dialogs to avoid prop drilling. Written by `useTransactionId` hook and `ViewRevision` on mount. |

### `store/deleteWorkLocationDialogStore.ts`

Atoms: `deleteWorkLocationDialogOpenAtom`, `selectedWorkLocationForDeleteAtom`, `deleteWorkLocationIndexAtom`, `deletingWorkLocationAtom`, `canShowDeleteWorkLocationDialogAtom`, `openDeleteWorkLocationDialogAtom` (action), `closeDeleteWorkLocationDialogAtom` (action).

### `atoms/componentCosts.atom.ts`

| Atom | Purpose |
|---|---|
| `componentCostsAtom` | `ComponentCost[]` — current list |
| `componentCostPerYearAtom` | `ComponentCostPerYear[]` — per-year breakdown |

### `atoms/majorItemOfWorks.atom.ts`

| Atom | Purpose |
|---|---|
| `MajorItemOfWorksAtom` | `MajorItemOfWork[]` — raw major items |
| `MajorItemLocationsAtom` | `MajorItemLocations[]` — all locations for all items |
| `ScopeOfWorkEnumAtom` | `ScopeOfWorkEnum[]` — scope dropdown data |
| `MajorItemOfWorksWithDropdownAtom` | Derived — major items enriched with their locations + scope dropdown filtered by InfraType |

---

## Custom Hooks

### `useFieldPermissions()`

Read-only. Returns `{ pcmaStatus, packageStatus, context, currentCase, permissions, fieldRules }`.

Used in `ProjectForm` to know what fields are editable. Components call `useIsFieldEditable(fieldName)` for a single boolean or `useFieldsEditable(names[])` for a bulk map.

### `useAPIIntegration()`

Write hooks. Returns `{ setStatusFromAPI(pcma, pkg), setModificationContext(ctx), setFieldRules(rules), reset() }`. Used in `ModifyProject` and `ViewRevision` after API call to hydrate Jotai atoms.

### `useComponentCosts()`

Full CRUD + delete-dialog for component costs. Key methods:

| Method | Effect |
|---|---|
| `seedFromInitial({ ComponentCosts, ComponentCostPerYear })` | Replaces atom state from initial data |
| `add(cost, costPerYear?)` | Appends to atom |
| `update(componentId, updated, costPerYear?)` | Replaces matching item |
| `remove(componentId)` | Hard-removes from atom |
| `removeByIndex(index)` | Soft-deletes (sets `IsDeleted=true`) |
| `confirmDelete()` | Cascades: soft/hard-deletes component + per-year rows + major items + locations |
| `openDelete(component, index)` | Opens delete confirmation dialog |
| `total()` | Sums all non-deleted component totals |

**Cascade delete logic:**
- `Id === 0` → hard-delete (filter out of array)
- `Id > 0` → soft-delete (set `IsDeleted: true`)
- Cascades to `ComponentCostPerYear` (by `CostId`), then to `MajorItemOfWork` (by `ComponentId`), then to `MajorItemLocations` (by `ReferenceId`)

### `useMajorItemOfWorks()`

CRUD for major items. `deleteMajorItem(index)` cascades to locations (hard-delete Id=0, soft-delete Id>0). `MajorItemOfWorksWithDropdownAtom` provides the UI-ready derived list.

### `useMajorItemLocations()`

Standalone CRUD for work locations, decoupled from major items. Provides `addWorkLocation`, `editWorkLocation(parentId, index, updated)`, `deleteWorkLocation(parentId, index)` (hard-delete Id=0, soft-delete Id>0), `getLocationsByParentId(parentId)`.

### `useDeleteWorkLocationDialog()`

Wrapper around `deleteWorkLocationDialogStore` atoms. Returns `{ isOpen, selectedWorkLocation, deleteIndex, openDeleteDialog(loc, idx), closeDeleteDialog() }`.

### `useTransactionId()`

Reads `transactionId` from `useParams`, writes to `transactionIdAtom`. Used in views that need `transactionId` accessible both as a hook return and in Jotai.

---

## Views

### `ModifcationList.tsx` (note typo in filename)

**Entry point**: navigated from Project Details module with `location.state = { projectId, stageName, revisionTypeId, revisionTypeDescription }`.

- Fetches `fetchModificationList()` on mount with `RevisionPagination`
- Search by `ProjectId` filter
- Paginated table columns: Revision Name, Reason, Region Status, CO Status, Created By, Date
- Status badges mapped to color: For Correction → red, Disapproved → dark red, For Approval → yellow, Approved → green
- Row click → `handleViewDetails()` → parses `TransactionId` → navigates to `/revision/view/{modificationType}/{transactionId}`
- If `state.revisionTypeId === 6` on mount → auto-opens `AdjustProjectDialog` (legacy Adjustment flow)

### `ModifyProject.tsx`

Loaded when initiating a revision from the Project Details page.

- URL param: `project` = `{ProjectId}:{StageName}`
- `location.state`: categoryDesc, reasonDesc, reasonId, categoryId, revisionGroupId
- On mount: calls `fetchRevisionData(projectId, revisionGroupId, categoryId, reasonId)` → `POST /Revision/ReviseProject/`
- Sets Jotai atoms: `setStatusFromAPI`, `setModificationContext`, `setFieldRules` (includes JSON repair logic for malformed brace-count)
- Renders `<ProjectForm initialData={...} mode="edit" ...>`

### `ViewRevision.tsx`

Loaded when reviewing an existing revision from the list.

- URL param: `transactionId`
- On mount: calls `fetchReviseProjectDetails(transactionId)` → `POST /Revision/ViewReviseProject/`
- Sets `transactionIdAtom` (so approval dialogs can read it)
- Sets Jotai atoms: `setModificationContext`, `setStatusFromAPI`, `setFieldRules`
- Renders `<ProjectForm mode="edit" ...>` — same form, but action buttons change based on `revisionStatus`
- `onActionSuccess` callback navigates back to `/revision`

---

## `ProjectForm.tsx` — Master Form

`ProjectForm` is the central composition component. It controls:

- Section accordions (Revision Info, Program Details, Project Details, Map, Component Costs, Major Items, Funding Profile, Notes, Activity)
- Jotai atom seeding (`seedFromInitial`, `seedFromInitialData`) on `initialData` change
- Map GeoJSON loading
- Termination No Disbursement automation (`applyTerminationNoDisbursementAutomation`) on reasonId 37
- Action buttons (from `RevisionActionButtons` component) — which buttons appear depends on `revisionStatus`
- Dialog state management (open/close flags for all dialogs)
- Excess component check (`checkExcessComponent`) before submit

**Props:**

| Prop | Type | Description |
|---|---|---|
| `initialData` | `RevisionProjectPayload?` | Full project data from API |
| `mode` | `'add' \| 'edit' \| 'view'` | `'edit'` in modification context |
| `category` | `string?` | Modification category |
| `reason` | `string?` | Modification reason |
| `reasonId` | `number?` | Reason numeric ID |
| `categoryId` | `number?` | Category numeric ID |
| `revisionGroupId` | `number?` | Revision group |
| `onActionSuccess` | `() => void?` | Called after approve/reject to navigate back |

**Key derived values in form:**
- `isDisabled` — `true` when `ProgramDetails.Status === 1` (approved) — disables all editing
- `revisionStatus` — read from `initialData.ProjectStatus.RevisionStatus` — controls which action buttons show

---

## Rules System

Field editability is driven **exclusively** by the API's `Rules.Field` JSON, parsed into `fieldRulesAtom` (see `store/fieldPermissionStore.ts` above). There is no client-side rule engine.

> The `rules/` folder (`RuleManager.ts`, `AllowedFields.ts`, `AdjustmentFields.ts`, `ChangeInAuthority.ts`, `AdditionalFund.ts`, `Termination.ts`, `NIAbandonmentForSavings.ts`, `NIDelisted.ts`, `NIReversion.ts`, `ModeOfImplementation.ts`) and the unrouted `TestAllowedFields.tsx` demo page previously implemented a duplicate, hardcoded Case A/B/C rule engine. It was never wired into `useFieldPermissions`/`fieldRulesAtom` (confirmed via a repo-wide reference check) and was removed as dead code — production field control has always come from `fieldRulesAtom`, populated from `data.Rules.Field`.

---

## Conditions / Automations

### Excess Component Automation (`ExcessComponentAutomation.ts`)

Triggers when submitting if: `projectCost > totalComponentCost` AND category is one of: Adjustment, Change in Authority, For Savings - Partial Unutilized Balance, Non Implementable, Termination.

Flow:
1. `checkExcessComponent(category, projectCost, totalComponentCost)` → returns `{ shouldPrompt, excessAmount, message }` or `null`
2. If non-null: `ExcessPrompt` dialog opens
3. User clicks **OK** → `addExcessComponent()` creates a new `ComponentCost` with `ComponentType: 'EXC'`, `ComponentId: 'EXC-{timestamp}'`, `Description: 'Excess - Intentional Project Cost Reduction'`, `Total: excessAmount`
4. User clicks **Cancel** → no component created

### Termination No Disbursement Automation (`TerminationNoDisbursementAutomation.ts`)

Triggers in `ProjectForm` when `reasonId === 37`.

Flow:
1. Finds all components where `ConstructionStatusName === 'terminated'`
2. Sets their `Amount` to 0
3. Creates EXC component for the sum of original terminated amounts
4. This happens automatically on mount when the reason is detected

### PCMA / Package Status Derivation (`pcmaStatusHelper.ts`)

`determinePCMAStatus(componentsStatus[])`:
- Any component On-Going → "On-Going"
- All Completed → "Completed"
- All Not yet started → "Not yet started"
- All Terminated → "Terminated"
- Mixed → "Not yet started"

`determinePackageStatus(componentsStatus[])`:
- All packaged → "Packaged"
- Otherwise → "Not Packaged"

---

## Dialogs

### Submit / Resubmit Dialogs

| Dialog | Trigger | API Call | Notes |
|---|---|---|---|
| `RevisedProjectDialog` | Initial submit action | `submitModificationRequest()` | Requires approval date + PDF upload + "I certify" checkbox |
| `ResubmitRevisionDialog` | After "For Review" status | `ResubmitRevisionRequest()` | Same fields + includes `TransactionId` from atom |

Both read `transactionIdAtom` for existing revision identification. PDF file validation: only `.pdf` accepted. File converted to base64 `DataUrl`.

### Approval Workflow Dialogs

| Dialog | Status Code | Required Input | Navigation after success |
|---|---|---|---|
| `ApproveModifyDialog` | `EnumRevisionStatus.Approved` | CO (`AUC` group) approval requires a PDF document; RO (`RPC` group) requires none | `onSuccess()` or `/revision` |
| `RejectModifyDialog` | `EnumRevisionStatus.Rejected` | Rejection reason (text, required) | `onSuccess()` or `/revision` |
| `ForReviewModifyDialog` | `EnumRevisionStatus.ForCorrection` | Review comments (text, required) | `onSuccess()` or `/revision` |

All three read `transactionIdAtom` directly via `useAtomValue`. All call `updateRevisionRequestStatus(txId, status, ...)`. `ApproveModifyDialog` detects RO vs CO via `useAuth()`'s `user.UserGroupNames` (same pattern as `RevisedProjectDialog`/`ResubmitRevisionDialog`).

### `TerminationDialog`

Asks: "Does this project have unfinished work?" Yes/No required. Calls `onSubmitTermination(hasUnfinishedWork)` which is handled in `ProjectForm`.

### `NonImplementableDialog`

Table of current `ComponentCost` items with status columns and checkboxes. User selects which components to mark. Validates at least one component selected before calling `onConfirm(selectedComponentIds[])`.

### `ComponentCostDialog`

Add or edit a component cost. Features:
- `autoFillComponentDescription()` button to pull description from API
- Per-year cost rows (`ComponentCostPerYear[]`) — add/remove year rows inline
- `maxAmountCost` cap validation
- Reads field permissions via `useFieldPermissionState()` to disable fields per API rules
- "Change of Creditor" mode (`isChangeOfCreditor`) alters which fields are shown

### `AddMajorItemDialog`

Add or edit a major item. In `mode='add'` all fields are always editable. In `mode='edit'`, fields are controlled by `MajorItemOfWorkRules.Fields` from `fieldRulesAtom`. EAO, EXC, SAV component types are filtered out from the dropdown for applicable categories.

---

## `RevisionForm.tsx` — Revision Info Panel

Top section of `ProjectForm`. Displays:
- Category, Reason, Project ID (read-only)
- Supporting document table (attached PDFs)
- For Corrections history (if revision was returned)
- Field editability summary — groups editable vs non-editable fields by rule group for transparency

---

## `utils/revisionNavigation.ts`

Two exports:
1. `getRevisionNavigationPath(revisionGroupId, projectId, stageName)` → URL string for navigating into the modification form
2. `parseTransactionId(transactionId)` → `{ projectId, revision, stageName }` for extracting context from a transaction

---

## Known Issues / Notes

- **Filename typo**: `ModifcationList.tsx` is missing an `i` — should be `ModificationList.tsx`. File is referenced correctly in routes.
- **`ModificationDetails.tsx`**: Appears to duplicate `ModifyProject.tsx` functionality. Both load `ProjectForm` with the same data-fetching pattern. Likely an early split that wasn't fully differentiated.
- **`ModifiyProjectDialog.tsx`**: Legacy dialog mostly stubbed out. Dropdown renders a select with no options. Was the original Adjustment dialog; superseded by the `ProjectForm` approach.
- **API-first field rules**: Field editability is always driven by `Rules.Field` from the API (parsed into `fieldRulesAtom`). If `Rules.Field` is missing or malformed, the system attempts to repair it by counting mismatched braces. The formerly-documented `RuleManager`/`AllowedFields` client-side fallback engine has been removed (see Rules System above) — it was dead code, never wired into this flow.
- **TransactionId atom timing**: `transactionIdAtom` is written by `ViewRevision` on mount. Approval dialogs that open before the atom is set will have an empty string — guarded by checking `transactionId` before calling API.
- **`majorItemLocations.atom.ts` duplication**: `MajorItemLocationsAtom` is exported from both `majorItemLocations.atom.ts` and `majorItemOfWorks.atom.ts`. Components should import from `majorItemOfWorks.atom.ts` to ensure the same atom instance is shared with `MajorItemOfWorksWithDropdownAtom`.
- **`RevisionDetails.RegionStatus`/`COStatus` never existed post-migration — verified and fixed 2026-08-18**: `ViewReviseProject`'s `RevisionDetails` payload comes from `fRevisionDetail()`, shaped by `DBHelper/Models/Functions/Revision/RevisionDetail.cs` — it has no `RegionStatus`/`COStatus`/`CreatedBy` at all (only `CurrentStage` and `RevisionCreatedBy`). The FE `RevisionDetails` type in `Model.ts` and `getRevisionActions()` were both still written against the pre-migration shape, so every role-gated action button (`Approve`/`For Correction`/`Disapprove`/`Re-Submit Revision`) silently read `undefined` and could never show for the cases that depended on `RegionStatus`/`COStatus`/`CreatedBy`. Fixed by retyping `RevisionDetails` to the real shape and switching `getRevisionActions()` to gate on `ProjectStatus.RevisionStatus` (the one status string the API does return) instead. Known limitation: that string is collapsed server-side (`ApprovalStatus.ROStatus`/`COStatus` are computed in `RevisionController.ViewReviseProject` but never serialized into the response) and can't distinguish "awaiting RPC (region)" from "awaiting AUC (central office)" — AUC and RPC currently share one pending-approval gate as a result. Splitting that correctly requires a backend change to return both statuses.
- **Published-project gate — removed from code, doc was stale**: `getRevisionActions()` no longer has an `isPublished` gate (removed in commit `08d012fb`, "Refactor PDF upload handling ... align with normalized revision API"); the "Submit Revision Request to RO/CO" actions are no longer client-side gated on publish status. The backend's `Project Not Published` error is still surfaced verbatim as a blocking notice in `ModificationDetails.tsx`.
- **Blocked revision groups (9 = Termination, 13 = Mode-of-Implementation) and LS/wallet Projects**: These are enforced server-side. `ModificationDetails.tsx` shows the backend's exact `Title`/`Message` (`Revision Type Temporarily Blocked`, `Revision Reason Requires Confirmation`, `Pending Modification Request`, `Project Not Published`) as an in-page blocking notice instead of a generic redirect. The Revision Type/Category/Reason selection UI itself lives in the `Project` module, outside this folder.