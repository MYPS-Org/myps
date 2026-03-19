# CodeTables Module

System reference data management with two-tier pill-tab navigation. All tables are organized into domain-specific subfolders under `tables/` and imported into the single parent view `CodeTables.tsx`.

---

## Folder Structure

```
pages/CodeTables/
├── Views/
│   └── CodeTables.tsx               ← Only entry point (pill group tabs + CodeTableProvider wrapper)
├── CodeTableContext.tsx             ← React context: fetches GET CodeTable/GetAllCodeTables once; provides data/loading/error/refetch to all tables
├── dialogs/
│   ├── ConfirmDialog.tsx            ← Dynamic confirmation dialog (add / edit modes)
│   └── useConfirmDialog.ts          ← Hook to manage dialog state from any table
├── tables/
│   ├── projectDetails/
│   │   ├── ProjectDetailsDropdowns.tsx ← Parent router for all 10 dropdown tables (API: getProjectEnums)
│   │   ├── CategoryTable.tsx           ← CategoryEnum CRUD (cost thresholds + validity) ✓ dialog
│   │   ├── ThrustTable.tsx             ← ThrustEnum CRUD (PAP programs) ✓ dialog
│   │   ├── OriginTable.tsx             ← TableEnum CRUD (project funding origin) ✓ dialog
│   │   ├── AgencyTable.tsx             ← AgencyEnum CRUD (NameId · Name · Description) ✓ dialog
│   │   ├── ImplementationModeTable.tsx ← TableEnum CRUD (by contract / admin / JV) ✓ dialog
│   │   ├── EmergencyModeTable.tsx      ← TableEnum CRUD (normal / emergency / calamity) ✓ dialog
│   │   ├── RowAvailableTable.tsx       ← TableEnum CRUD (ROW availability) ✓ dialog
│   │   ├── FeasibilityTable.tsx        ← TableEnum CRUD (feasibility study status) ✓ dialog
│   │   ├── DetailedDesignTable.tsx     ← TableEnum CRUD (detailed design status) ✓ dialog
│   │   ├── RegionWideTable.tsx         ← TableEnum CRUD (yes / no region scope) ✓ dialog
│   │   ├── MultiCriteriaAnalysisTable.tsx ← MCA scoring criteria (read-only, no CRUD)
│   │   ├── CategoryDropdown.tsx        ← Reusable <select> for ProjectDetails.Category
│   │   └── ThrustDropdown.tsx          ← Reusable <select> for ProjectDetails.Thrust
│   ├── componentCost/
│   │   └── CostTypeTable.tsx           ← ComponentTypeEnum (cost component types)
│   ├── majorItemOfWorks/
│   │   ├── WorkCategoryTable.tsx       ← Major work categories per infra type
│   │   └── TypeOfWorkTable.tsx         ← Specific work types with UoM and quantity limits
│   ├── majorItemLocation/
│   │   └── InfraTypeTable.tsx          ← InfraTypeEnum (infrastructure type codes)
│   ├── fundingProfile/
│   │   └── FundingSourceTable.tsx      ← Funding organizations (Local / Foreign)
│   ├── revisions/
│   │   ├── ModificationCategoryTable.tsx   ← Revision code groups
│   │   ├── ModificationReasonTable.tsx     ← Revision reasons [API-connected]
│   │   ├── ValidationDatesTable.tsx        ← Revision window dates per funding year
│   │   └── RevisionFieldPermissionTable.tsx ← Field-level edit rules [API-connected]
│   └── addDocument/                    ← (reserved)
├── Model.d.ts                  ← TypeScript interfaces for revision tables + extended CodeTableData (includes ProjectCategories, ProjectThrusts, ProjectAgencies, ProjectOrigins, FundingSources, InfraTypes, ProjectComponents, ScopeOfWorks)
├── Service.ts                  ← API: fetchRevisionReasons, fetchRevisionRules, fetchCodeTableData<CodeTableData>
└── Codetables.md               ← This file
```

---

## Confirmation Dialogs

