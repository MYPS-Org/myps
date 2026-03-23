# CodeTables Module

System reference data management with two-tier pill-tab navigation. All tables are organized into domain-specific subfolders under `tables/` and imported into the single parent view `CodeTables.tsx`.

---

## Folder Structure

```
pages/CodeTables/
â”œâ”€â”€ Views/
â”‚   â””â”€â”€ CodeTables.tsx               â† Only entry point (pill group tabs + CodeTableProvider wrapper)
â”œâ”€â”€ CodeTableContext.tsx             â† React context: fetches POST CodeTable/GetAllCodeTables once; provides data/loading/error/refetch to all tables
â”œâ”€â”€ dialogs/
â”‚   â”œâ”€â”€ ConfirmDialog.tsx            â† Dynamic confirmation dialog (add / edit modes)
â”‚   â””â”€â”€ useConfirmDialog.ts          â† Hook to manage dialog state from any table
â”œâ”€â”€ tables/
â”‚   â”œâ”€â”€ projectDetails/
â”‚   â”‚   â”œâ”€â”€ ProjectDetailsDropdowns.tsx â† Parent router for 4 dropdown tables (uses CodeTableContext only â€” no getProjectEnums)
â”‚   â”‚   â”œâ”€â”€ CategoryTable.tsx           â† CategoryEnum CRUD âœ“ dialog
â”‚   â”‚   â”œâ”€â”€ ThrustTable.tsx             â† ThrustEnum CRUD âœ“ dialog
â”‚   â”‚   â”œâ”€â”€ OriginTable.tsx             â† TableEnum CRUD âœ“ dialog
â”‚   â”‚   â”œâ”€â”€ AgencyTable.tsx             â† AgencyEnum CRUD âœ“ dialog
â”‚   â”‚   â”œâ”€â”€ ImplementationModeTable.tsx â† TableEnum CRUD (legacy / not shown in current nav)
â”‚   â”‚   â”œâ”€â”€ EmergencyModeTable.tsx      â† TableEnum CRUD (legacy / not shown in current nav)
â”‚   â”‚   â”œâ”€â”€ RowAvailableTable.tsx       â† TableEnum CRUD (legacy / not shown in current nav)
â”‚   â”‚   â”œâ”€â”€ FeasibilityTable.tsx        â† TableEnum CRUD (legacy / not shown in current nav)
â”‚   â”‚   â”œâ”€â”€ DetailedDesignTable.tsx     â† TableEnum CRUD (legacy / not shown in current nav)
â”‚   â”‚   â”œâ”€â”€ RegionWideTable.tsx         â† TableEnum CRUD (legacy / not shown in current nav)
â”‚   â”‚   â”œâ”€â”€ MultiCriteriaAnalysisTable.tsx â† MCA scoring criteria (read-only, no CRUD)
â”‚   â”‚   â”œâ”€â”€ CategoryDropdown.tsx        â† Reusable <select> for ProjectDetails.Category
â”‚   â”‚   â””â”€â”€ ThrustDropdown.tsx          â† Reusable <select> for ProjectDetails.Thrust
â”‚   â”œâ”€â”€ componentCost/
â”‚   â”‚   â””â”€â”€ CostTypeTable.tsx           â† ComponentTypeEnum (cost component types)
â”‚   â”œâ”€â”€ majorItemOfWorks/
â”‚   â”‚   â”œâ”€â”€ WorkCategoryTable.tsx       â† Major work categories
â”‚   â”‚   â””â”€â”€ TypeOfWorkTable.tsx         â† Specific work types with UoM and quantity limits
â”‚   â”œâ”€â”€ majorItemLocation/
â”‚   â”‚   â””â”€â”€ InfraTypeTable.tsx          â† InfraTypeEnum (infrastructure type codes)
â”‚   â”œâ”€â”€ fundingProfile/
â”‚   â”‚   â”œâ”€â”€ FundingAgreementTable.tsx   â† AgreementEnum CRUD (NEW â€” SourceOrg, Code, Name, FinancingSourceSegmentCode)
â”‚   â”‚   â””â”€â”€ FundingSourceTable.tsx      â† Funding organizations (Local / Foreign)
â”‚   â”œâ”€â”€ revisions/
â”‚   â”‚   â”œâ”€â”€ ModificationCategoryTable.tsx   â† Revision code groups (legacy)
â”‚   â”‚   â”œâ”€â”€ ModificationReasonTable.tsx     â† Revision reasons [CodeTableContext â†’ Reasons]
â”‚   â”‚   â”œâ”€â”€ RevisionCategoryTable.tsx       â† Read-only display (NEW â€” CodeTableContext â†’ RevisionCategories)
â”‚   â”‚   â”œâ”€â”€ RevisionHeaderTable.tsx         â† Read-only display (NEW â€” CodeTableContext â†’ RevisionHeaders)
â”‚   â”‚   â”œâ”€â”€ RevisionDocumentTable.tsx       â† Read-only display (NEW â€” CodeTableContext â†’ RevisionDocuments)
â”‚   â”‚   â”œâ”€â”€ RevisionStatusTable.tsx         â† Read-only display (NEW â€” CodeTableContext â†’ RevisionStatuses)
â”‚   â”‚   â”œâ”€â”€ RevisionFieldPermissionTable.tsx â† Full rewrite: toggle-switch field permission editor [CodeTableContext â†’ RevisionRules]
â”‚   â”‚   â””â”€â”€ ValidationDatesTable.tsx        â† Revision window dates per funding year
â”‚   â””â”€â”€ program/                        â† NEW domain (NEW)
â”‚       â”œâ”€â”€ ProgramStageTable.tsx       â† ProgramEnums CRUD (CodeTableContext â†’ ProgramStages)
â”‚       â”œâ”€â”€ ProgramTypeTable.tsx        â† ProgramEnums CRUD (CodeTableContext â†’ ProgramTypes)
â”‚       â””â”€â”€ ProgramStatusTable.tsx      â† ProgramEnums CRUD (CodeTableContext â†’ ProgramStatuses)
â”œâ”€â”€ Model.d.ts                  â† TypeScript interfaces (updated â€” see Interfaces section)
â”œâ”€â”€ Service.ts                  â† API: fetchCodeTableData<CodeTableData>, updateCodeTable
â””â”€â”€ Codetables.md               â† This file
```

