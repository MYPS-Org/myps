# CodeTables Module

System reference data management with two-tier pill-tab navigation. All tables are organized into domain-specific subfolders under `tables/` and imported into the single parent view `CodeTables.tsx`.

---

## Folder Structure

```
pages/CodeTables/
├── Views/
│   └── CodeTables.tsx               ← Entry point: 7 pill group tabs wrapped in CodeTableProvider + AdminAreaProvider
├── CodeTableContext.tsx             ← React context: fetches POST CodeTable/GetAllCodeTables once; provides data/loading/error/refetch
├── AdminAreaContext.tsx             ← React context: fetches POST CodeTable/GetAdminAreas once; provides data/loading/error/refetch
├── dialogs/
│   ├── ConfirmDialog.tsx            ← Dynamic confirmation dialog (add / edit modes)
│   └── useConfirmDialog.ts          ← Hook to manage dialog state from any table
├── tables/
│   ├── projectDetails/
│   │   ├── ProjectDetailsDropdowns.tsx  ← Parent router for 4 dropdown tables (CodeTableContext only – no getProjectEnums)
│   │   ├── CategoryTable.tsx            ← CategoryEnum CRUD ✓ dialog
│   │   ├── ThrustTable.tsx              ← ThrustEnum CRUD ✓ dialog
│   │   ├── OriginTable.tsx              ← TableEnum CRUD ✓ dialog
│   │   ├── AgencyTable.tsx              ← AgencyEnum CRUD ✓ dialog
│   │   ├── ImplementationModeTable.tsx  ← TableEnum CRUD (legacy / not in nav)
│   │   ├── EmergencyModeTable.tsx       ← TableEnum CRUD (legacy / not in nav)
│   │   ├── RowAvailableTable.tsx        ← TableEnum CRUD (legacy / not in nav)
│   │   ├── FeasibilityTable.tsx         ← TableEnum CRUD (legacy / not in nav)
│   │   ├── DetailedDesignTable.tsx      ← TableEnum CRUD (legacy / not in nav)
│   │   ├── RegionWideTable.tsx          ← TableEnum CRUD (legacy / not in nav)
│   │   ├── MultiCriteriaAnalysisTable.tsx ← MCA scoring criteria (read-only, no CRUD)
│   │   ├── CategoryDropdown.tsx         ← Reusable <select> for ProjectDetails.Category
│   │   └── ThrustDropdown.tsx           ← Reusable <select> for ProjectDetails.Thrust
│   ├── componentCost/
│   │   └── CostTypeTable.tsx            ← ComponentTypeEnum (cost component types)
│   ├── majorItemOfWorks/
│   │   ├── WorkCategoryTable.tsx        ← Major work categories
│   │   └── TypeOfWorkTable.tsx          ← Specific work types with UoM and quantity limits
│   ├── majorItemLocation/
│   │   └── InfraTypeTable.tsx           ← InfraTypeEnum (infrastructure type codes)
│   ├── fundingProfile/
│   │   ├── FundingAgreementTable.tsx    ← AgreementEnum CRUD; CODE FundingAgreement; fields: SourceOrg, Code, Name, FinancingSourceSegmentCode
│   │   └── FundingSourceTable.tsx       ← Funding organizations (Local / Foreign)
│   ├── revisions/
│   │   ├── ModificationCategoryTable.tsx    ← Revision code groups (legacy)
│   │   ├── ModificationReasonTable.tsx      ← Reasons CRUD; CODE ModificationReason [CodeTableContext → Reasons]
│   │   ├── RevisionCategoryTable.tsx        ← Edit/Delete only (no Add, no ConfirmDialog); CODE RevisionCategory [CodeTableContext → RevisionCategories]
│   │   ├── RevisionHeaderTable.tsx          ← Edit/Delete only (no Add, no ConfirmDialog); CODE RevisionHeader [CodeTableContext → RevisionHeaders]
│   │   ├── RevisionDocumentTable.tsx        ← Edit/Delete only (no Add, no ConfirmDialog); CODE RevisionDocument [CodeTableContext → RevisionDocuments]
│   │   ├── RevisionStatusTable.tsx          ← Edit/Delete only (no Add, no ConfirmDialog); CODE RevisionStatus [CodeTableContext → RevisionStatuses]
│   │   ├── RevisionFieldPermissionTable.tsx ← Toggle-switch field permission editor; CODE RevisionRules [CodeTableContext → RevisionRules]
│   │   └── ValidationDatesTable.tsx         ← Revision window dates per funding year (local sample data – API pending)
│   ├── program/
│   │   ├── ProgramStageTable.tsx        ← ProgramEnums CRUD; CODE ProgramStage [CodeTableContext → ProgramStages]
│   │   ├── ProgramTypeTable.tsx         ← ProgramEnums CRUD; CODE ProgramType [CodeTableContext → ProgramTypes]
│   │   └── ProgramStatusTable.tsx       ← ProgramEnums CRUD; CODE ProgramStatus [CodeTableContext → ProgramStatuses]
│   └── adminArea/
│       ├── RegionTable.tsx              ← AdminAreaRegion CRUD; CODE AdminAreaRegion [AdminAreaContext → Regions]; 15/page
│       ├── ProvinceTable.tsx            ← AdminAreaProvince CRUD; CODE AdminAreaProvince [AdminAreaContext → Provinces]; region dropdown; 15/page
│       ├── CityTable.tsx                ← AdminAreaCity CRUD; CODE AdminAreaCity [AdminAreaContext → Cities]; province filter; 20/page
│       ├── LegislativeDistrictTable.tsx ← AdminAreaDistrict CRUD; CODE AdminAreaDistrict [AdminAreaContext → Districts]; province filter; 20/page
│       └── DEOTable.tsx                 ← AdminAreaDEO CRUD; CODE AdminAreaDEO [AdminAreaContext → DEOs]; province+region dropdowns; 20/page
├── Model.d.ts                  ← TypeScript interfaces (see Interfaces section)
├── Service.ts                  ← API: fetchCodeTableData, fetchAdminAreas, updateCodeTable
└── Codetables.md               ← This file
```