All 10 CRUD tables in `projectDetails/` use a shared two-file pattern for add/edit confirmation.

### `dialogs/ConfirmDialog.tsx`

A single dynamic modal that handles **both Add and Edit** scenarios. Follows the same structural pattern as other dialogs in the app (`AddGroupDialog`, etc.): raw `@headlessui/react` `Dialog/DialogPanel`, white header with icon + title + X close button, bordered body, and a standard footer.

| Mode | Icon accent | Badge accent | Confirm button | Warning note |
|------|-------------|--------------|----------------|--------------|
| `'add'` | Emerald | Emerald | "Confirm Add" | — |
| `'edit'` | Amber | Amber | "Save Changes" | "This will overwrite…" |

**Structure:**
```
┌─────────────────────────────────────────────┐
│ [Icon] Title                          [✕]   │  ← px-6 py-4 border-b
├─────────────────────────────────────────────┤
│ Subtitle text                               │  ← p-6
│ ┌────────────────────────────────────────┐  │
│ │ Label     Value                        │  │  ← divide-y border
│ │ Label     <badge> code </badge>       │  │
│ └────────────────────────────────────────┘  │
│ [⚠ warning note — edit mode only]           │
├─────────────────────────────────────────────┤
│                     [Cancel] [Confirm/Save] │  ← px-6 py-4 border-t
└─────────────────────────────────────────────┘
```

**Props:**
```ts
interface ConfirmField {
  label: string;
  value: string | number | boolean | null | undefined;
  mono?: boolean;     // render as code badge (IDs, keys)
  optional?: boolean; // show "empty (optional)" when blank
  hidden?: boolean;   // skip entirely
}

interface ConfirmDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  tableName: string;       // e.g. "Agency", "Project Category"
  fields: ConfirmField[];  // any set of key-value pairs to preview
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;       // shows spinner, disables button
}
```

### `dialogs/useConfirmDialog.ts`

Hook that manages all dialog state. Returns `{ request, close, setLoading, dialogProps }`.

```tsx
const confirm = useConfirmDialog();

// On ✓ click in Add row:
const requestAdd = () => {
  if (!addForm) return;
  confirm.request({
    mode: 'add',
    tableName: 'Agency',
    fields: [
      { label: 'NameId',      value: addForm.NameId,      mono: true },
      { label: 'Agency Name', value: addForm.Name },
      { label: 'Description', value: addForm.Description, optional: true },
    ],
    onConfirm: () => { saveAdd(); confirm.close(); },
  });
};

// On ✓ click in Edit row:
const requestEdit = () => {
  confirm.request({
    mode: 'edit',
    tableName: 'Agency',
    fields: [/* ... editForm fields ... */],
    onConfirm: () => { saveEdit(); confirm.close(); },
  });
};

// In JSX (one line, at bottom of return):
<ConfirmDialog {...confirm.dialogProps} />
```

**Import path** from any `tables/<domain>/` component:
```tsx
import ConfirmDialog    from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
```

---

## Navigation

`CodeTables.tsx` renders a **two-tier pill-tab layout**:

| Tier | Style | Purpose |
|------|-------|---------|
| Primary tabs (top) | Filled pill, icon + label | One per group (6 groups) |
| Secondary tabs | Filled pill | One per table within the active group (hidden when only one table) |

**Groups and their tabs:**

| Group (Primary Tab) | Tables (Secondary Tabs) |
|---------------------|------------------------|
| Project Details | Form Dropdowns |
| Component Cost | Cost Type |
| Major Item of Works | Work Category · Type of Work |
| Major Item Locations | Infrastructure Types |
| Funding Profile | Funding Source |
| Revisions | Modification Category · Modification Reason · Validation Dates · Field Permission |

> Switching a primary tab auto-selects the first secondary tab in that group.

### Project Details — `ProjectDetailsDropdowns.tsx`

The **Form Dropdowns** entry renders `ProjectDetailsDropdowns`, a dedicated parent component that:
- Fetches `getProjectEnums()` once on mount
- Shows its own pill-tab row with 10 child dropdown tables
- Passes `data` and `loading` props to each child

