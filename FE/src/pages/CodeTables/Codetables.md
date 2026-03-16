# CodeTables Module

System reference data management with two-tier pill-tab navigation. All tables are organized into domain-specific subfolders under `tables/` and imported into the single parent view `CodeTables.tsx`.

---

## Folder Structure

```
pages/CodeTables/
├── Views/
│   └── CodeTables.tsx               ← Only entry point (pill group tabs + all group imports)
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
├── Model.d.ts                  ← TypeScript interfaces for revision tables
├── Service.ts                  ← API: fetchRevisionReasons, fetchRevisionRules
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
| **ProjectDetailsDropdowns** | **`POST /Project/InitAddProject`** (`getProjectEnums`) | `ProjectEnums` from `Project/Model.d` |
| CategoryTable | Sample data → API | `CategoryEnum` from `Project/Model.d` |
| ThrustTable | Sample data → API | `ThrustEnum` from `Project/Model.d` |
| OriginTable | Sample data → API | `TableEnum` from `Project/Model.d` |
| AgencyTable | Sample data → API | `AgencyEnum` from `Project/Model.d` — `{ Id (read-only), NameId*, Name*, Description? }` |
| MultiCriteriaAnalysisTable | Sample data (read-only) | `MCAData` (local) |
| CostTypeTable | Sample data → API | `ComponentTypeEnum` from `Project/Model.d` |
| WorkCategoryTable | Sample data → API | `WorkCategoryData` (local) |
| TypeOfWorkTable | Sample data → API | `TypeOfWork` (local) |
| InfraTypeTable | Sample data → API | `InfraTypeEnum` from `Project/Model.d` |
| FundingSourceTable | Sample data → API | `FundingSourceData` (local) |
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

| From | To tailwindui components | To Project Service | To CodeTable Service | To Project/Model.d | To dialogs/ |
|------|--------------------------|-------------------|----------------------|--------------------|-------------|
| `tables/*/` | `../../../../components/tailwindui/...` | `../../../Project/Service` | `../../Service` | `../../../Project/Model.d` | `../../dialogs/...` |
| `Views/CodeTables.tsx` | `../../../components/tailwindui/...` | `../../Project/Service` | `../Service` | `../../Project/Model.d` | `../dialogs/...` |
| `dialogs/` | `../../../components/tailwindui/...` | — | — | — | `./...` |

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
| CategoryTable | Sample data → API | `CategoryEnum` from `Project/Model.d` |
| ThrustTable | Sample data → API | `ThrustEnum` from `Project/Model.d` |
| OriginTable | Sample data → API | `TableEnum` from `Project/Model.d` |
| AgencyTable | Sample data → API | `AgencyEnum` from `Project/Model.d` — `{ Id (read-only), NameId*, Name*, Description? }` |
| MultiCriteriaAnalysisTable | Sample data → API | `MCAData` (local) |
| CostTypeTable | Sample data → API | `ComponentTypeEnum` from `Project/Model.d` |
| WorkCategoryTable | Sample data → API | `WorkCategoryData` (local) |
| TypeOfWorkTable | Sample data → API | `TypeOfWork` (local) |
| InfraTypeTable | Sample data → API | `InfraTypeEnum` from `Project/Model.d` |
| FundingSourceTable | Sample data → API | `FundingSourceData` (local) |
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
- **Actions:** Edit (`color="zinc"`) and Delete (`color="red"`) per row
