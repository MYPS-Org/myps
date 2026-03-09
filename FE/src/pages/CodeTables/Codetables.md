# CodeTables Module

System reference data management with two-tier pill-tab navigation. All tables are organized into domain-specific subfolders under `tables/` and imported into the single parent view `CodeTables.tsx`.

---

## Folder Structure

```
pages/CodeTables/
├── Views/
│   └── CodeTables.tsx               ← Only entry point (pill group tabs + all group imports)
├── tables/
│   ├── projectDetails/
│   │   ├── ProjectDetailsDropdowns.tsx ← Parent router for all 10 dropdown tables (API: getProjectEnums)
│   │   ├── CategoryTable.tsx           ← CategoryEnum CRUD (cost thresholds + validity)
│   │   ├── ThrustTable.tsx             ← ThrustEnum CRUD (PAP programs)
│   │   ├── OriginTable.tsx             ← TableEnum CRUD (project funding origin)
│   │   ├── AgencyTable.tsx             ← AgencyEnum CRUD (NameId · Name · Description)
│   │   ├── ImplementationModeTable.tsx ← TableEnum CRUD (by contract / admin / JV)
│   │   ├── EmergencyModeTable.tsx      ← TableEnum CRUD (normal / emergency / calamity)
│   │   ├── RowAvailableTable.tsx       ← TableEnum CRUD (ROW availability)
│   │   ├── FeasibilityTable.tsx        ← TableEnum CRUD (feasibility study status)
│   │   ├── DetailedDesignTable.tsx     ← TableEnum CRUD (detailed design status)
│   │   ├── RegionWideTable.tsx         ← TableEnum CRUD (yes / no region scope)
│   │   ├── MultiCriteriaAnalysisTable.tsx ← MCA scoring criteria (standalone)
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
