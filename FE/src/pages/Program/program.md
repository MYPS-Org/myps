# Program Module — Developer Overview

The Program module manages the full lifecycle of infrastructure programs: creation, staged advancement, project assignment, bulk operations, and report generation. It has two views — a paginated program list (`Program.tsx`) and a per-program detail page (`ProgramDetail.tsx`).

---

## Folder Structure

```
pages/Program/
├── Views/
│   ├── Program.tsx              ← Program list page (paginated table)
│   └── ProgramDetail.tsx        ← Program detail page (form + projects table)
├── components/
│   └── programDetail/
│       ├── ActionsDropdown.tsx   ← Per-program actions: Import, Export, Generate Report
│       └── BatchActionsDropdown.tsx ← Batch project operations: Delete, Publish control
├── dialogs/
│   ├── index.ts                 ← Re-exports all dialogs
│   ├── AddProgramDialog.tsx     ← Create a new program
│   ├── DeleteProgramDialog.tsx  ← Delete with typed confirmation
│   ├── FilterDialogProgramList.tsx ← Advanced filters for program list
│   ├── NextStageDialog.tsx      ← Advance or skip program stage
│   ├── PublishProgramDialog.tsx ← Confirm publish to PCMA
│   ├── AddExistingProjectDialog.tsx ← Link existing projects to a program
│   ├── ImportProjectsJobDialog.tsx ← Live: upload → async job → poll → download reports
│   ├── ImportProjectsDialog.tsx ← Unused: old client-side parse + preview (kept for later reuse)
│   ├── ExportConfirmDialog.tsx  ← Confirm export to Excel
│   ├── AIPReportDialog.tsx      ← Configure and download AIP/RBP/RDIP reports
│   ├── BatchTagDialog.tsx       ← Batch operation input (IDs + action type)
│   └── ConfirmDialogBatch.tsx   ← Inner confirmation for batch operations
├── utils/
│   ├── parseImportFile.ts       ← Excel (.xlsm) → ImportedProject[] parser
│   └── transformImportedProjects.ts ← ImportedProject[] → server ImportProjectDTO
├── Service.ts                   ← All API calls for the Program domain
├── Model.d.ts                   ← TypeScript interfaces
├── AIP_REPORT_DIALOG_GUIDE.md   ← Developer notes on AIP report dialog
└── IMPORT_PROJECTS_GUIDE.md     ← Developer notes on import workflow
```

