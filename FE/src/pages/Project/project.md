# Project Module — Developer Reference

## Overview

The Project module (`FE/src/pages/Project/`) is the most complex domain in the MYPS frontend. It manages the full lifecycle of infrastructure projects: creation, editing, multi-stage versioning, revision, and lump-sum import. Projects always belong to a Program (via `ProgramId`) and are scoped to a pipeline stage (`StageName`).

---

## Folder Structure

```
FE/src/pages/Project/
  Model.d.ts                     # All TypeScript interfaces
  Service.ts                     # All API calls
  Views/
    Project.tsx                  # Paginated list view
    AddProject.tsx               # Thin wrapper for add mode
    EditProject.tsx              # Load + render edit mode
  components/
    ProjectForm.tsx              # Central form orchestrator (~1000 lines)
    ProgramDetailsForm.tsx       # Program picker (add) / read-only display (edit)
    ProjectDetailsForm.tsx       # Project detail fields + cascading geo dropdowns
    ComponentCostForm.tsx        # Component cost table with budget indicator
    FundingProfileForm.tsx       # Funding source/amount/percentage table
    MajorItemOfWorksForm.tsx     # Major items table with expandable work-location rows
    WorkLocationTable.tsx        # Infrastructure location rows (nested inside major item)
    NotesForm.tsx                # Supporting documents upload/list
    ActivitySection.tsx          # Activity log + transaction logs (timeline UI)
  dialogs/
    ComponentCostDialog.tsx      # Add/edit component cost + per-year breakdown
    AddMajorItemDialog.tsx       # Add/edit major item of work
    AddInfraDialog.tsx           # Select infrastructure (road/bridge) for a work location
    AddNoteDialog.tsx            # Upload supporting document (PDF only)
    ImportLumpsumDialog.tsx      # Import lump-sum data from Excel (.xlsx)
    RevisionDialog.tsx           # Create a revision (category + reason picker)
    SaveProjectConfirmDialog.tsx # Confirmation before save/update
    ProceedAddProject.tsx        # "Proceed anyway?" prompt when backend returns Type==='Prompt'
    deleteDialogs/
      DeleteComponentDialog.tsx  # Confirm delete component cost (shows cascade count)
      DeleteMajorItemDialog.tsx  # Confirm delete major item (shows work location count)
      DeleteWorkLocationDialog.tsx # Confirm delete work location
  rules/
    projectDetailsRules.ts       # Form validation rules for ProjectDetails
  utils/
    coordinates.ts               # defaultCoordinates bounding box (Philippine extent)
    unitTypes.ts                 # unitTypeMap: measure string -> 'LENGTH'|'AREA'|'VOLUME'|'COUNT'
    filteringFunctions.ts        # Utility: findProvinceByCode, findCity, findLD, findDEO
```

---

## Routes

Registered in the app router (not shown here); the module uses React Router v6:

| Path | Component | Purpose |
|---|---|---|
| `/projects` | `Project.tsx` | Paginated project list |
| `/projects/addproject` | `AddProject.tsx` | Add new project |
| `/projects/project-details/:project` | `EditProject.tsx` | Edit existing project. Param `:project` is `"ProjectId:StageName"` (colon-delimited) |

**Navigation from list to detail:**
```
navigate(`/projects/project-details/${projectId}:${stageName}`)
```

**Add project with pre-selected program:**
```
navigate(`/projects/addproject?programId=<id>&stageName=<stage>`)
```

---

## TypeScript Interfaces (`Model.d.ts`)

### Core Payload

```ts
interface ProjectFormPayload {
  IsModify?: boolean;
  IsActive: boolean;
  IsUnlock?: boolean;
  ProgramDetails: ProgramList;
  ProjectDetails: ProjectDetails;
  ComponentCosts: ComponentCost[];
  ComponentCostPerYear: ComponentCostPerYear[];
  MajorItemOfWorks: MajorItemOfWork[];
  MajorItemLocations: MajorItemLocations[];
  ProjectNotes: ProjectNote[];
  Docs: ProjectSupportingDocs[];
  FundingProfile: FundingProfile[];
  Dropdowns: Dropdowns;
  Activities: Activity[];
  TransactionLogs: TransactionLog[];
}
```