---

## Contexts

### `CodeTableContext.tsx`

Fetches **`POST CodeTable/GetAllCodeTables`** once on mount. All tables under `project-details`, `component-cost`, `major-item`, `funding-profile`, `revisions`, and `programs` groups consume this context.

```tsx
const { data, loading, error, refetch } = useCodeTableContext();
```

| Value | Type | Description |
|-------|------|-------------|
| `data` | `CodeTableData \| null` | Full response from GetAllCodeTables |
| `loading` | `boolean` | True during initial fetch and any refetch |
| `error` | `string \| null` | Error message or null |
| `refetch` | `() => Promise<void>` | Re-runs the fetch; call after any mutation |

**Provider:** `<CodeTableProvider>` wraps `CodeTables.tsx`.

### `AdminAreaContext.tsx`

Fetches **`POST CodeTable/GetAdminAreas`** once on mount. All tables under the `admin-areas` group consume this context.

```tsx
const { data, loading, error, refetch } = useAdminAreaContext();
```

| Value | Type | Description |
|-------|------|-------------|
| `data` | `AdminAreaData \| null` | Full response from GetAdminAreas |
| `loading` | `boolean` | True during initial fetch and any refetch |
| `error` | `string \| null` | Error message or null |
| `refetch` | `() => Promise<void>` | Re-runs the fetch; call after any mutation |

**Provider:** `<AdminAreaProvider>` wraps `CodeTables.tsx` alongside `CodeTableProvider`.

---

## Confirmation Dialogs

Most CRUD tables use a shared two-file pattern for add/edit confirmation.

> **Exception:** `RevisionCategoryTable`, `RevisionHeaderTable`, `RevisionDocumentTable`, and `RevisionStatusTable` use an **inline delete confirmation row** and do **not** use `ConfirmDialog`. They also have **no Add row** — Edit and Delete only.

### `dialogs/ConfirmDialog.tsx`

A single dynamic modal that handles **both Add and Edit** scenarios.

| Mode | Icon accent | Badge accent | Confirm button | Warning note |
|------|-------------|--------------|----------------|--------------|
| `'add'` | Emerald | Emerald | "Confirm Add" | – |
| `'edit'` | Amber | Amber | "Save Changes" | "This will overwrite…" |

**Props:**
```ts
interface ConfirmField {
  label: string;
  value: string | number | boolean | null | undefined;
  mono?: boolean;     // renders value in a monospace code badge
  optional?: boolean; // empty value shows "empty (optional)" instead of "—"
  hidden?: boolean;   // skip this field entirely from the summary
}

interface ConfirmDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  tableName: string;
  fields: ConfirmField[];
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;   // disables confirm button and shows spinner
}
```