---

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/programs` | `Program.tsx` | Paginated program list |
| `/programs/programdetails/:program` | `ProgramDetail.tsx` | Program detail; `:program = "ProgramId:StageName"` |

Navigation from list → detail:
```ts
navigate(`/programs/programdetails/${program.ProgramId}:${program.StageName}`);
```

---

## Data Models (`Model.d.ts`)

### Core Interfaces

| Interface | Purpose |
|-----------|---------|
| `ProgramModel` | Payload for creating a new program (`AddProgram`) |
| `ProgramList` | Row shape used elsewhere (e.g. Project module's selected program header) |
| `ProgramLatest` | Row in the programs list table — `showprogram` response item (replaces `ParentProgram`); `ProgramPK` is the actual identifier (what `ProgramId` used to mean) |
| `ProgramDetails` | Full editable details for a single program revision |
| `ProgramDetailsEnums` | Full `ProgramDetails` page response: `{ Details, Projects, IsActive, Dropdowns }` |
| `ProgramDetailsWithStages` | Row in the expandable stages sub-table |
| `StageList` | Response from `ShowProgramStages`: `{ Stages: ProgramDetailsWithStages[] }` |
| `ProgramEnums` | Dropdown option for Groups/DataSecurity (participant-based) |
| `TableEnum` | Generic dropdown option `{ Id, NameId, Name, Description? }` |
| `ProgramFilter` | Filter fields: Name, StartYear, YearEnd, StageName, GroupName, Status, Type |

> Pagination + filter payloads are now carried by the shared ambient type `PaginatedRequest<TFilters>` (defined in `FE/src/types/Pagination.d.ts`). `ProgramPagination` has been removed.

### AIP Report Interfaces

| Interface | Purpose |
|-----------|---------|
| `AIPReportType` | `'AIP' | 'AIP02' | 'RBP' | 'RBPComponents' | 'RBPTier' | 'RDIP'` |
| `AIPReportParams` | Report generation payload: ProgramId, ReportType, optional filter fields |
| `AIPReportDropdowns` | All filter dropdowns: Categories, Regions, OperatingUnits, DEOs, ImplementingOffices, LegislativeDistricts |
| `AIPDropdownCategory` | Matches `tOptionProjectCategory` |
| `AIPDropdownRegion` | Matches `tOptionAdminAreaRegion` |
| `AIPDropdownOperatingUnit` | Matches `vAdminOperatingUnit` |
| `AIPDropdownDEO` | Matches `tOptionAdminAreaDistrictEngineeringOffice` |
| `AIPDropdownImplementingOffice` | Matches `vAdminImplementingOffice` |
| `AIPDropdownLegislativeDistrict` | Matches `tOptionAdminAreaCongressionalDistrict` |

---

## Service (`Service.ts`)

### Program CRUD

| Function | Endpoint | Payload | Notes |
|----------|----------|---------|-------|
| `fetchProgramEnums()` | `POST /Program/InitAddProgram` | null | Returns `{ Stages, Types, Groups, DataSecurity }` |
| `fetchProgram(PaginatedRequest<ProgramFilter>)` | `POST /program/showprogram` | `PaginatedRequest<ProgramFilter>` | Returns `PaginationResponse<ProgramLatest>` (now includes `HasNext`, `HasPrevious`, `NextFilteredId`, `PreviousFilteredId`) |
| `fetchProgramById(programId, StageName)` | `POST /Program/ProgramDetails` | `{ ProgramId, StageName }` | Returns `ProgramDetailsEnums` |
| `addProgram(ProgramModel)` | `POST /Program/AddProgram` | `ProgramModel` | Returns new `ProgramModel` with `Id` |
| `editProgram(ProgramDetails)` | `POST /Program/UpdateProgramDetails` | `ProgramDetails` | |
| `deleteProgram(ProgramList)` | `POST /Program/DeleteProgram/` | `ProgramList` | |
| `nextStage({ ProgramId, Stage, Name })` | `POST /Program/updateProgramStage` | stage advancement payload | |
| `fetchStagesByProgramId(programId)` | `POST /Program/ShowProgramStages` | `{ ProgramId }` | Returns `StageList` |
| `dowloadTemplate()` | `POST /Program/DownloadProgramTemplate` | null | Returns `{ link: string }` |

### Publishing

| Function | Endpoint | Payload |
|----------|----------|---------|
| `publishToPCMA(programId)` | `POST /PCMA/PublishProgram` | `{ ProgramId }` |

### Reports & Export

| Function | Endpoint | Response |
|----------|----------|---------|
| `downloadAIPReport(AIPReportParams)` | `POST /Reporting/Request*` (varies by type) | `{ blob, filename }` PDF |
| `fetchAIPReportDropdownData()` | `POST /Reporting/GetAIPReportDropdowns` | `AIPReportDropdowns` |
| `exportProjects(ProgramId, StageName)` | `POST /Reporting/RequestRawProjects` | `{ blob, filename }` Excel |

### Import & Batch Operations

| Function | Endpoint | Payload |
|----------|----------|---------|
| `importProjects(ImportProjectDTO)` | `POST /Importing/ImportProject/` | full import DTO |
| `batchDeleteProjects({ ProgramId, ProjectIds })` | `POST /Program/BatchDelete` | comma/newline-separated IDs string |
| `batchAllowPublishing({ ProgramId, ProjectIds })` | `POST /Program/BatchAllowPublish` | comma/newline-separated IDs string |
| `batchRestrictPublishing({ ProgramId, ProjectIds })` | `POST /Program/BatchRestrictPublish` | comma/newline-separated IDs string |

### Report Type → Endpoint Mapping

```ts
const endpoints: Record<AIPReportType, string> = {
    AIP:           '/Reporting/RequestReportAIP',
    AIP02:         '/Reporting/RequestReportAIP02',
    RBP:           '/Reporting/RequestReportRBP',
    RBPComponents: '/Reporting/RequestReportRBPComponents',
    RBPTier:       '/Reporting/RequestReportRBPTier',
    RDIP:          '/Reporting/RequestReportRDIP',
};
```

AIP/AIP02 payloads include all filter fields; RBP/RBPTier/RBPComponents/RDIP send only `{ ProgramId, RegionName }`.

---

## Views

### `Program.tsx` — Program List

**State**

| State | Type | Purpose |
|-------|------|---------|
| `pagination` | `ReturnType<typeof usePagination>` | All pagination state — data, active filters, loading flag, and navigation functions — owned by the `usePagination` hook. Replaces the former `ProgramData`, `ProgramFilters`, and combined `isLoading` local state. |
| `isEnumsLoading` | `boolean` | Loading state for the enum fetch triggered when the user first opens the Add Program or Filter dialog. Separate from `pagination.isLoading`. |
| `searchInput` | `string` | Controlled search input (separate from applied filter) |
| `programEnums` | `{ Stages, Types, Groups, DataSecurity }` | Lazy-loaded on first filter/add dialog open |
| `expandedRows` | `Set<string>` | Only one row expanded at a time |
| `stageLists` | `Record<string, StageList>` | Cached stage data per ProgramId (fetched on expand) |
| `selectedProgram` | `string \| null` | ProgramId targeted for delete |

**Key behaviors**

- Initial load: `usePagination` calls `fetchProgram` with `initialFilters` on mount
- Search: `handleSearchChange` updates input only; `handleSearchSubmit` or Enter calls `pagination.applyFilters` with updated Name filter (resets to page 1)
- Clear button: visible when `searchInput` or `pagination.currentFilters.Name` is set
- Filters badge count: counts non-empty StartYear / GroupName / StageName values
- Row expand: clicking program name toggles expanded state; stage data fetched once and cached
- Status badge colors: Working=orange, Approved=green, Pending=yellow, Rejected=red, Proposed=blue (applies to `TypeName` column via `getStatusBadge`)
- Pagination: `pagination.goToPage(n)` / `pagination.goNext()` / `pagination.goPrevious()` surfaced via `<PaginationBar />`; Next/Previous send the backend's keyset cursor (`NextFilteredId` / `PreviousFilteredId` + `Direction`), page-jump sends a plain page number

**Main table columns:** Name (expandable) | Status | Program Type | No. of Projects | Start Year | Actions (View + Delete)

**Expanded sub-table columns:** Stage Name | Type | Start Year | Projects | Amount | View Details

### `ProgramDetail.tsx` — Program Detail

**Route param:** `:program` split on `:` → `[ProgramId, StageName]`

**State**

| State | Type | Purpose |
|-------|------|---------|
| `programEnums` | `ProgramDetailsEnums` | Live/editable copy of program data |
| `defaultProgramEnums` | `ProgramDetailsEnums` | Snapshot from last server load for dirty-check |
| `nextStageName` | `string \| null` | Derived via `getStageProgression()` (`utils/stageProgression.ts`): name of the stage one position after `StageId` in the program's own stage track |
| `skipStageName` | `string \| null` | Derived via `getStageProgression()`: name of the stage two positions after `StageId` in the same track |
| `isTerminalStage` | `boolean` | Derived via `getStageProgression()`: true when `StageId` is the last stage in its track (no next stage) |
| `isSkipStage` | `boolean` | Whether the "Proceed" button targets skip (+2 position) vs next (+1 position) |

**`preventUpdate()`** — disables Update button when no editable field has changed. Compares: Name, YearStart, YearEnd, Status, Type, UserGroup (sorted), DataSecurityGroup (sorted).

**Editable fields:** Program Type (select), Status (select, disabled if `!IsActive`), User Groups (CheckboxList), Data Security Access (CheckboxList grouped by OrgType)

**Read-only fields:** Name, Start Year, Cost (currency formatted), Created Date, Created By

**Layout:**
```
[Left Column — 1/3 width]          [Right Column — 2/3 width]
  Form fields (editable)              Map placeholder
  User Groups CheckboxList            (future integration)
  Data Security CheckboxList
  Created Date / Created By
  [Proceed] [Proceed Skip] [Update]