### ProjectDetails

```ts
interface ProjectDetails {
  Id?: number;
  ProgramId?: string;
  ProgramName?: string;
  ProjectId?: string;
  StageName?: string;
  AlternateId?: string;
  ExternalId?: string;
  MYId?: string;
  UACS?: string;
  MYCAApprovalDate?: string | null;
  IslandCode?: string;
  RevisionId?: number;
  Description?: string;
  Category?: number;
  Thrust?: number;
  Origin?: number;
  Province?: string;
  City?: string;
  LegislativeDistrict?: string;
  OperatingUnit?: string;
  ImplementingOffice?: string;
  DEO?: string | number;
  Region?: string;
  Agency?: number;
  ImplementationMode?: number;
  EmergencyMode?: number;
  Feasibility?: number;
  FeasibilityDate?: string | null;
  DetailedDesign?: number;
  DetailedDesignDate?: string | null;
  RowAvailable?: number;
  RegionWide?: number;
  Tier: number;                   // Required
  Rank?: number;
  IsAllowedToProceed?: boolean;
}
```

### ComponentCost

```ts
interface ComponentCost {
  Id: number;
  ProjectId: string;
  CostId: string;                 // Temporary key "temp_<timestamp>_<random>" for new items
  ComponentType: string;
  ComponentId: string;
  Description?: string;
  Total: number;
  StageName?: string;
  RevisedNumber?: number;
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy?: string;
  UpdatedDate?: string;
  IsDeleted: boolean;
  // + construction/packed status fields
}
```

### ComponentCostPerYear

```ts
interface ComponentCostPerYear {
  Id: number;
  ComponentCostId: string;        // Links to ComponentCost.CostId
  Amount?: number;
  Year?: number;
  StartDate?: string | null;
  EndDate?: string | null;
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy?: string;
  UpdatedDate?: string;
  IsDeleted: boolean;
}
```

### MajorItemOfWork / MajorItemOfWorksWithDropdown

```ts
interface MajorItemOfWork {
  Id: number;
  ProjectId: string;
  ReferenceId: string;            // Immutable link key (temp_<timestamp>_<random> for new items)
  StageName?: string;
  ComponentId: string;
  YearOfWork: number;
  WorkTypeId: number;
  InfraType: string;              // InfraCode from InfraTypeEnum
  TargetUnitId: number;
  TargetUnit: string;             // Measure string (e.g., "km")
  CreatedBy?: string;
  IsDeleted: boolean;
}

interface MajorItemOfWorksWithDropdown extends MajorItemOfWork {
  DropdownData: ScopeOfWorkEnum[];      // Filtered by InfraType (UI-only, not sent to backend)
  MajorItemLocations: MajorItemLocations[];  // Nested locations (flattened before API call)
}
```

### MajorItemLocations

```ts
interface MajorItemLocations {
  Id: number;
  ParentId: string;               // = MajorItemOfWork.ReferenceId
  StageName: string;
  InfraId: string;
  DetailedScope: string;
  TargetUnitId: number;
  TargetUnit: string;
  PhysicalTarget?: number;
  Length?: number | null;
  EndChainage: number;
  StartChainage: number;
  StartX: number;
  StartY: number;
  EndX?: number;
  EndY?: number;
  StartStationLimit: string;
  EndStationLimit: string;
  IsDeleted: boolean;
}
```

### FundingProfile

```ts
interface FundingProfile {
  Id: number;
  ProjectId: string;
  StageName?: string;
  Source: string;
  Agreement: string;
  Percentage: number;             // Auto-calculated from Amount / totalAmount * 100
  Amount: number;
  IsDeleted: boolean;
}
```

### Supporting Docs / Notes