| Pill Tab | Child Component | Enum Field | Confirm Dialog |
|----------|----------------|------------|----------------|
| Category | `CategoryTable` | `Categories` | ✓ |
| Thrust | `ThrustTable` | `Thrusts` | ✓ |
| Origin | `OriginTable` | `Origins` | ✓ |
| Agency | `AgencyTable` | `Agencies` | ✓ |
| Implementation Mode | `ImplementationModeTable` | `ImplementationModes` | ✓ |
| Emergency Mode | `EmergencyModeTable` | `EmergencyModes` | ✓ |
| ROW Available | `RowAvailableTable` | `RowsAvailable` | ✓ |
| Feasibility Study | `FeasibilityTable` | `Feasibility` | ✓ |
| Detailed Design | `DetailedDesignTable` | `DetailedDesign` | ✓ |
| Region Wide | `RegionWideTable` | `RegionWide` | ✓ |

---

## Data Sources

| Table | Data Source | Interface |
|-------|-------------|-----------|
| **ProjectDetailsDropdowns** | **`POST /Project/InitAddProject`** (`getProjectEnums`) + **CodeTableContext** override for 4 keys | `ProjectEnums` from `Project/Model.d` |
| CategoryTable | **`POST CodeTable/GetAllCodeTables`** → `ProjectCategories` (CodeTableContext) | `CategoryEnum` from `Project/Model.d` |
| ThrustTable | **`POST CodeTable/GetAllCodeTables`** → `ProjectThrusts` (CodeTableContext) | `ThrustEnum` from `Project/Model.d` |
| AgencyTable | **`POST CodeTable/GetAllCodeTables`** → `ProjectAgencies` (CodeTableContext) | `AgencyEnum` from `Project/Model.d` |
| OriginTable | **`POST CodeTable/GetAllCodeTables`** → `ProjectOrigins` (CodeTableContext) | `TableEnum` from `Project/Model.d` |
| ImplementationModeTable | `getProjectEnums` → `ImplementationModes` | `TableEnum` from `Project/Model.d` |
| EmergencyModeTable | `getProjectEnums` → `EmergencyModes` | `TableEnum` from `Project/Model.d` |
| RowAvailableTable | `getProjectEnums` → `RowsAvailable` | `TableEnum` from `Project/Model.d` |
| FeasibilityTable | `getProjectEnums` → `Feasibility` | `TableEnum` from `Project/Model.d` |
| DetailedDesignTable | `getProjectEnums` → `DetailedDesign` | `TableEnum` from `Project/Model.d` |
| RegionWideTable | `getProjectEnums` → `RegionWide` | `TableEnum` from `Project/Model.d` |
| MultiCriteriaAnalysisTable | Sample data (read-only) | `MCAData` (local) |
| **CostTypeTable** | **CodeTableContext** → `ProjectComponents` | `ComponentTypeEnum` from `Project/Model.d` |
| **WorkCategoryTable** | **CodeTableContext** → `ScopeOfWorks` (derived: unique infra+category pairs) | `ScopeOfWorkEnum` from `Project/Model.d` |
| **TypeOfWorkTable** | **CodeTableContext** → `ScopeOfWorks` (flattened per InfraType entry) | `ScopeOfWorkEnum` from `Project/Model.d` |
| **InfraTypeTable** | **CodeTableContext** → `InfraTypes` | `InfraTypeEnum` from `Project/Model.d` |
| **FundingSourceTable** | **CodeTableContext** → `FundingSources` | `SourceEnum` from `Project/Model.d` |
| ModificationCategoryTable | Sample data → API | `ModCategoryData` (local) |
| **ModificationReasonTable** | **`POST /codetable/revisionreasons`** | `ModificationCategoryReason` from `Model.d` |
| ValidationDatesTable | Sample data → API | `ValidationDateData` (local) |
| **RevisionFieldPermissionTable** | **`POST /codetable/revisionrules`** | `RevisionRules` from `Model.d` |