---

## Confirmation Dialogs

All CRUD tables use a shared two-file pattern for add/edit confirmation.

### `dialogs/ConfirmDialog.tsx`

A single dynamic modal that handles **both Add and Edit** scenarios.

| Mode | Icon accent | Badge accent | Confirm button | Warning note |
|------|-------------|--------------|----------------|--------------|
| `'add'` | Emerald | Emerald | "Confirm Add" | â€” |
| `'edit'` | Amber | Amber | "Save Changes" | "This will overwriteâ€¦" |

**Props:**
```ts
interface ConfirmField {
  label: string;
  value: string | number;
  mono?: boolean;   // renders value in monospace badge
  hidden?: boolean; // skip entirely
}

interface ConfirmDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  tableName: string;
  fields: ConfirmField[];
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}
```

### `dialogs/useConfirmDialog.ts`

Hook that manages all dialog state. Returns `{ request, close, setLoading, dialogProps }`.

```tsx
const confirm = useConfirmDialog();

// On âœ“ click in Add row:
confirm.request({
  mode: 'add',
  tableName: 'My Table',
  fields: [{ label: 'Name', value: form.Name }],
  onConfirm: () => { saveAdd(); confirm.close(); },
});

// On âœ“ click in Edit row:
confirm.request({
  mode: 'edit',
  tableName: 'My Table',
  fields: [{ label: 'Name', value: editForm.Name }],
  onConfirm: () => { saveEdit(); confirm.close(); },
});

// In JSX (one line, at bottom of return):
<ConfirmDialog {...confirm.dialogProps} />
```

**Import path** from any `tables/<domain>/` component:
```tsx
import ConfirmDialog         from '../../dialogs/ConfirmDialog';
import { useConfirmDialog }  from '../../dialogs/useConfirmDialog';
```