```ts
interface ProjectNote {
  Id: number;
  ProjectId: string;
  FileName: string;
  FileExtension: string;
  FilePath: string;
  Description: string;
  CreatedBy: string;
  CreatedDate: string;
}

interface ProjectSupportingDocs {
  Id: number;
  DocumentType: string;
  ProjectId: string;
  FileName: string;
  FileExtension: string;
  FilePath: string;
  Description: string;
  IsDeleted?: boolean;
}

interface AddNotes {
  StageName: string;
  DocumentType: string;
  ProjectId: string;
  Description: string;
  File: FileEntity;               // { Name, Extension, ContentType, DataUrl (base64) }
}
```

### Dropdowns / Enums

```ts
interface Dropdowns {
  ComponentTypes: ComponentTypeEnum[];
  Agreements: AgreementEnum[];
  Sources: SourceEnum[];
  ScopeOfWorks: ScopeOfWorkEnum[];
  InfraTypes: InfraTypeEnum[];
  SupportingDocs: DropdownSupportingDocs[];
  Revisions: RevisionDropdown;
}

interface ScopeOfWorkEnum {
  Id: number;
  Enum: number;           // = WorkTypeId value
  InfraType: string[];    // Array of InfraCode strings this scope applies to
  WorkCategory: string;
  Description: string;
  Measure: string;        // Unit of measure (e.g., "km")
  MaxAmount?: number;
  MinAmount?: number;
}

interface InfraTypeEnum {
  Id: number;
  InfraId: string;
  InfraCode: string;      // e.g. 'R', 'B', 'LR', 'LB', 'FCS', 'WW'
  InfraName: string;
}

interface RevisionDropdown {
  Headers: OptionRevisionHeader[];      // Revision types (e.g., Major, Minor)
  Reasons: OptionRevisionReasons[];
  Categories: OptionRevisionCategory[];
}

interface ProjectEnums {
  Programs: ProgramList[];
  Categories: CategoryEnum[];
  Thrusts: ThrustEnum[];
  Origins: OriginEnum[];
  Cities: ProjectCityEnum[];
  Provinces: ProjectProvinceEnum[];
  LDs: ProjectLegislativeDistrictEnum[];
  OperatingUnits: ProjectOperatingUnitEnum[];
  IOs: ImplementingOfficeEnum[];
  DEOs: DEOEnum[];
  Agencies: AgencyEnum[];
  ImplementationModes: ImplementationModeEnum[];
  EmergencyModes: EmergencyModeEnum[];
  RowsAvailable: ROWEnum[];
  Feasibility: FeasibilityEnum[];
  DetailedDesign: DetailedDesignEnum[];
  RegionWide: RegionWideEnum[];
}
```

### List View

```ts
interface ProjectLists {
  Id: number;
  ProgramId: string;
  ProgramName: string;
  ProjectId: string;
  RevisionNumber: number;
  Description: string;
  Category?: string;
  Region?: string;
  StageName: string;
  IsPublished?: boolean;
  IsPublishable: boolean;
}
```

### Import Interfaces

```ts
interface ImportedProject { /* shape produced by parseImportFile + transformImportedProjects */ }
interface ImportParseResult {
  projects: ImportedProject[];
  errors: string[];
  totalRows: { details: number; components: number; funding: number; majorItems: number; };
}
interface ImportProjectDTO { /* final payload for /Importing/ImportProject/ */ }
```

---

## Service Functions (`Service.ts`)

All standard calls use `httpClient.post<T>(url, body, options)` from `../../services/httpClient`.
GIS calls use native `fetch()` against `VITE_API_GIS_URL`.