---

## Reusable Dropdown Components

These components live in `tables/projectDetails/` and are intended for use in project forms (e.g., the Add/Edit Project form).

### `CategoryDropdown`

```tsx
import CategoryDropdown from 'pages/CodeTables/tables/projectDetails/CategoryDropdown';

<CategoryDropdown
  value={form.Category}
  onChange={v => setForm(f => ({ ...f, Category: v }))}
  categories={projectEnums.Categories}   // CategoryEnum[] from getProjectEnums()
  placeholder="— Select Category —"
  disabled={false}
/>
```

Props: `value`, `onChange(n: number)`, `categories: CategoryEnum[]`, `placeholder`, `disabled`, `className`, `id`, `name`

### `ThrustDropdown`

```tsx
import ThrustDropdown from 'pages/CodeTables/tables/projectDetails/ThrustDropdown';

<ThrustDropdown
  value={form.Thrust}
  onChange={v => setForm(f => ({ ...f, Thrust: v }))}
  thrusts={projectEnums.Thrusts}         // ThrustEnum[] from getProjectEnums()
  infraTypeFilter={selectedInfraType}    // optional: narrows options by infra type
/>
```

Props: `value`, `onChange(n: number)`, `thrusts: ThrustEnum[]`, `infraTypeFilter?`, `placeholder`, `disabled`, `className`, `id`, `name`

> Options are grouped by `ProgramName` using `<optgroup>` elements.

---

## Adding a New Table

1. **Create the component** in the appropriate `tables/<domain>/` subfolder:
   ```tsx
   // tables/myDomain/MyNewTable.tsx
   import { Table, TableHead, ... } from '../../../../components/tailwindui/table';
   import { Button } from '../../../../components/tailwindui/button';
   import ConfirmDialog from '../../dialogs/ConfirmDialog';
   import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

   const MyNewTable: React.FC = () => {
     const confirm = useConfirmDialog();
     // ...
     return (
       <div className="space-y-4">
         {/* table JSX */}
         <ConfirmDialog {...confirm.dialogProps} />
       </div>
     );
   };
   export default MyNewTable;
   ```

2. **Import and register** in `Views/CodeTables.tsx` under the correct group in `GROUPS`:
   ```tsx
   import MyNewTable from '../tables/myDomain/MyNewTable';
   { id: 'my-new-table', label: 'My New Table', component: MyNewTable }
   ```

3. If a new domain is needed, add a new entry to `GROUPS` with its own icon and `tables` array.

---

## Import Path Reference

| From | To tailwindui components | To Project Service | To CodeTable Service | To Project/Model.d | To dialogs/ | To Context |
|------|--------------------------|-------------------|----------------------|--------------------|-------------|------------|
| `tables/*/` | `../../../../components/tailwindui/...` | `../../../Project/Service` | `../../Service` | `../../../Project/Model.d` | `../../dialogs/...` | `../../CodeTableContext` |
| `Views/CodeTables.tsx` | `../../../components/tailwindui/...` | `../../Project/Service` | `../Service` | `../../Project/Model.d` | `../dialogs/...` | `../CodeTableContext` |
| `dialogs/` | `../../../components/tailwindui/...` | — | — | — | `./...` | — |

---

## UI Conventions

- **Status badges:** `bg-green-50 text-green-700` (active), `bg-red-50 text-red-600` (obsolete/inactive), `bg-gray-100 text-gray-500` (closed)
- **Code/ID badges:** `font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded`
- **Table wrapper:** `overflow-x-auto rounded-lg border border-gray-200`
- **Pagination:** 15 rows per page (default for large tables)
- **Search:** Case-insensitive text filter on key columns
- **Add button:** `<Button color="indigo">` at top-right of table header
- **Add row inline:** indigo left-border highlight (`border-l-4 border-indigo-400 bg-indigo-50`), ✓ button opens `ConfirmDialog` in `'add'` mode
- **Edit row inline:** amber left-border highlight (`border-l-4 border-amber-400 bg-amber-50`), ✓ button (amber) opens `ConfirmDialog` in `'edit'` mode
- **Actions:** Edit (`color="zinc"`) and Delete (`color="red"`) per row