```

**Stage Progression Buttons:**

| Condition | Button |
|-----------|--------|
| `IsActive && !isTerminalStage` | Proceed to {nextStageName} |
| `IsActive && StageId === 5` | Proceed to {skipStageName} |
| `IsActive` | Update (disabled if no changes) |

`isTerminalStage` is not a fixed StageId — it's `true` when the program's current stage is the last one in its stage track (see Stage Model below), computed positionally from the live `Dropdowns.Stages` list so it stays correct even if stages are added/removed/reordered via the Program Stage code table.

**Publish Program Button** (in Projects section header):
```ts
IsActive && isTerminalStage && defaultProgramEnums.Details.Status === 1
```

**Add Project Button** (in Projects section header):
```ts
IsActive && defaultProgramEnums.Details.Status === 3 && !isTerminalStage
```

**Add Existing Project Button:**
```ts
IsActive && !isTerminalStage
```

**Projects table columns:** Project ID | Description | Category | SubProgram | Implementing Office | Operating Unit | Publishable | Published

---

## Dialogs

### `AddProgramDialog`

- **Props:** `isOpen`, `onClose`, `onSubmit`, `programEnums`
- **Auto-name generation:** `StageName + " " + YearStart` (e.g., `"BP 2025"`)
- **Sub Name field:** appended on submit as `Name + " " + AddedName`
- **Type = 3 (TF) special case:** auto-sets Stage to 12 (TF) and disables the Stage select; name becomes `"TF {YearStart}"` (same `stageName + " " + yearStart` pattern as every other stage). Switching away from Type 3 resets Stage back to 0 and re-enables the select.
- **TF/TF-R (NameId 12/13) are excluded from manual Stage selection** — TF is only shown (and disabled) when Type is Trust Fund; TF-R never appears in this dialog.
- **Skip logic:** Stages NameId 5–11 auto-set `IsSkipped = true`
- **On success:** navigates to `programdetails/{newId}:{StageName}`

### `DeleteProgramDialog`

- **Guard:** submit button disabled until `confirmText.toLowerCase() === 'delete'`
- **Shows:** program Name
- **On success:** calls `onDeleteSuccess()` callback (caller refreshes list)

### `FilterDialogProgramList`

- **Props:** `currentFilters: ProgramFilter` / `onApplyFilters: (filters: ProgramFilter) => void` (previously typed as `ProgramPagination`; now uses `ProgramFilter` directly — no more nested `.filters` wrapper)
- **Filters:** StartYear (2000 to current+10), GroupName (from enums), StageName (from enums)
- **Clear:** resets StartYear/GroupName/StageName but preserves Name search term
- **Active filter badge:** counts non-empty filter values on the Filters button

### `NextStageDialog`

- **Parses existing name** on pattern `"Name - SubName"` → splits at first ` -`
- **Pre-fills:** base name (auto-regenerated from stage+year), sub name, stage, year
- **On submit:** calls `nextStage()` → parent navigates to new stage detail
- **Name format on submit:** `Name + " - " + AddedName` (if AddedName present)

### `PublishProgramDialog`

- Confirmation only; shows program name + PCMA warning
- Calls `publishToPCMA()` on confirm

### `AddExistingProjectDialog`

- Loads up to 500 projects; excludes those already belonging to this program
- Client-side search by: ProjectId, Description, ImplementingOffice, OperatingUnit, Category
- Checkbox per row; select-all visible rows
- On submit: passes `string[]` of selected ProjectIds to parent handler
- > NOTE: parent (`handleAddExistingProjectSubmit`) has a TODO — API call not yet wired

### `ImportProjectsJobDialog` (live — wired into `ActionsDropdown`)

- Accepts `.xlsx` / `.xlsm` via drag-and-drop or file picker
- No client-side parsing — the whole workbook is validated and written to the DB server-side, asynchronously
- Flow: `startImportProjectJob()` posts a single `multipart/form-data` request (`ProgramId`, `StageName`, `File`) straight to `/Importing/ImportProject` — the backend saves the upload to disk and enqueues the Hangfire job in that same call, returning `JobId` — then polls `getImportJobStatus()` (`/Importing/GetImportStatus`, `silent: true` so it doesn't flash the global preloader) every 2.5s until a terminal status
- The `multipart/form-data` POST needs `headers: { 'Content-Type': 'multipart/form-data' }` passed explicitly in `Service.ts` — `httpClient`'s axios instance defaults to `application/json`, and axios's own `transformRequest` will silently `JSON.stringify` a `FormData` body if the resolved Content-Type still says `application/json` at request time. Setting it to `multipart/form-data` (no boundary) short-circuits that check; axios/the browser then strips and replaces it with the real multipart boundary right before sending.
- Terminal states: `Completed`, `CompletedWithErrors`, `Failed`, `Cancelled` — shows `ValidCount`/`WarningCount`/`ErrorCount` plus download links for the always-present text report and the error-only Excel report (`TextFileUrl`/`ExcelFileUrl`, one-shot downloads — the backend deletes each file after it's served once)
- A 400 "Import In Progress" response (system-wide import lock) resets the dialog back to idle so the user can retry later; the `httpClient` interceptor already toasts the message, so the dialog does not toast it again
- On `Completed`/`CompletedWithErrors`, calls `onImported()` so the caller (`ActionsDropdown`) can refresh the project table

### `ImportProjectsDialog` (present but unused — kept for possible later reuse)

- Not opened from anywhere in the live UI as of this writing; `ActionsDropdown`'s "Import Projects" menu item opens `ImportProjectsJobDialog` instead
- Accepts `.xlsm` via drag-and-drop or file picker
- Validates `_ImportStatus` sheet: `STATUS = VALIDATED`, `SIGNATURE = MYPS-IMPORT-2026`
- Parses 4 sheets client-side: `PROJECT DETAILS`, `FUNDING PROFILE`, `COMPONENT DETAILS`, `MAJOR ITEMS OF WORK`
- 8-tab preview: Summary | Projects | Funding | Components | Cost/Year | Major Items | Locations | Errors
- Its `onSubmit` path called `parseImportFile` → `transformImportedProjects` → `importProjects()`, which POSTed a full parsed JSON payload to `/Importing/ImportProject/` — that JSON-body contract no longer exists on the backend (see `IMPORT_PROJECTS_GUIDE.md`), so this dialog cannot currently complete an import even if reopened

### `AIPReportDialog`

- **Available report types by stageId:**

  | Report Types | Condition |
  |-------------|-----------|
  | AIP, AIP02 | stageId ≤ 4 OR stageId ≥ 10 |
  | RBP, RBPComponents, RBPTier | stageId === 3 |
  | RDIP | stageId ≤ 2 |

- **Filter cascade (AIP/AIP02 only):** Region → DEO (by `RegionParticipantId`) → Implementing Office (by DEO region + UPMO) → Operating Unit (by IO)
- **RBP/RDIP:** Region filter only
- **On generate:** calls `downloadAIPReport()` → PDF blob download

### `BatchTagDialog`

- Actions: `delete`, `unpublish` (restrict), `publish` (allow)
- Project IDs entered as free text — split on commas, semicolons, spaces, newlines
- Intermediate confirm dialog (`ConfirmDialogBatch`) before executing
- Calls `batchDeleteProjects` / `batchRestrictPublishing` / `batchAllowPublishing`

### `ExportConfirmDialog`

- Confirmation only
- On confirm: calls `exportProjects()` → Excel blob download (`{ProgramId}_{StageName}_Projects.xlsx`)

---

## Components

### `ActionsDropdown` (per program)

- Gear icon (`Cog6ToothIcon`) button in ProgramDetail header
- Menu items: Download Template (TODO), Import Projects, Export Projects, Generate Report
- Opens `ImportProjectsJobDialog`, `ExportConfirmDialog`, `AIPReportDialog`

### `BatchActionsDropdown` (per program)

- Tag icon (`TagIcon`) button in ProgramDetail header
- Menu items: Batch Delete (always), Restrict Publishing + Allow Publishing (only when `IsActive && StageId=10 && defaultStatus=1`)
- Opens `BatchTagDialog` with the chosen action type

---

## Import Utilities (`utils/`)

### `parseImportFile.ts`

- Uses `xlsx` library to parse `.xlsm` files
- Validates `_ImportStatus` sheet before any data parsing
- Required signature: `MYPS-IMPORT-2026`
- Returns `ImportParseResult: { projects: ImportedProject[], errors: string[], totalRows }`
- Excel date serials converted via `XLSX.SSF.parse_date_code()`

### `transformImportedProjects.ts`

- Converts `ImportedProject[]` → `ImportProjectDTO` shape expected by `/Importing/ImportProject/`
- Flattens: `programDetails`, `projectDetails`, `fundingProfile`, `componentCosts`, `componentCostPerYear`, `majorItemOfWorks`, `majorItemLocations`

---

## Stage Model

Programs flow through stages defined in the (admin-editable, via CodeTables) `tOptionProgramStage` table, referenced by `StageId`. StageId values are **not** guaranteed to be contiguous or to match any fixed numbering — `getStageProgression()` (`utils/stageProgression.ts`) always derives "next"/"skip"/"terminal" positionally from the live, sorted `Dropdowns.Stages` list rather than assuming specific numbers.

Programs run on one of two independent stage tracks, split by `Details.Type`:

| Track | Stages (by Name, sorted by Id) | Who's on it |
|-------|-------------------------------|-------------|
| Main | BP → NEP → NEP-E → HGAB → HGAB-I → GAA → GAA-R | Any program where `Type !== 3` |
| Trust Fund | TF → TF-R | Programs where `Type === 3` (see `AddProgramDialog`'s Type=3 handling) |

RBP, RDIP, and PIP (NameId 8, 9, 11) are excluded from the "Proceed to next stage" progression entirely (`MAIN_PROGRESSION_EXCLUDED_STAGE_IDS` in `ProgramDetail.tsx`), so **GAA-R (NameId 7) is the terminal stage of the Main track** — reaching it shows the Publish/Add Project buttons, not another Proceed button.

Within a program's track, `isTerminalStage` is true when its `StageId` is the last stage of that track (no further stage exists to proceed to) — this is what gates the Publish/Add Project/Add Existing Project buttons instead of a hardcoded StageId.

The skip button (`StageId === 5`, i.e. HGAB-I → GAA-R) is a separate, curated business rule — not derived positionally — and is unrelated to `isTerminalStage`. It intentionally does **not** fire at GAA-R(7) anymore, since GAA-R is terminal and must not offer any further proceed/skip path.

`IsActive` controls whether the detail page allows editing.

---

## DataSecurity OrgType Mapping

| `OrgType` | Display Label |
|-----------|--------------|
| `C` | Central Office |
| `R` | Regional Offices |
| `B` | Bureaus |
| `PMO` | Project Management Offices |
| other | *(raw value)* |

---

## Dependencies

| Package | Usage |
|---------|-------|
| `@headlessui/react` | `Dialog`, `DialogPanel`, `DialogTitle` in all dialogs |
| `@heroicons/react/24/outline` | Various icons throughout |
| `react-router-dom` | `useNavigate`, `useParams` |
| `xlsx` | Excel parsing in `parseImportFile.ts` |
| `../../services/httpClient` | All API calls |
| `../../components/toaster/ToasterContext` | `useToast` in all dialogs |
| `../../components/ui/CheckboxList` | User Groups and Data Security multi-select |
| `../../components/tailwindui/*` | `Table`, `Button`, `Pagination`, `Select`, `Field` |
| `../../hooks/usePagination` | Pagination state + navigation for `Program.tsx` (`usePagination` hook) |
| `../../components/tailwindui/PaginationBar` | Shared pagination UI component used in `Program.tsx` |

---

## Known Notes / TODOs

| Item | Status |
|------|--------|
| `AddExistingProjectDialog` — API call not yet wired | TODO — handler only logs and refreshes |
| `ActionsDropdown` → Download Template | TODO — handler only logs |
| Map section in ProgramDetail | Placeholder — `MetroManilaMap` component commented out |
| `dowloadTemplate` typo in Service.ts | Should be `downloadTemplate` |
| `TableEnum` vs `TableEnums` | Duplicate named interfaces in model; `TableEnum` (singular) is used |