### `dialogs/useConfirmDialog.ts`

Hook that manages all dialog state. Returns `{ request, close, setLoading, dialogProps }`.

```tsx
const confirm = useConfirmDialog();

// On ✓ click in Add row:
confirm.request({
  mode: 'add',
  tableName: 'My Table',
  fields: [{ label: 'Name', value: form.Name }],
  onConfirm: () => { saveAdd(); confirm.close(); },
});

// On ✓ click in Edit row:
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
| Primary tabs (top) | Filled pill, icon + label | One per group (7 groups) |
| Secondary tabs | Filled pill | One per table within the active group (hidden when only one table) |

**Groups and their tabs (current structure):**

| Group (Primary Tab) | Icon | Tables (Secondary Tabs) |
|---------------------|------|------------------------|
| Project Details | `ClipboardDocumentListIcon` | Form Dropdowns |
| Component Cost | `CubeIcon` | Cost Type |
| Major Item | `WrenchScrewdriverIcon` | Work Category · Type of Work · Infrastructure Types |
| Funding Profile | `BanknotesIcon` | Funding Agreement · Funding Source |
| Revisions | `ArrowPathIcon` | Categories · Headers · Documents · Reasons · Statuses · Rules · Validation Dates |
| Programs | `PresentationChartBarIcon` | Program Stage · Program Type · Program Status |
| Admin Areas | `MapPinIcon` | Regions · Provinces · Cities/Municipalities · Legislative Districts · DEOs |

> Switching a primary tab auto-selects the first secondary tab in that group.
> The badge on each primary tab shows the count of secondary tables in that group.

### Project Details – `ProjectDetailsDropdowns.tsx`

Uses only `CodeTableContext` (no `getProjectEnums()`).

| Pill Tab | Child Component | CodeTableData Key |
|----------|----------------|-------------------|
| Category | `CategoryTable` | `ProjectCategories` |
| Thrust | `ThrustTable` | `ProjectThrusts` |
| Agency | `AgencyTable` | `ProjectAgencies` |
| Origin | `OriginTable` | `ProjectOrigins` |

---

## Data Sources

All non-admin-area tables consume **`CodeTableContext`** (single `POST CodeTable/GetAllCodeTables` fetch).
Admin area tables consume **`AdminAreaContext`** (single `POST CodeTable/GetAdminAreas` fetch).
No table makes its own individual API calls.

| Table | Context | Data Key | Interface |
|-------|---------|----------|-----------|
| CategoryTable | `CodeTableContext` | `ProjectCategories` | `CategoryEnum` from `Project/Model.d` |
| ThrustTable | `CodeTableContext` | `ProjectThrusts` | `ThrustEnum` from `Project/Model.d` |
| AgencyTable | `CodeTableContext` | `ProjectAgencies` | `AgencyEnum` from `Project/Model.d` |
| OriginTable | `CodeTableContext` | `ProjectOrigins` | `TableEnum` from `Project/Model.d` |
| CostTypeTable | `CodeTableContext` | `ProjectComponents` | `ComponentTypeEnum` from `Project/Model.d` |
| WorkCategoryTable | `CodeTableContext` | `ScopeOfWorks` | `ScopeOfWorkEnum` from `Project/Model.d` |
| TypeOfWorkTable | `CodeTableContext` | `ScopeOfWorks` | `ScopeOfWorkEnum` from `Project/Model.d` |
| InfraTypeTable | `CodeTableContext` | `InfraTypes` | `InfraTypeEnum` from `Project/Model.d` |
| FundingAgreementTable | `CodeTableContext` | `FundingAgreements` | `AgreementEnum` from `Project/Model.d` |
| FundingSourceTable | `CodeTableContext` | `FundingSources` | `SourceEnum` from `Project/Model.d` |
| RevisionCategoryTable | `CodeTableContext` | `RevisionCategories` | `unknown[]` (dynamic columns from first row) |
| RevisionHeaderTable | `CodeTableContext` | `RevisionHeaders` | `unknown[]` (dynamic columns from first row) |
| RevisionDocumentTable | `CodeTableContext` | `RevisionDocuments` | `unknown[]` (dynamic columns from first row) |
| RevisionStatusTable | `CodeTableContext` | `RevisionStatuses` | `unknown[]` (dynamic columns from first row) |
| ModificationReasonTable | `CodeTableContext` | `Reasons` | `ModificationCategoryReason` from `Model.d` |
| RevisionFieldPermissionTable | `CodeTableContext` | `RevisionRules` | `RevisionRules` from `Model.d` |
| ValidationDatesTable | local sample data | *(API pending)* | local `ValidationDateData` |
| ProgramStageTable | `CodeTableContext` | `ProgramStages` | `ProgramEnums` from `Model.d` |
| ProgramTypeTable | `CodeTableContext` | `ProgramTypes` | `ProgramEnums` from `Model.d` |
| ProgramStatusTable | `CodeTableContext` | `ProgramStatuses` | `ProgramEnums` from `Model.d` |
| RegionTable | `AdminAreaContext` | `Regions` | `AdminAreaRegion` from `Model.d` |
| ProvinceTable | `AdminAreaContext` | `Provinces` | `AdminAreaProvince` from `Model.d` |
| CityTable | `AdminAreaContext` | `Cities` | `AdminAreaCity` from `Model.d` |
| LegislativeDistrictTable | `AdminAreaContext` | `Districts` | `AdminAreaDistrict` from `Model.d` |
| DEOTable | `AdminAreaContext` | `DEOs` | `AdminAreaDEO` from `Model.d` |

---

## Interfaces (`Model.d.ts`)

### `ModificationCategoryReason`

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

### `RevisionRules`

Matches actual `RevisionRules` JSON shape from the API (field names use underscore, no `Category`):

```ts
export interface RevisionRules {
  Id: number;
  Reason: string;
  RevisionGroupId: number;
  ReasonId: number;
  PCMA_Status: string;
  Package_Status: string;
  Field: string;   // JSON string – parsed internally by RevisionFieldPermissionTable
}
```

### `ProgramEnums`

```ts
export interface ProgramEnums {
  Id: number;
  NameId: number;
  Name: string;
  Description: string;
}
```

### `AdminAreaRegion`

```ts
export interface AdminAreaRegion {
  Id: number;
  GdbId: string;
  Name: string;
  ParticipantId: string;
  IslandCode: string;
}
```

### `AdminAreaProvince`

```ts
export interface AdminAreaProvince {
  Id: number;
  GdbId: string;
  Name: string;
  Code?: string;
  RegionParticipantId: string;
  RegionName: string;
}
```

### `AdminAreaCity`

```ts
export interface AdminAreaCity {
  Id: number;
  GdbId: string;
  Name: string;
  Code?: string;
  ProvinceGdbId: string;
  ProvinceName: string;
}
```

### `AdminAreaDistrict`

```ts
export interface AdminAreaDistrict {
  Id: number;
  GdbId: string;
  Name: string;
  Code?: string;
  ProvinceGdbId: string;
  ProvinceName: string;
}
```

### `AdminAreaDEO`

```ts
export interface AdminAreaDEO {
  Id: number;
  GdbId?: string;
  Name: string;
  ParticipantId: string;
  ProvinceGdbId: string;
  ProvinceName?: string;
  RegionParticipantId: string;
  RegionName: string;
}
```

### `AdminAreaData`

Shape returned by `POST CodeTable/GetAdminAreas`:

```ts
export interface AdminAreaData {
  Regions: AdminAreaRegion[];
  Provinces: AdminAreaProvince[];
  Cities: AdminAreaCity[];
  Districts: AdminAreaDistrict[];
  DEOs: AdminAreaDEO[];
}
```

### `CodeTableData`

All data for non-admin-area tables comes from one context fetch. Keys:

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

## Service (`Service.ts`)

| Function | Endpoint | Return type |
|----------|----------|-------------|
| `fetchCodeTableData()` | `POST CodeTable/GetAllCodeTables` | `CodeTableData` |
| `fetchAdminAreas()` | `POST CodeTable/GetAdminAreas` | `AdminAreaData` |
| `updateCodeTable(code, transactionType, json)` | `POST CodeTable/UpdateCodeTable` | void |
| `fetchRevisionReasons()` *(legacy)* | `POST /codetable/revisionreasons` | `ModificationCategoryReason[]` |
| `fetchRevisionRules()` *(legacy)* | `POST /codetable/revisionrules` | `RevisionRules[]` |

> `fetchRevisionReasons` and `fetchRevisionRules` are legacy; tables now read from `CodeTableContext` instead.

---

## CRUD Pattern

All editable tables follow the same pattern:

| Constant | Description |
|----------|-------------|
| `CODE` | String identifier sent to `updateCodeTable` (e.g. `'ProgramStage'`, `'AdminAreaRegion'`, `'RevisionRules'`) |

**`TransactionType` enum:**

| Value | Name | Description |
|-------|------|-------------|
| `0` | `Create` | Insert a new record |
| `1` | `Update` | Update an existing record (must include `Id`) |
| `2` | `Delete` | Delete a record by `Id` |

```ts
import { updateCodeTable } from '../../Service';