---

## Navigation

`CodeTables.tsx` renders a **two-tier pill-tab layout**:

| Tier | Style | Purpose |
|------|-------|---------|
| Primary tabs (top) | Filled pill, icon + label | One per group (6 groups) |
| Secondary tabs | Filled pill | One per table within the active group (hidden when only one table) |

**Groups and their tabs:**

| Group (Primary Tab) | Tables (Secondary Tabs) |
|---------------------|------------------------|
| Project Details | Form Dropdowns |
| Component Cost | Cost Type |
| Major Item of Works | Work Category · Type of Work |
| Major Item Locations | Infrastructure Types |
| Funding Profile | Funding Source |
| Revisions | Modification Category · Modification Reason · Validation Dates · Field Permission |

> Switching a primary tab auto-selects the first secondary tab in that group.

### Project Details — `ProjectDetailsDropdowns.tsx`

The **Form Dropdowns** entry renders `ProjectDetailsDropdowns`, a dedicated parent component that:
- Fetches `getProjectEnums()` once on mount
- Shows its own pill-tab row with 10 child dropdown tables
- Passes `data` and `loading` props to each child

| Pill Tab | Child Component | Enum Field |
|----------|----------------|------------|
| Category | `CategoryTable` | `Categories` |
| Thrust | `ThrustTable` | `Thrusts` |
| Origin | `OriginTable` | `Origins` |
| Agency | `AgencyTable` | `Agencies` |
| Implementation Mode | `ImplementationModeTable` | `ImplementationModes` |
| Emergency Mode | `EmergencyModeTable` | `EmergencyModes` |
| ROW Available | `RowAvailableTable` | `RowsAvailable` |
| Feasibility Study | `FeasibilityTable` | `Feasibility` |
| Detailed Design | `DetailedDesignTable` | `DetailedDesign` |
| Region Wide | `RegionWideTable` | `RegionWide` |

---

## Data Sources

| Table | Data Source | Interface |
|-------|-------------|-----------|
| **ProjectDetailsDropdowns** | **`POST /Project/InitAddProject`** (`getProjectEnums`) | `ProjectEnums` from `Project/Model.d` |
| CategoryTable | `getProjectEnums` → `Categories` | `CategoryEnum` from `Project/Model.d` |
| ThrustTable | `getProjectEnums` → `Thrusts` | `ThrustEnum` from `Project/Model.d` |
| OriginTable | `getProjectEnums` → `Origins` | `TableEnum` from `Project/Model.d` |
| AgencyTable | `getProjectEnums` → `Agencies` | `AgencyEnum` from `Project/Model.d` |
| ImplementationModeTable | `getProjectEnums` → `ImplementationModes` | `TableEnum` from `Project/Model.d` |
| EmergencyModeTable | `getProjectEnums` → `EmergencyModes` | `TableEnum` from `Project/Model.d` |
| RowAvailableTable | `getProjectEnums` → `RowsAvailable` | `TableEnum` from `Project/Model.d` |
| FeasibilityTable | `getProjectEnums` → `Feasibility` | `TableEnum` from `Project/Model.d` |
| DetailedDesignTable | `getProjectEnums` → `DetailedDesign` | `TableEnum` from `Project/Model.d` |
| RegionWideTable | `getProjectEnums` → `RegionWide` | `TableEnum` from `Project/Model.d` |
| MultiCriteriaAnalysisTable | Sample data (read-only) | `MCAData` (local) |
| **CostTypeTable** | **CodeTableContext** → `ProjectComponents` | `ComponentTypeEnum` from `Project/Model.d` |
| **WorkCategoryTable** | **CodeTableContext** → `ScopeOfWorks` (unique infra+category pairs) | `ScopeOfWorkEnum` from `Project/Model.d` |
| **TypeOfWorkTable** | **CodeTableContext** → `ScopeOfWorks` (flattened per `InfraType[]` entry) | `ScopeOfWorkEnum` from `Project/Model.d` |
| **InfraTypeTable** | **CodeTableContext** → `InfraTypes` | `InfraTypeEnum` from `Project/Model.d` |
| **FundingSourceTable** | **CodeTableContext** → `FundingSources` | `SourceEnum` from `Project/Model.d` |
| ModificationCategoryTable | Sample data (pending API) | `ModCategoryData` (local) |
| **ModificationReasonTable** | **`POST /codetable/revisionreasons`** | `ModificationCategoryReason` from `Model.d` |
| ValidationDatesTable | Sample data (pending API) | `ValidationDateData` (local) |
| **RevisionFieldPermissionTable** | **`POST /codetable/revisionrules`** | `RevisionRules` from `Model.d` |