| Function | Endpoint | Body / Params | Return |
|---|---|---|---|
| `fetchProject(pagination)` | `POST /Project/showprojects` | `ProjectPagination` | `PaginationResponse<ProjectLists>` |
| `initProgramDetails(programId)` | `POST /Project/Details/${programId}` | — | `ProgramList` |
| `searchProgram(programName)` | `POST /Project/Search/${programName}` | — | `ProgramList` |
| `getProjectEnums()` | `POST /Project/InitAddProject` | — | `ProjectEnums` |
| `addProjectDetails(payload)` | `POST /Project/addproject/` | `ProjectDetails` | `{ ProjectId, StageName, Type, Title, Message }` |
| `getProjectDetails({ ProjectId, StageName })` | `POST /Project/ProjectDetails/` | `{ ProjectId, StageName }` | `ProjectFormPayload` |
| `updateProjectDetails(payload)` | `POST /Project/UpdateProjectDetails/` | `ProjectDetails` | `{ ProjectId, Title, Message }` |
| `updateEntireProject(payload)` | `POST /Project/UpdateProjectDetails/` | Full payload | `{ Type, Message, Title }` |
| `addNote(addNotes)` | `POST /Project/UploadNotes/` | `AddNotes` | uploaded note |
| `addDoc(addNotes)` | `POST /Project/UploadSupportingDocs/` | `AddNotes` | `ProjectSupportingDocs` |
| `deleteNote(notes[])` | `POST /Project/DeleteNote/` | `ProjectNote[]` | — |
| `deleteDoc(doc)` | `POST /Project/DeleteSupportingDocs/` | `ProjectSupportingDocs` | — |
| `getInfrastructureData()` | `POST /Project/InfrastructureData` | — | `InfraData` |
| `fetchProjectStagesByProjectId(projectId)` | `POST /Project/ShowProjectStages` | `{ ProjectId }` | `ProjectRevisionList` (graceful: empty on error) |
| `fetchProjectGeoJSON(projectId, programId, username, stageName)` | `GET ${VITE_API_GIS_URL}/api_v1.0/project/features_v4` | Query params | GeoJSON data |
| `chainageToLrpConverter(sectionId, chainage)` | `GET ${VITE_API_GIS_URL}/api_v1.0/infra/chainage_to_lrp` | Query params | LRP value |
| `lrpToChainageConverter(sectionId, lrp)` | `GET ${VITE_API_GIS_URL}/api_v1.0/infra/lrp_to_chainage` | Query params | Chainage value |
| `importProject(payload)` | `POST /Importing/ImportProject/` | `ImportProjectDTO` | response |
| `autoFillComponentDescription(userId, projectId, componentId, programId, stageName)` | AI/LLM endpoint | body | `{ component_description }` |

---

## Views

### `Project.tsx` — List View

- **Purpose:** Paginated project list with search by `ProjectId` and expandable stage-history rows.
- **Search:** `searchInput` state updated on keystroke; `fetchProject` only called on submit (Enter or search button) or clear. Clear button visible when input **or** applied filter is set.
- **Multi-row expand:** Any number of rows can be expanded simultaneously (keyed by `projectId`). Stage data cached in `revisionLists: Record<string, ProjectRevisionList>`.
- **Pagination:** `Paginate(page)` re-calls `fetchProject`.
- **Columns:** Project ID (expandable) | Description | Category | Region | Actions (View)
- **Add:** Navigates to `/projects/addproject`.

### `AddProject.tsx`

Reads `programId` and `stageName` from URL query params (`useSearchParams`), then renders `<ProjectForm mode="add" initialProgramId={...} initialStageName={...} />`.

### `EditProject.tsx`

- Uses `useParams()` to get `:project`, splits on `:` → `[ProjectId, StageName]`.
- Calls `getProjectDetails({ ProjectId, StageName })` → `setInitialData(response.Data)`.
- `refreshKey` state forces full remount when `onRefresh` is called.
- Returns `null` while loading (no skeleton).
- Renders `<ProjectForm mode="edit" initialData={...} onRefresh={...} />`.

---

## ProjectForm — Central Orchestrator (`components/ProjectForm.tsx`)

### Props

```ts
interface ProjectFormProps {
  initialData?: ProjectFormPayload;
  mode?: 'add' | 'edit';         // default: 'add'
  initialProgramId?: string;
  initialStageName?: string;
  onRefresh?: () => void;
}
```

### Key State