---

## Navigation

`CodeTables.tsx` renders a **two-tier pill-tab layout**:

| Tier | Style | Purpose |
|------|-------|---------|
| Primary tabs (top) | Filled pill, icon + label | One per group (6 groups) |
| Secondary tabs | Filled pill | One per table within the active group (hidden when only one table) |

**Groups and their tabs (current structure):**

| Group (Primary Tab) | Icon | Tables (Secondary Tabs) |
|---------------------|------|------------------------|
| Project Details | `ClipboardDocumentListIcon` | Form Dropdowns |
| Component Cost | `CubeIcon` | Cost Type |
| Major Item | `WrenchScrewdriverIcon` | Work Category Â· Type of Work Â· Infrastructure Types |
| Funding Profile | `BanknotesIcon` | Funding Agreement Â· Funding Source |
| Revisions | `ArrowPathIcon` | Categories Â· Headers Â· Documents Â· Reasons Â· Statuses Â· Rules Â· Validation Dates |
| Programs *(new)* | `PresentationChartBarIcon` | Program Stage Â· Program Type Â· Program Status |

> Switching a primary tab auto-selects the first secondary tab in that group.

### Project Details â€” `ProjectDetailsDropdowns.tsx`

Simplified in latest refactor: **no longer calls `getProjectEnums()`**. Now uses only `CodeTableContext`.

| Pill Tab | Child Component | CodeTableData Key |
|----------|----------------|-------------------|
| Category | `CategoryTable` | `ProjectCategories` |
| Thrust | `ThrustTable` | `ProjectThrusts` |
| Agency | `AgencyTable` | `ProjectAgencies` |
| Origin | `OriginTable` | `ProjectOrigins` |

---

## Data Sources

All tables now use **`CodeTableContext`** (single fetch of `POST CodeTable/GetAllCodeTables`). No table makes its own API calls.

| Table | CodeTableData Key | Interface |
|-------|-------------------|-----------|
| ProjectDetailsDropdowns â†’ CategoryTable | `ProjectCategories` | `CategoryEnum` from `Project/Model.d` |
| ProjectDetailsDropdowns â†’ ThrustTable | `ProjectThrusts` | `ThrustEnum` from `Project/Model.d` |
| ProjectDetailsDropdowns â†’ AgencyTable | `ProjectAgencies` | `AgencyEnum` from `Project/Model.d` |
| ProjectDetailsDropdowns â†’ OriginTable | `ProjectOrigins` | `TableEnum` from `Project/Model.d` |
| CostTypeTable | `ProjectComponents` | `ComponentTypeEnum` from `Project/Model.d` |
| WorkCategoryTable | `ScopeOfWorks` | `ScopeOfWorkEnum` from `Project/Model.d` |
| TypeOfWorkTable | `ScopeOfWorks` | `ScopeOfWorkEnum` from `Project/Model.d` |
| InfraTypeTable | `InfraTypes` | `InfraTypeEnum` from `Project/Model.d` |
| **FundingAgreementTable** *(new)* | `FundingAgreements` | `AgreementEnum` from `Project/Model.d` |
| FundingSourceTable | `FundingSources` | `SourceEnum` from `Project/Model.d` |
| **RevisionCategoryTable** *(new, read-only)* | `RevisionCategories` | `any[]` (dynamic columns) |
| **RevisionHeaderTable** *(new, read-only)* | `RevisionHeaders` | `any[]` (dynamic columns) |
| **RevisionDocumentTable** *(new, read-only)* | `RevisionDocuments` | `any[]` (dynamic columns) |
| **RevisionStatusTable** *(new, read-only)* | `RevisionStatuses` | `any[]` (dynamic columns) |
| ModificationReasonTable | `Reasons` | `ModificationCategoryReason` from `Model.d` |
| RevisionFieldPermissionTable | `RevisionRules` | `RevisionRules` from `Model.d` |
| ValidationDatesTable | Sample data (pending API) | local |
| **ProgramStageTable** *(new)* | `ProgramStages` | `ProgramEnums` from `Model.d` |
| **ProgramTypeTable** *(new)* | `ProgramTypes` | `ProgramEnums` from `Model.d` |
| **ProgramStatusTable** *(new)* | `ProgramStatuses` | `ProgramEnums` from `Model.d` |