---

## Reusable Dropdown Components

These components live in `tables/projectDetails/` and are intended for use in project forms (e.g., the Add/Edit Project form).

### `CategoryDropdown`

```tsx
import CategoryDropdown from 'pages/CodeTables/tables/projectDetails/CategoryDropdown';

<CategoryDropdown
  value={form.Category}
  onChange={v => setForm(f => ({ ...f, Category: v }))}
  categories={projectEnums.Categories}   // CategoryEnum[] from getProjectEnums()
  placeholder="— Select Category —"
  disabled={false}
/>
```

Props: `value`, `onChange(n: number)`, `categories: CategoryEnum[]`, `placeholder`, `disabled`, `className`, `id`, `name`

### `ThrustDropdown`

```tsx
import ThrustDropdown from 'pages/CodeTables/tables/projectDetails/ThrustDropdown';

<ThrustDropdown
  value={form.Thrust}
  onChange={v => setForm(f => ({ ...f, Thrust: v }))}
  thrusts={projectEnums.Thrusts}         // ThrustEnum[] from getProjectEnums()
  infraTypeFilter={selectedInfraType}    // optional: narrows options by infra type
/>
```

Props: `value`, `onChange(n: number)`, `thrusts: ThrustEnum[]`, `infraTypeFilter?`, `placeholder`, `disabled`, `className`, `id`, `name`

> Options are grouped by `ProgramName` using `<optgroup>` elements.

---

## Adding a New Table

1. **Create the component** in the appropriate `tables/<domain>/` subfolder:
   ```tsx
   // tables/myDomain/MyNewTable.tsx
   import { Table, TableHead, ... } from '../../../../components/tailwindui/table';
   import { Button } from '../../../../components/tailwindui/button';

   const MyNewTable: React.FC = () => { /* ... */ };
   export default MyNewTable;
   ```

2. **Import and register** in `Views/CodeTables.tsx` under the correct group in `GROUPS`:
   ```tsx
   import MyNewTable from '../tables/myDomain/MyNewTable';

   // Inside GROUPS array, add to the relevant group's tables:
   { id: 'my-new-table', label: 'My New Table', component: MyNewTable }
   ```

3. If a new domain is needed, add a new entry to `GROUPS` with its own icon and `tables` array.

---

## Import Path Reference

| From | To tailwindui components | To Project Service | To CodeTable Service | To Project/Model.d |
|------|--------------------------|-------------------|----------------------|--------------------|
| `tables/*/` | `../../../../components/tailwindui/...` | `../../../Project/Service` | `../../Service` | `../../../Project/Model.d` |
| `Views/CodeTables.tsx` | `../../../components/tailwindui/...` | `../../Project/Service` | `../Service` | `../../Project/Model.d` |

---

## UI Conventions