| State | Type | Purpose |
|---|---|---|
| `programDetails` | `ProgramList` | Selected program header |
| `projectDetails` | `ProjectDetails` | All project fields |
| `componentCosts` | `ComponentCost[]` | Component cost rows |
| `componentCostPerYear` | `ComponentCostPerYear[]` | Per-year breakdown rows |
| `majorItems` | `MajorItemOfWorksWithDropdown[]` | Major items with nested locations |
| `fundingProfiles` | `FundingProfile[]` | Funding source rows |
| `docs` | `ProjectSupportingDocs[]` | Uploaded supporting documents |
| `maxAmountCost` | `number` | Passed from ComponentCostForm; used for budget validation |
| `isDisabled` | `boolean` | `IsActive === false` OR `StageId === 10 && Status === 1` |

### Section Collapse States

`isProgramOpen`, `isProjectOpen`, `isMapOpen` — toggle collapsible panels.

### Dialog States

| State | Dialog |
|---|---|
| `isRevisionOpen` | `RevisionDialog` |
| `isConfirmDialogOpen` | `SaveProjectConfirmDialog` |
| `isProceedDialogOpen` | `ProceedAddProject` |
| `isImportLumpsumOpen` | `ImportLumpsumDialog` |

### Add-Mode Save Flow

```
handleSaveProjectDetails()
  → form validation (projectDetailsRules)
  → setIsConfirmDialogOpen(true)
  → [user confirms]
  → confirmSaveProject()
      → addProjectDetails(payload)
      → if Type === 'Prompt': setProceedMessage(), setIsProceedDialogOpen(true)
      → if success: navigate to /projects/project-details/${ProjectId}:${StageName}
```

### Edit-Mode Update Flow

```
handleUpdateProject()
  → form validation (projectDetailsRules)
  → business validations (funding %, component cost total, duplicate scope, coordinates)
  → setIsConfirmDialogOpen(true)
  → [user confirms]
  → confirmUpdateProject()
      → transform majorItems → { MajorItemOfWorks[], MajorItemLocations[] }
      → updateEntireProject(payload)
      → if Type === 'Prompt' && !allowProceed: show ProceedDialog
      → if success: navigate back to edit route (or call onRefresh)
```

### Toolbar Button Visibility Rules

| Button | Condition |
|---|---|
| **Unlock Project** | mode=edit, IsActive=true, IsUnlock=true, StageId ≠ 10 |
| **Itemized Lump Sum** | mode=edit, StageId ≠ 10, ProjectId ends with "LS" |
| **Update Project** | mode=edit, IsActive=true, ProgramDetails.Status ≠ 1 |
| **Revise Project** (dropdown) | mode=edit, StageId=10, Status=1 |
| **Save Project** (add mode) | always shown in add mode |

### Cascade Delete — ComponentCost

`handleDeleteComponentCost(index)`:
1. Finds affected major items (`ComponentId` matches).
2. Shows `window.confirm` warning if related major items exist.
3. **Hard deletes** component cost if `Id === 0`; **soft deletes** if `Id > 0` (`IsDeleted: true`).
4. Cascades to `componentCostPerYear`: hard delete if `ComponentCostId === cost.CostId && Id === 0`; soft delete if `Id > 0`.
5. Cascades to `majorItems` → each item's `MajorItemLocations` → hard/soft delete per Id.

---

## Section Components

### `ProgramDetailsForm`

- **Add mode:** `<select>` of all programs from `projectEnums.Programs` (excludes GAA-R; filters by `initialStageName` if provided).
- **Edit mode:** Read-only display of program Name, Type, Start Year, Stage.
- Selecting a program calls `onChange(selectedProgram)` + `setProgramDetails()`.

### `ProjectDetailsForm`

Manages cascading geographic hierarchy dropdowns:

```
Province
  └─ City      (filtered by ProvinceGdbId)
  └─ LD        (filtered by ProvinceGdbId)
  └─ DEO       (filtered by ProvinceGdbId)
       └─ IO   (RegionParticipantId === DEO.RegionParticipantId && OrgType==='R') || OrgType==='UPMO' || ParticipantId === DEO.ParticipantId
            └─ OU  OrgType==='CO' || DEO.RegionParticipantId===OU.ParticipantId || IO.ParticipantId===OU.ParticipantId || (IO.OrgType==='UPMO' && DEO.ParticipantId===OU.ParticipantId)
```