---

## Interfaces (`Model.d.ts`)

### `ModificationCategoryReason` *(updated)*

Matches actual `Reasons` JSON shape from the API:

```ts
export interface ModificationCategoryReason {
  Id: number;
  Reason: string;
  RevisionGroupId: number;
  ReasonId: number;
  CategoryId: number[];
  IsDeleted: boolean;
}
```

### `RevisionRules` *(updated)*

Matches actual `RevisionRules` JSON shape from the API (field names use underscore, no `Category`):

```ts
export interface RevisionRules {
  Id: number;
  Reason: string;
  RevisionGroupId: number;
  ReasonId: number;
  PCMA_Status: string;
  Package_Status: string;
  Field: string;   // JSON string â€” parsed internally by RevisionFieldPermissionTable
}
```

### `ProgramEnums` *(new)*

```ts
export interface ProgramEnums {
  Id: number;
  NameId: number;
  Name: string;
  Description: string;
}
```

### `CodeTableData`

All data for the module comes from one context fetch. Keys:

```ts
export interface CodeTableData {
  CodeTable: CodeTable[];
  ProgramStages: ProgramEnums[];
  ProgramStatuses: ProgramEnums[];
  ProgramTypes: ProgramEnums[];
  ProjectCategories: CategoryEnum[];
  ProjectThrusts: ThrustEnum[];
  ProjectAgencies: AgencyEnum[];
  ProjectOrigins: TableEnum[];
  FundingAgreements: AgreementEnum[];
  FundingSources: SourceEnum[];
  ScopeOfWorks: ScopeOfWorkEnum[];
  InfraTypes: InfraTypeEnum[];
  ProjectComponents: ComponentTypeEnum[];
  RevisionCategories: unknown[];
  RevisionDocuments: unknown[];
  RevisionHeaders: unknown[];
  Reasons: unknown[];         // cast to ModificationCategoryReason[]
  RevisionStatuses: unknown[];
  RevisionRules: RevisionRules[];
}
```

---

## CRUD Pattern

All editable tables follow the same pattern:

| Constant | Description |
|----------|-------------|
| `CODE` | String identifier sent to `updateCodeTable` (e.g. `'ProgramStage'`, `'FundingAgreement'`) |
| `TransactionType 0` | Add |
| `TransactionType 1` | Edit |
| `TransactionType 2` | Delete |

```ts
import { updateCodeTable } from '../../Service';
updateCodeTable(CODE, transactionType, JSON.stringify(payload));
```

---

## RevisionFieldPermissionTable â€” Field Permission Editor

The `Field` column in `RevisionRules` is a JSON string. Instead of displaying raw JSON, the table renders a **structured toggle-switch UI**:

- **"View Rules"** button on each row expands an inline panel (read-only toggles)
- **Edit mode** makes all toggles interactive
- Six collapsible sections:

| Section | Has CRUD toggles |
|---------|-----------------|
| Project Details | No (flat field map) |
| Component Cost | Yes (Can Add / Can Delete) |
| Component Cost Year | Yes |
| Major Item of Work | Yes |
| Major Item Location | Yes |
| Funding Profile | Yes |

Each section shows a summary: `N / total editable Â· Can Add Â· Can Delete`

The parsed `FieldRules` structure:
```ts
interface FieldRules {
  ProjectDetailsRules: Record<string, boolean>;
  ComponentCostRules: { Fields: Record<string, boolean>; CRUD: { Message: string; CanAdd: boolean; CanDelete: boolean } };
  ComponentCostYearRules: { ... };
  MajorItemOfWorkRules: { ... };
  MajorItemLocationRules: { ... };
  FundingProfileRules: { ... };
}
```

---

## Reusable Dropdown Components

### `CategoryDropdown`