// Create
await updateCodeTable(CODE, 0, JSON.stringify(payload));

// Update
await updateCodeTable(CODE, 1, JSON.stringify({ Id: id, ...fields }));

// Delete
await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
```

After any mutating call, invoke `refetch()` from the appropriate context:

```ts
// For CodeTableContext-backed tables:
const { data: codeTableData, loading, refetch } = useCodeTableContext();

// For AdminAreaContext-backed tables:
const { data, loading, refetch } = useAdminAreaContext();
```

### Revision Tables — Dynamic-Column Pattern

`RevisionCategoryTable`, `RevisionHeaderTable`, `RevisionDocumentTable`, and `RevisionStatusTable` use a **dynamic-column** approach since their schemas are not statically typed:

- Columns derived from `Object.keys(data[0])` on the first row
- `editableColumns = columns.filter(c => c !== 'Id')` — `Id` is always read-only
- Edit mode renders a text `<input>` for each editable column
- **No Add row** — Edit and Delete only
- Delete uses an inline confirmation row (no `ConfirmDialog`)

---

## RevisionFieldPermissionTable – Field Permission Editor

**CODE:** `'RevisionRules'`

Mutations are persisted via `updateCodeTable`. Only **Update** (`1`) and **Delete** (`2`) are supported (no inline Add row).

| Operation | TransactionType | Payload |
|-----------|----------------|---------|
| Edit | `1` | `{ Id, Reason, RevisionGroupId, ReasonId, PCMA_Status, Package_Status, Field: JSON.stringify(fieldRules) }` |
| Delete | `2` | `{ Id }` |

After each mutation `refetch()` is called to reload `RevisionRules` from the context.
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

Each section shows a summary: `N / total editable · Can Add · Can Delete`

The parsed `FieldRules` structure:
```ts
interface FieldRules {
  ProjectDetailsRules: Record<string, boolean>;
  ComponentCostRules:     { Fields: Record<string, boolean>; CRUD: { Message: string; CanAdd: boolean; CanDelete: boolean } };
  ComponentCostYearRules: { Fields: Record<string, boolean>; CRUD: { Message: string; CanAdd: boolean; CanDelete: boolean } };
  MajorItemOfWorkRules:   { Fields: Record<string, boolean>; CRUD: { Message: string; CanAdd: boolean; CanDelete: boolean } };
  MajorItemLocationRules: { Fields: Record<string, boolean>; CRUD: { Message: string; CanAdd: boolean; CanDelete: boolean } };
  FundingProfileRules:    { Fields: Record<string, boolean>; CRUD: { Message: string; CanAdd: boolean; CanDelete: boolean } };
}
```

**`Toggle` component** (internal): animated indigo/gray switch; `disabled` prop → opacity-50, cursor-not-allowed.

---

## Admin Area Tables

All five tables in `tables/adminArea/` use **`AdminAreaContext`** and follow the standard CRUD pattern.

### Relationship-aware form fields

| Table | Linked parent | Behaviour |
|-------|--------------|-----------|
| `ProvinceTable` | Region | Region `<select>` by `ParticipantId`; auto-fills `RegionName` |
| `CityTable` | Province | Province filter dropdown + Province `<select>` in form; auto-fills `ProvinceName` |
| `LegislativeDistrictTable` | Province | Province filter dropdown + Province `<select>` in form; auto-fills `ProvinceName` |
| `DEOTable` | Province + Region | Province `<select>` (auto-fills `ProvinceName`) + Region `<select>` (auto-fills `RegionName`) |

### CODE constants and pagination

| Table | CODE | Items/page |
|-------|------|-----------|
| RegionTable | `AdminAreaRegion` | 15 |
| ProvinceTable | `AdminAreaProvince` | 15 |
| CityTable | `AdminAreaCity` | 20 |
| LegislativeDistrictTable | `AdminAreaDistrict` | 20 |
| DEOTable | `AdminAreaDEO` | 20 |

### Search fields per table

| Table | Searchable columns |
|-------|--------------------|
| RegionTable | Name, GdbId, ParticipantId |
| ProvinceTable | Name, GdbId, Code, RegionName |
| CityTable | Name, GdbId, Code (province filter is a separate dropdown) |
| LegislativeDistrictTable | Name, GdbId, Code (province filter is a separate dropdown) |
| DEOTable | Name, GdbId, ParticipantId (province filter is a separate dropdown) |

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
   For admin area data, use `useAdminAreaContext` instead. For an entirely new data source, create a new context following the `AdminAreaContext` pattern.

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

| From | To tailwindui components | To CodeTable Service | To Project/Model.d | To dialogs/ | To Context |
|------|--------------------------|----------------------|--------------------|-------------|------------|
| `tables/*/` | `../../../../components/tailwindui/...` | `../../Service` | `../../../Project/Model.d` | `../../dialogs/...` | `../../CodeTableContext` or `../../AdminAreaContext` |
| `Views/CodeTables.tsx` | `../../../components/tailwindui/...` | `../Service` | `../../Project/Model.d` | `../dialogs/...` | `../CodeTableContext` / `../AdminAreaContext` |
| `dialogs/` | `../../../components/tailwindui/...` | – | – | `./...` | – |

---

## UI Conventions

- **Status badges:** `bg-green-50 text-green-700` (active), `bg-red-50 text-red-600` (obsolete/deleted), `bg-gray-100 text-gray-500` (closed)
- **Code/ID badges:** `font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded`
- **Table wrapper:** `overflow-x-auto rounded-lg border border-gray-200`
- **Pagination:** 15 rows/page (default); 20 rows/page for `CityTable`, `LegislativeDistrictTable`, `DEOTable`
- **Search:** Case-insensitive filter on key columns; City/District/DEO also have a parent-entity filter dropdown
- **Add button:** `<Button color="indigo">` at top-right of table header
- **Add row inline:** indigo left-border highlight (`border-l-4 border-indigo-400 bg-indigo-50`); ✓ button opens `ConfirmDialog` in `'add'` mode
- **Edit row inline:** amber left-border highlight (`border-l-4 border-amber-400 bg-amber-50`); ✓ button (amber) opens `ConfirmDialog` in `'edit'` mode
- **Actions:** Edit (`color="zinc"`) and Delete (`color="red"`) per row
- **Toggle switch:** Used in `RevisionFieldPermissionTable` for boolean field permissions — indigo when `true`, gray when `false`, `disabled` (opacity-50) in read-only mode

---

## Changelog

### Session 8 — Admin Areas Group

**New group added to `CodeTables.tsx`**: `admin-areas` with `MapPinIcon`. Group count increased from 6 to 7.

**New `AdminAreaContext.tsx`** — mirrors `CodeTableContext` pattern; fetches `POST CodeTable/GetAdminAreas`; exports `AdminAreaProvider` and `useAdminAreaContext`.

**New `tables/adminArea/` domain** — 5 full CRUD tables:
- `RegionTable` — CODE `AdminAreaRegion`; fields: GdbId, Name, ParticipantId, IslandCode; 15/page
- `ProvinceTable` — CODE `AdminAreaProvince`; fields: GdbId, Name, Code (optional), RegionParticipantId (Region dropdown → auto-fills RegionName); 15/page
- `CityTable` — CODE `AdminAreaCity`; fields: GdbId, Name, Code (optional), ProvinceGdbId (Province dropdown → auto-fills ProvinceName); province filter; 20/page
- `LegislativeDistrictTable` — CODE `AdminAreaDistrict`; same fields/pattern as CityTable; 20/page
- `DEOTable` — CODE `AdminAreaDEO`; fields: GdbId (optional), Name, ParticipantId, ProvinceGdbId (Province dropdown), RegionParticipantId (Region dropdown); 20/page

**New interfaces in `Model.d.ts`**: `AdminAreaRegion`, `AdminAreaProvince`, `AdminAreaCity`, `AdminAreaDistrict`, `AdminAreaDEO`, `AdminAreaData`.

**`Service.ts`**: added `fetchAdminAreas` → `POST CodeTable/GetAdminAreas`.

**`CodeTables.tsx`**: added `AdminAreaProvider` wrapper alongside `CodeTableProvider`; added `MapPinIcon` import.

---

### Session 7 — Refetch-After-CRUD for All Tables (Backend ID Sync)

**Problem:** After Add operations, tables were inserting rows with `Id: Date.now()` (a fake client-side ID). Edit and Delete subsequently failed because the backend never assigned that ID.

**Fix:** Every table now calls `await refetch()` after any successful Add / Edit / Delete instead of manipulating local state. Data always reflects what the backend actually committed.

**Prop-based tables converted to context-based** (previously received `data` / `loading` as props from `ProjectDetailsDropdowns`; now read from `useCodeTableContext()` directly):
- `CategoryTable`, `ThrustTable`, `AgencyTable`, `OriginTable` — removed Props interfaces, replaced with context + `refetch`.

**`ProjectDetailsDropdowns.tsx`** — `TabDef.Component` type changed from `React.ComponentType<{ data?: any[]; loading?: boolean }>` to `React.ComponentType`; removed `activeData` variable; child rendered as `<activeTab.Component />` (no props).

**Context-based tables — `refetch` + `useToast` + `try/catch` added:**
`CostTypeTable`, `FundingAgreementTable`, `FundingSourceTable`, `WorkCategoryTable`, `TypeOfWorkTable`, `InfraTypeTable`.

**Already correct (no change needed):** RegionTable, ProvinceTable, DEOTable, CityTable, LegislativeDistrictTable, ProgramStageTable, ProgramTypeTable, ProgramStatusTable, RevisionCategoryTable, RevisionHeaderTable, RevisionDocumentTable, RevisionStatusTable, ModificationReasonTable, RevisionFieldPermissionTable.

---

### Session 6 — Toast Notifications, CategoryId Fix, CRUD Upgrade for Revision Tables

**`CategoryTable`** — `CategoryId` search crash fixed (was calling `.toLowerCase()` on a `number`); `CategoryId` made read-only in forms (backend auto-assigns); Toast added.

**`FundingAgreementTable`** — action buttons fixed (`color="zinc"` / `color="red"`); Toast added.

**4 revision display tables promoted to full CRUD** (Edit/Delete with `updateCodeTable`, `refetch`, Toast):
- `RevisionCategoryTable` — CODE `RevisionCategory`
- `RevisionHeaderTable` — CODE `RevisionHeader`
- `RevisionDocumentTable` — CODE `RevisionDocument`
- `RevisionStatusTable` — CODE `RevisionStatus`

All 4 use dynamic-column CRUD pattern: `editId`, `editRow: Record<string,string>`, inline text inputs, no Add row, inline delete confirmation.

**`ModificationReasonTable`** — wired to live API: `updateCodeTable(CODE, 1/2, ...)` + `refetch()` + Toast for edit/delete.

**`RevisionFieldPermissionTable`** — Toast added; `await refetch()`.

**3 program tables** (ProgramStage, ProgramType, ProgramStatus) — Toast + `refetch` added to all three CRUD handlers.

**Toast pattern** — all tables now use:
```ts
import { useToast } from '../../../../components/toaster/ToasterContext';
const { showToast } = useToast();

showToast({ type: 'success', message: 'Record updated.' });
showToast({ type: 'error',   message: 'Failed to update record.' });
```

---

### Session 5 — CodeTableContext Full Migration + Programs Group

**Dropped `getProjectEnums()`** — `ProjectDetailsDropdowns.tsx` simplified from 10 tabs to 4 CodeTableContext-only tabs (Category, Thrust, Agency, Origin).

**New `programs/` domain** — 3 CRUD tables: `ProgramStageTable`, `ProgramTypeTable`, `ProgramStatusTable`.

**New `FundingAgreementTable`** — AgreementEnum CRUD, CODE `FundingAgreement`.

**4 new revision display tables** (dynamic columns): `RevisionCategoryTable`, `RevisionHeaderTable`, `RevisionDocumentTable`, `RevisionStatusTable`.

**`ModificationReasonTable`** — full rewrite to match actual `Reasons` JSON shape; data source changed from `fetchRevisionReasons` to `CodeTableContext.Reasons`.

**`RevisionFieldPermissionTable`** — complete rewrite: removed `Category` column, fixed field names (`PCMA_Status`, `Package_Status`), replaced raw JSON with `FieldRulesEditor` toggle UI; data source changed to `CodeTableContext.RevisionRules`.

**`Model.d.ts`**: `ModificationCategoryReason` and `RevisionRules` updated to match API; `ProgramEnums` added; `CodeTableData` extended.