- **Status badges:** `bg-green-50 text-green-700` (active), `bg-red-50 text-red-600` (obsolete/inactive), `bg-gray-100 text-gray-500` (closed)
- **Code/ID badges:** `font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded`
- **Table wrapper:** `overflow-x-auto rounded-lg border border-gray-200`
- **Pagination:** 15 rows per page (default for large tables)
- **Search:** Case-insensitive text filter on key columns
- **Add button:** `<Button color="indigo">` at top-right of table header
- **Add row inline:** indigo left-border highlight (`border-l-4 border-indigo-400 bg-indigo-50`), ✓ button opens `ConfirmDialog` in `'add'` mode
- **Edit row inline:** amber left-border highlight (`border-l-4 border-amber-400 bg-amber-50`), ✓ button (amber) opens `ConfirmDialog` in `'edit'` mode
- **Delete inline confirm:** inline "Delete?" prompt with Yes / No buttons (no modal)
- **Text inputs in rows:** `<textarea>` with `rows={2}` for names, `rows={3}` for descriptions, `resize-none`
- **Display truncation:** long text cells use `truncate` + `title` attribute for hover tooltip
- **Actions:** Edit (`color="zinc"`) and Delete (`color="red"`) per row

### `inp()` helper (defined locally per table)

```tsx
const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${
    v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
  }`;