**Auto-sync on change:**
- Selecting **Province** → clears City, LD, DEO if they no longer belong to new province.
- Selecting **City** → auto-sets Province if different; clears LD if province mismatch.
- Selecting **DEO** → filters IO list.
- Selecting **IO** → filters OU list.

All dropdowns use `SearchableDropdown` component.

### `ComponentCostForm`

- Table of `ComponentCost[]` (filtered: `!IsDeleted`).
- Budget status bar (Total Cost vs `maxAmountCost`):
  - `normal` (< 75%) → blue
  - `caution` (75–89%) → yellow
  - `warning` (90–99%) → orange
  - `reach` (= 100%) → green
  - `exceeded` (> 100%) → red
- Add/edit opens `ComponentCostDialog`. Budget exceeded warns via `window.confirm` (still allows override).
- Delete opens `DeleteComponentDialog` (shows count of related major items to be cascade-deleted).

### `FundingProfileForm`

- Table of `FundingProfile[]`. Rows have Source (dropdown), Agreement (dropdown), Amount (currency input), Percentage (read-only / auto-calculated).
- **Auto-percentage calculation:** `useEffect` on `fundingProfiles` recalculates `Percentage = Amount / totalAmount * 100` (rounded to 2 decimals). A **balancer** value compensates for floating-point rounding errors across rows.
- Total percentage indicator: green (≈100%), yellow (< 100%), red (> 100%).
- Triggers `onTotalAmountChange` callback up to `ProjectForm`.

### `MajorItemOfWorksForm`

- Expandable rows — click row to show nested `WorkLocationTable`.
- Add opens `AddMajorItemDialog`. On submit, generates temp `ReferenceId = "temp_<timestamp>_<random>"`.
- `dropDownData` filtered: `ScopeOfWorks.filter(x => x.InfraType.includes(item.InfraType))`.
- On `dropDowns` change, auto-updates `DropdownData` for items that have `InfraType` but empty `DropdownData` (handles backend-loaded data).

### `WorkLocationTable`

- Nested inside each major item row.
- Infra type guards (via `infraIdGenerator` utils):
  - `isRoadInfraType(infraType)` → InfraCode = 'R'
  - `isBridgeInfraType(infraType)` → InfraCode = 'B'
  - `isLocalInfraType(infraType)` → L-prefix ≥ 2 chars (LR, LB, LFCS, etc.)
- **Length validation:**
  - Road type → requires StartChainage and EndChainage (End > Start).
  - Length-based measure (per `unitTypeMap`) → validates if entered (optional); checks min/max.
  - Other types → length optional.
- **Duplicate scope guard:** Composite key = `DetailedScope | StartChainage | EndChainage | StartStationLimit | EndStationLimit` (case-insensitive). Validated inline and again in `ProjectForm.handleUpdateProject()`.
- Uses `AddInfraDialog` to pick road/bridge infrastructure.
- Uses `chainageToLrpConverter` / `lrpToChainageConverter` (GIS API).

### `NotesForm`

- Displays uploaded supporting documents (`ProjectSupportingDocs[]`).
- File link: `new URL(filePath, VITE_API_BASE_URL)` → opens in new tab.
- Delete calls `deleteDoc(doc)` directly from service (immediate server delete + local array removal).
- Upload via `AddNoteDialog` → PDF-only constraint enforced client-side.

### `ActivitySection`

- Timeline view of `Activity[]` and `TransactionLog[]`.
- Filter bar: all / create / update / delete.
- Each entry shows: type badge (colour-coded), relative time (e.g. "2h ago"), full datetime tooltip, actor, changed fields (JSON diff if parseable).
- Type normalisation: `create|insert` → create, `update|modify` → update, `delete` → delete.

---

## Dialogs

### `ComponentCostDialog`