```tsx
import CategoryDropdown from 'pages/CodeTables/tables/projectDetails/CategoryDropdown';
<CategoryDropdown value={form.Category} onChange={n => setForm(f => ({...f, Category: n}))} categories={cats} />
```

Props: `value`, `onChange(n: number)`, `categories: CategoryEnum[]`, `placeholder`, `disabled`, `className`, `id`, `name`

### `ThrustDropdown`

```tsx
import ThrustDropdown from 'pages/CodeTables/tables/projectDetails/ThrustDropdown';
<ThrustDropdown value={form.Thrust} onChange={n => setForm(f => ({...f, Thrust: n}))} thrusts={thrusts} infraTypeFilter={selectedInfraType} />
```

Props: `value`, `onChange(n: number)`, `thrusts: ThrustEnum[]`, `infraTypeFilter?`, `placeholder`, `disabled`, `className`, `id`, `name`

> Options are grouped by `ProgramName` using `<optgroup>` elements.

---

## Adding a New Table

1. **Create the component** in the appropriate `tables/<domain>/` subfolder:
   ```tsx
   import { useCodeTableContext } from '../../CodeTableContext';

   const MyTable: React.FC = () => {
     const { data: codeTableData, loading } = useCodeTableContext();
     const data = (codeTableData?.MyKey ?? []) as MyType[];
     // ...
   };
   export default MyTable;
   ```

2. **Import and register** in `Views/CodeTables.tsx` under the correct group in `GROUPS`:
   ```tsx
   import MyTable from '../tables/myDomain/MyTable';
   // in GROUPS:
   { id: 'my-group', label: 'My Group', icon: SomeIcon, tables: [
     { id: 'my-table', label: 'My Label', component: MyTable },
   ]}
   ```

3. If a new domain is needed, add a new entry to `GROUPS` with its own icon and `tables` array.

---

## Import Path Reference

| From | To tailwindui components | To Project Service | To CodeTable Service | To Project/Model.d | To dialogs/ | To Context |
|------|--------------------------|-------------------|----------------------|--------------------|-------------|------------|
| `tables/*/` | `../../../../components/tailwindui/...` | `../../../Project/Service` | `../../Service` | `../../../Project/Model.d` | `../../dialogs/...` | `../../CodeTableContext` |
| `Views/CodeTables.tsx` | `../../../components/tailwindui/...` | `../../Project/Service` | `../Service` | `../../Project/Model.d` | `../dialogs/...` | `../CodeTableContext` |
| `dialogs/` | `../../../components/tailwindui/...` | â€” | â€” | â€” | `./...` | â€” |

---

## UI Conventions

- **Status badges:** `bg-green-50 text-green-700` (active), `bg-red-50 text-red-600` (obsolete/deleted), `bg-gray-100 text-gray-500` (closed)
- **Code/ID badges:** `font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded`
- **Table wrapper:** `overflow-x-auto rounded-lg border border-gray-200`
- **Pagination:** 15 rows per page (default for large tables)
- **Search:** Case-insensitive text filter on key columns
- **Add button:** `<Button color="indigo">` at top-right of table header
- **Add row inline:** indigo left-border highlight (`border-l-4 border-indigo-400 bg-indigo-50`), âœ“ button opens `ConfirmDialog` in `'add'` mode
- **Edit row inline:** amber left-border highlight (`border-l-4 border-amber-400 bg-amber-50`), âœ“ button (amber) opens `ConfirmDialog` in `'edit'` mode
- **Actions:** Edit (`color="zinc"`) and Delete (`color="red"`) per row
- **Toggle switch:** Used in `RevisionFieldPermissionTable` for boolean field permissions â€” indigo when `true`, gray when `false`, disabled (opacity-50) in read-only mode
---

## Changelog

### Session 5 — CodeTableContext Full Migration + Programs Group (Current)

**Dropped `getProjectEnums()`** — `ProjectDetailsDropdowns.tsx` simplified from 10 tabs to 4 CodeTableContext-only tabs:

| Tab | CodeTableData Key |
|-----|-------------------|
| Category | `ProjectCategories` |
| Thrust | `ProjectThrusts` |
| Agency | `ProjectAgencies` |
| Origin | `ProjectOrigins` |

**New `programs/` domain** — 3 new CRUD tables, all `ProgramEnums` interface, all wired to CodeTableContext:
- `ProgramStageTable` → `ProgramStages` / CODE `ProgramStage`
- `ProgramTypeTable` → `ProgramTypes` / CODE `ProgramType`
- `ProgramStatusTable` → `ProgramStatuses` / CODE `ProgramStatus`

**New `fundingProfile/FundingAgreementTable`** — `AgreementEnum` CRUD, CODE `FundingAgreement`, columns: SourceOrg, Code, Name, FinancingSourceSegmentCode.

**4 new read-only revision display tables** (dynamic columns from first row's keys):
- `RevisionCategoryTable` → `RevisionCategories`
- `RevisionHeaderTable` → `RevisionHeaders`
- `RevisionDocumentTable` → `RevisionDocuments`
- `RevisionStatusTable` → `RevisionStatuses`

**`ModificationReasonTable` — full rewrite** to match actual `Reasons` JSON shape:
- Old interface: `{id, codeGroupId: string, codeDescription, sequenceNo, obsoleteFlag}`
- New interface: `{Id, Reason, RevisionGroupId, ReasonId, CategoryId: number[], IsDeleted}`
- Data source changed from `fetchRevisionReasons` → `CodeTableContext.Reasons`
- Removed StatusFilter (Active/Obsolete) toggle; new Status badge shows Active / Deleted

**`RevisionFieldPermissionTable` — complete rewrite**:
- Removed `Category` column (does not exist in JSON)
- Fixed `PCMA_Status` / `Package_Status` field names (were camelCase `PCMAStatus`/`PackageStatus`)
- Status badges per value (Terminated=red, Not Yet Started=yellow, On-Going=blue, Completed=green, Packaged=indigo, Unpackaged=gray)
- Replaced raw JSON `Field` string with interactive `FieldRulesEditor` component:
  - `Toggle` component: animated indigo/gray switch with `disabled` read-only prop
  - `ProjectDetailsRules` section: flat grid of field-name + toggle pairs
  - 5 CRUD sections (ComponentCost, ComponentCostYear, MajorItemOfWork, MajorItemLocation, FundingProfile): field toggles + Can Add / Can Delete toggles
  - Collapsed summary shows `N / total editable · Can Add · Can Delete`
  - "View Rules" button expands inline read-only panel; edit mode shows interactive toggles
- Data source changed from `fetchRevisionRules` → `CodeTableContext.RevisionRules`

**`CodeTables.tsx` GROUPS restructure** — 6 groups (unchanged count, but reorganized):

| Before | After |
|--------|-------|
| Project Details → Form Dropdowns | Project Details → Form Dropdowns (4 tabs only) |
| Component Cost → Cost Type | Component Cost → Cost Type |
| Major Item of Works → Work Category · Type of Work | **Major Item** → Work Category · Type of Work · Infrastructure Types *(merged)* |
| Major Item Locations → Infrastructure Types | *(absorbed into Major Item above)* |
| Funding Profile → Funding Source | Funding Profile → **Funding Agreement** · Funding Source |
| Revisions → 4 tabs | Revisions → **7 tabs** (+ Categories · Headers · Documents · Statuses) |
| *(none)* | **Programs** → Program Stage · Program Type · Program Status *(new group)* |

**`Model.d.ts` interface updates**:
- `ModificationCategoryReason`: complete field rename to match JSON
- `RevisionRules`: removed `Category`, renamed `PCMAStatus`→`PCMA_Status`, `PackageStatus`→`Package_Status`, added `RevisionGroupId`, `ReasonId`
- `ProgramEnums`: new interface `{Id, NameId, Name, Description}`
- `CodeTableData`: extended with `FundingAgreements`, `ProgramStages`, `ProgramTypes`, `ProgramStatuses`, `RevisionCategories`, `RevisionDocuments`, `RevisionHeaders`, `RevisionStatuses`