```

---

## CRUD API

All create/update/delete calls go to `POST /CodeTable/UpdateCodeTable` via `updateCodeTable()` in `Service.ts`.

```ts
// Service.ts
updateCodeTable(code: string, transactionType: number, json: string): Promise<void>
// transactionType: 0 = Create, 1 = Update, 2 = Delete
// json: JSON.stringify of the record object
```

### Code values per table

| Table | Code |
|-------|------|
| CategoryTable | `ProjectCategory` |
| ThrustTable | `ProjectThrust` |
| AgencyTable | `ProjectAgency` |
| OriginTable | `ProjectOrigin` |
| ImplementationModeTable | `ProjectImplementationMode` |
| EmergencyModeTable | `ProjectEmergencyMode` |
| RowAvailableTable | `ProjectRowAvailable` |
| FeasibilityTable | `ProjectFeasibility` |
| DetailedDesignTable | `ProjectDetailedDesign` |
| RegionWideTable | `ProjectRegionWide` |
| CostTypeTable | `ProjectComponent` |
| InfraTypeTable | `ProjectInfraType` |
| FundingSourceTable | `FundingSource` |
| WorkCategoryTable | `ProjectScopeOfWork` |
| TypeOfWorkTable | `ProjectScopeOfWork` |

### Payload shapes

| Table | Create / Update payload | Delete payload |
|-------|------------------------|----------------|
| CategoryTable | `{ CategoryId, CategoryName, Minimum, Maximum, ValidUntil }` (+ `Id` for update) | `{ Id }` |
| ThrustTable | `{ PAPKey, ProgramName, SubProgramName, ActivityName, SequenceNumber, ThrustDescription, InfrastructureType, ValidFromDate, ValidToDate }` (+ `Id` for update) | `{ Id }` |
| AgencyTable | `{ NameId, Name, Description }` (+ `Id` for update) | `{ Id }` |
| OriginTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| ImplementationModeTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| EmergencyModeTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| RowAvailableTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| FeasibilityTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| DetailedDesignTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| RegionWideTable | `{ Name, Description }` (+ `Id` for update) | `{ Id }` |
| CostTypeTable | `{ ComponentId, ComponentName, ExportToPCMA }` (+ `Id` for update) | `{ Id }` |
| InfraTypeTable | `{ InfraId, InfraCode, InfraName }` (+ `Id` for update) | `{ Id }` |
| FundingSourceTable | `{ Organization, Name, Nature }` (+ `Id` for update) | `{ Id }` |
| WorkCategoryTable | `{ InfraType, WorkCategory }` (+ `Id: sourceId` for update) | `{ Id: sourceId }` |
| TypeOfWorkTable | `{ InfraType: [string], WorkCategory, Description, Measure, MinAmount, MaxAmount }` (+ `Id` for update) | `{ Id }` |

> `WorkCategoryTable` and `TypeOfWorkTable` both reference the real `ScopeOfWorkEnum.Id` (`sourceId`) for update/delete operations.

---

## Changelog

### Session 1 — API Migration
- Created `CodeTableContext.tsx`: single shared `POST CodeTable/GetAllCodeTables` fetch; provides `data / loading / error / refetch` to all consumer tables
- Migrated CostTypeTable, InfraTypeTable, FundingSourceTable, WorkCategoryTable, TypeOfWorkTable from sample data to live `CodeTableContext` data
- Updated `Model.d.ts` with `CodeTableData` interface (`ProjectComponents`, `InfraTypes`, `FundingSources`, `ScopeOfWorks`, `ProjectCategories`, `ProjectThrusts`, `ProjectAgencies`, `ProjectOrigins`)

### Session 2 — ThrustTable + Revision Tables Inline Edit
- **ThrustTable**: rebuilt to a clean 10-column layout with no merged cells; full inline add/edit/delete with `ConfirmDialog`
- **ModificationCategoryTable**: implemented full inline add/edit/delete
- **ModificationReasonTable**: implemented full inline add/edit/delete; wired to `fetchRevisionReasons` from `Service.ts`
- **RevisionFieldPermissionTable**: implemented full inline add/edit/delete; wired to `fetchRevisionRules` from `Service.ts`
- **ValidationDatesTable**: implemented full inline add/edit/delete

### Session 3 — Textarea Inputs + Display Truncation (13 files)
Across all 13 table files converted `<input type="text">` fields in add/edit rows to `<textarea>`:
- `rows={2}` for short name fields; `rows={3}` for description fields
- `resize-none` added to all `inp()` helpers
- Display cells got `truncate` class + `title` attribute for hover tooltip on long text

Files updated: CategoryTable, ThrustTable, OriginTable, AgencyTable, ImplementationModeTable, EmergencyModeTable, RowAvailableTable, FeasibilityTable, DetailedDesignTable, RegionWideTable, ModificationReasonTable, RevisionFieldPermissionTable, ValidationDatesTable

### Session 4 — Full CRUD Wiring (5 CodeTable tables)
Fixed broken pencil/edit buttons (no `onClick`) and wired all 5 CodeTable-backed tables to `updateCodeTable` via `POST /CodeTable/UpdateCodeTable`.

**`CostTypeTable`** (`componentCost/`):
- Code: `ProjectComponent`; FormState: `{ ComponentId, ComponentName, ExportToPCMA }`
- Full inline add row (textarea + checkbox), edit row (amber highlight), inline delete confirm
- `ConfirmDialog` for add and edit confirmations

**`InfraTypeTable`** (`majorItemLocation/`):
- Code: `ProjectInfraType`; FormState: `{ InfraId, InfraCode, InfraName }`
- Full inline add/edit/delete; number input for `InfraId`, textarea rows=1 for `InfraCode`, rows=2 for `InfraName`

**`FundingSourceTable`** (`fundingProfile/`):
- Code: `FundingSource`; FormState: `{ Organization, Name, Nature }`
- Full inline add/edit/delete; `<select>` for Nature (Local/Foreign); nature filter tabs preserved

**`WorkCategoryTable`** (`majorItemOfWorks/`):
- Code: `ProjectScopeOfWork`; derives unique `(infraType, workCategory)` pairs from `ScopeOfWorks`
- Added `sourceId: number` to row interface pointing to real `ScopeOfWorkEnum.Id` for update/delete
- FormState: `{ infraType, category }`; textarea rows=2 for both fields; infra type filter preserved

**`TypeOfWorkTable`** (`majorItemOfWorks/`):
- Code: `ProjectScopeOfWork`; flattens `ScopeOfWorks` one row per `InfraType[]` entry
- Fixed `id` to use real `ScopeOfWorkEnum.Id` (was synthetic counter)
- FormState: `{ infraType, workCategory, description, measure, minAmount, maxAmount }`
- `<select>` for Measure (Integer=0/Real=1); number inputs for min/max
- Pagination (15/page), infra type + work category filters preserved; removed `Unit of Measure` column (not in API model)
- `ConfirmDialog` for add and edit confirmations