- **Fields:** ComponentType (cascading → ComponentId), Description (free text + AI auto-fill button), Total (currency), Per-Year costs table.
- **AI auto-fill:** `autoFillComponentDescription(userId, projectId, componentId, programId, stageName)` → populates Description.
- **Per-year costs:** add (starts at `YearStart`), edit (field-level), delete (hard/soft per `Id`).
- **Budget guard:** warns if new total would exceed `maxAmountCost` (via `window.confirm`; override allowed).
- Initialised via `isInitializedRef` to prevent double-init on re-render.

### `AddMajorItemDialog`

- **Fields:** Component (filtered from `ComponentCost[]` in parent), Year of Work, InfraType (from `InfraTypeEnum`), Type of Work (`ScopeOfWorkEnum` filtered by InfraType).
- ROW special case: if `ComponentId === "ROW"`, InfraType list is filtered to only those with "ROW Acquisition" scope; WorkType limited to "ROW Acquisition".
- Changing InfraType resets WorkTypeId to 0.
- Add mode disallows selection if no available components exist.

### `AddInfraDialog`

- Tabs: Road | Bridge (tab pre-selected based on `infraType` prop).
- **Road tab:** Searches `fetchRoadSectionData` (paginated, filter by RoadSectionId/search term).
- **Bridge tab:** Fetches DEO's road sections first (`fetchRoadSectionData` with `DEO` filter), then filters bridges by selected road section. Pagination supported.
- Page sizes: 10 / 25 / 50.
- Select row → confirm → calls `onAdd(infraId, infraName, infraType)`.

### `AddNoteDialog`

- **Fields:** DocumentType (dropdown from `DropdownSupportingDocs`), Description (text), File (PDF only, validated by `file.type !== 'application/pdf'`).
- File read as base64 DataUrl (`FileReader.readAsDataURL`).
- On submit: calls `addDoc(formData)` service, returns new `ProjectSupportingDocs`.

### `ImportLumpsumDialog`

- Accepts `.xlsx` file via drag-and-drop or file picker.
- Parses via `parseImportFile(file)` (xlsx library, shared with Program module).
- Transforms via `transformImportedProjects(parsed.projects, programId, stageName)`.
- Multi-tab preview: Summary | Projects | Funding | Components | Cost Per Year | Major Items | Major Locations | Errors.
- Switches to Errors tab automatically if parse errors exist.
- Submit calls `onSubmit(projects)` → in `ProjectForm.handleImportLumpsumSubmit()` → calls `importProject(transformed)`.

### `RevisionDialog`

- Shows RevisionType headers (from `Dropdowns.Revisions.Headers`).
- Filters categories by `RevisionGroupId`.
- Filters reasons by `RevisionGroupId` and optionally by selected `CategoryId`.
- On submit, navigates via `getRevisionNavigationPath()` (shared utility in Modification module).

### `SaveProjectConfirmDialog`

Simple confirmation dialog. `onConfirm` is async; shows spinner while submitting. Prevents close while submitting.

### `ProceedAddProject`

Shows when backend returns `Type === 'Prompt'`. Displays the server `message`. Two buttons: Cancel / "Yes, Proceed Anyway" → re-submits with `IsAllowedToProceed: true`.

### Delete Dialogs

All three follow the same pattern: disabled during async operation, shows toast on success/failure, calls parent callback on confirm.

- `DeleteComponentDialog`: shows `relatedMajorItemsCount` warning.
- `DeleteMajorItemDialog`: shows work location count warning.
- `DeleteWorkLocationDialog`: shows infra type context.

---

## Hard / Soft Delete Pattern

```
Item.Id === 0 (unsaved)  → hard delete: remove from array
Item.Id > 0  (in DB)     → soft delete: set IsDeleted = true, keep in array
```

Applied at every level: ComponentCost, ComponentCostPerYear, MajorItemOfWork, MajorItemLocations, FundingProfile.

---

## Validation

### Form Validation (projectDetailsRules.ts)

Triggered via `validateForm(projectDetails, projectDetailsRules)` before save. Required fields:

| Field | Rule |
|---|---|
| ProgramId | truthy |
| Description | truthy |
| Category | number > 0 |
| Thrust | number > 0 |
| Origin | number > 0 |
| Province | truthy |
| City | truthy |
| LegislativeDistrict | truthy |
| OperatingUnit | truthy |
| ImplementingOffice | truthy |
| DEO | truthy |
| Region | truthy |
| Agency | number > 0 |
| ImplementationMode | number > 0 |
| Tier | required (always present) |

### Business Validation (ProjectForm.handleUpdateProject)

Checked only in edit mode before showing confirm dialog. Each error shown as a separate toast:

1. **Funding total:** `sum of active FundingProfile.Percentage` must be within ±0.03 of 100. (Balancer tolerance applied.)
2. **Component cost total:** `sum of active ComponentCost.Total` must equal `maxAmountCost` (from program's `Cost`). Tolerance: within ±1 PHP.
3. **Duplicate DetailedScope:** Composite key = `scope|startChainage|endChainage|startStationLimit|endStationLimit` — must be unique within each major item's active locations.
4. **Length > 0:** For active locations where Length is non-null/non-zero, must be > 0.
5. **Coordinate range:** StartX, StartY, EndX, EndY must be within `defaultCoordinates` (Philippine bounding box: X: 116.67–126.60, Y: 4.67–21.17) if non-zero.

---

## Coordinate Bounds (`utils/coordinates.ts`)

```ts
export const defaultCoordinates = {
  maxX: 126.59666666666665,
  minX: 116.66666666666666,
  maxY: 21.1666666666666670,
  minY: 4.666666666666666,
};
```

---

## Unit Type Map (`utils/unitTypes.ts`)

Maps lowercase measure strings to `'LENGTH' | 'AREA' | 'VOLUME' | 'COUNT'`.
Used in `WorkLocationTable` to determine if a measure is length-based (triggers chainage/length UI).

Key entries:
- `'km'`, `'lane km'`, `'lineal meters'`, `'meters'` → `LENGTH`
- `'square meters'` → `AREA`
- `'cubic meters'` → `VOLUME`
- All "number of ..." variants → `COUNT`

---

## GeoJSON / Map

- `fetchProjectGeoJSON(projectId, programId, username, stageName)` hits `VITE_API_GIS_URL` (GIS microservice).
- Response rendered by `<MapRenderer geoJsonData={...} />` (shared component).
- Map section is collapsible (`isMapOpen` state).
- Only shown in edit mode (data only available after project is saved).

---

## Lump Sum Import Workflow

1. User clicks **Itemized Lump Sum** button (visible when `ProjectId` ends with "LS" and StageId ≠ 10).
2. `ImportLumpsumDialog` opens.
3. User drops/selects `.xlsx` file.
4. `parseImportFile(file)` (Program/utils) reads all worksheets via `xlsx`.
5. `transformImportedProjects(parsed, programId, stageName)` builds `ImportProjectDTO` shape.
6. Preview tabs shown (Summary, Projects, Funding, Components, etc.).
7. User clicks Submit → `importProject(payload)` → `POST /Importing/ImportProject/`.
8. On success, navigates back to edit route.

---

## Key Utility References

| Utility | Location | Purpose |
|---|---|---|
| `generateInfraId` | `utils/infraIdGenerator.ts` | Generate InfraId for new work locations |
| `shouldAutoGenerateInfraId` | same | Decides if auto-generate applies |
| `getInfraTypePrefix` | same | InfraCode → prefix char |
| `isLocalInfraType` | same | L-prefix guard |
| `isRoadInfraType` | same | 'R' guard |
| `isBridgeInfraType` | same | 'B' guard |
| `parseImportFile` | `Program/utils/parseImportFile.ts` | xlsx parsing (shared) |
| `transformImportedProjects` | `Program/utils/transformImportedProjects.ts` | Build import payload (shared) |
| `getRevisionNavigationPath` | `Modification/utils/revisionNavigation.ts` | Navigate after revision |
| `SearchableDropdown` | `components/ui/SearchableDropdown` | Searchable select (shared UI) |
| `MapRenderer` | shared component | Renders GeoJSON on map |
