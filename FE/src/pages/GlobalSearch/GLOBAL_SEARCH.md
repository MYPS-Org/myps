# Global Search — Implementation Log

> **Purpose:** This file tracks every decision, change, and TODO for the Global Search feature.  
> Update this file whenever you add a search field, change the UI, or touch the backend.

---

## Architecture Overview

### Approach: Backend-Driven Categories, Whitelist-Secured

The search is driven by the backend for category options, with the controller enforcing security:

| File | Role |
|------|------|
| `WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs` | `GetSearchCategory` endpoint returning `CategoryOption[]`; `Search` endpoint; whitelist of allowed tables/columns |
| `FE/src/pages/GlobalSearch/Model.d.ts` | TypeScript interfaces — `CategoryOption` (`Id`, `CategoryName`), `GlobalSearchResponse` (`Data`, `Title`) |
| `FE/src/pages/GlobalSearch/Service.ts` | `fetchCategory()` — loads `CategoryOption[]` from backend; `globalSearch(Category, SearchFor)` — executes search |
| `FE/src/pages/GlobalSearch/config.ts` | `SEARCH_FIELD_CONFIG` — flat field config array, **used by the dialog** to render result columns |
| `FE/src/pages/GlobalSearch/GlobalSearchDialog.tsx` | The dialog UI — dropdown from `CategoryOption[]`; result columns looked up from `SEARCH_FIELD_CONFIG` by matching `label` to `CategoryName`; `CATEGORY_NAV` map resolves View links |

**Why backend-driven categories?**  
The "Search By" dropdown is populated by calling `GetSearchCategory` when the dialog opens, returning `{ CategoryList: CategoryOption[] }` from the server. This means categories can be managed server-side without frontend deploys. Result *columns*, however, are frontend-controlled: the dialog finds the `SEARCH_FIELD_CONFIG` entry whose `label` matches the selected `CategoryName` and renders exactly that entry's `resultColumns` (field + display label), instead of showing every property the backend row happens to have. Navigation links are resolved client-side via the `CATEGORY_NAV` map in `GlobalSearchDialog.tsx`.

> **`config.ts` status:** `SEARCH_FIELD_CONFIG` **is imported and used** by `GlobalSearchDialog.tsx` — it is the single source of truth for which columns render and how they're labeled/ordered per category. The "Search By" dropdown itself remains backend-driven (`CategoryOption[]`); only the *columns shown for a selected category* are static. Because of this, adding a new backend category now requires a matching `SEARCH_FIELD_CONFIG` entry (see "How to Add a New Searchable Field" below) — it's no longer optional/reference-only.

---

## User Flow

```
Click 🔍 in navbar
  → GlobalSearchDialog opens (modal overlay)
    → fetchCategory() called → res.Data.CategoryList populated → "Search By" dropdown filled
      → Select a category (e.g. "Project ID", "UACS", "Bridge")
        → Enter search value
          → Click Search
            → Results table appears with columns from the matching SEARCH_FIELD_CONFIG entry's resultColumns
              → Click View → navigates to the detail page & dialog closes (for navigable categories)
```

> The dropdown is populated via `fetchCategory()` on dialog open — categories come from `res.Data.CategoryList`, not a hardcoded config.  
> Navigation URLs are resolved by `CATEGORY_NAV` in `GlobalSearchDialog.tsx` using `ProjectId:StageName` for project categories.  
> On dialog close, all state (categories, selected category, search value, results) is reset.

---

## Backend

### File
`WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs`

### Endpoints

| Method | Route | Body | Returns |
|--------|-------|------|---------|
| POST | `/GlobalSearch/GetSearchCategory` | *(empty)* | `{ CategoryList: CategoryOption[] }` |
| POST | `/GlobalSearch/Search` | `{ Category, SearchFor }` | `GlobalSearchResponse: { Data: Record[], Title: string }` |

> `GetTables` and `GetColumns` endpoints are no longer called by the frontend (`getSearchColumns` in Service.ts is legacy). They may remain on the backend or be removed.

### Security
- **SQL Injection prevention:** `TableKey` and `ColumnField` from the request are *never* interpolated directly into SQL.  
  Both are validated against `AllowedTableSqlNames` and `AllowedColumns` dictionaries before use.
- The search `Value` is always passed as a Dapper `@Value` parameter — fully parameterized.
- Results capped at **TOP 50** per query. When exactly 50 results are returned, the UI shows an amber hint: "capped at 50 — refine your search".

---

## Frontend

### Key Files

| File | Purpose |
|------|---------|
| `FE/src/pages/GlobalSearch/Model.d.ts` | TypeScript interfaces — `CategoryOption`, `GlobalSearchResponse`; also contains legacy `SearchableTable` / `SearchableColumn` (unused) |
| `FE/src/pages/GlobalSearch/Service.ts` | `fetchCategory()` — loads categories; `globalSearch(Category, SearchFor)` — executes search; also contains legacy `getSearchColumns` (unused) |
| `FE/src/pages/GlobalSearch/config.ts` | `SEARCH_FIELD_CONFIG` — imported by the dialog; drives result columns |
| `FE/src/pages/GlobalSearch/GlobalSearchDialog.tsx` | The dialog UI — dropdown from `CategoryOption[]`; result columns from `SEARCH_FIELD_CONFIG`; `CATEGORY_NAV` map resolves View links |

### Files Modified

| File | Change |
|------|--------|
| `FE/src/layouts/AppNavbar.tsx` | Added `useState` for dialog open state; wired `MagnifyingGlassIcon` click to open dialog; rendered `<GlobalSearchDialog>` |

### `SearchFieldConfig` interface (`config.ts`)

> This interface and its `SEARCH_FIELD_CONFIG` array are imported by `GlobalSearchDialog.tsx` and drive the results table's columns/labels for the selected category, in addition to serving as the backend whitelist guide.

```ts
interface SearchFieldConfig {
  key: string;           // unique internal key
  label: string;         // shown in "Search By" dropdown (matches CategoryName from backend)
  tableKey: string;      // backend: which view/table to query (must be whitelisted)
  columnField: string;   // backend: which column to search against (must be whitelisted)
  placeholder?: string;  // hint shown in the value input
  resultColumns: { field: string; label: string }[];
  getLink: ((row: Record<string, unknown>) => string | null) | null;
}
```

---

## Navigation Config (`CATEGORY_NAV`)

Defined in `GlobalSearchDialog.tsx`. Maps `CategoryName` → a function that builds a URL from a result row. Categories not listed here (or where the nav function returns `null`) show no View button.

| Category Name | URL Pattern |
|---------------|-------------|
| `Project ID` | `/projects/project-details/{ProjectId}:{StageName}` |
| `Alternate ID` | `/projects/project-details/{ProjectId}:{StageName}` |
| `Description` | `/projects/project-details/{ProjectId}:{StageName}` |
| `UACS` | `/projects/project-details/{ProjectId}:{StageName}` |
| `Program Name` | `/programs/programdetails/{ProgramPK}:{StageName}` |
| `Roads` | *(not in CATEGORY_NAV — no View button)* |
| `Road Section` | *(not in CATEGORY_NAV — no View button)* |
| `Bridge` | *(not in CATEGORY_NAV — no View button)* |

> If both `ProjectId` and `StageName` are present the URL is `/projects/project-details/{ProjectId}:{StageName}`. Navigation is performed via React Router `useNavigate`; the dialog closes immediately on navigate.

To add navigation for a new category, add an entry to `CATEGORY_NAV` in `GlobalSearchDialog.tsx`.

---

## Searchable Fields (current — from `config.ts`, live)

| Key | Label | `tableKey` (config) | `columnField` | Navigate to |
|-----|-------|---------------------|---------------|-------------|
| `projectId` | Project ID | `Projects` | `ProjectId` | `/projects/project-details/:ProjectId::StageName` |
| `alternateId` | Alternate ID | `Projects` | `AlternateId` | `/projects/project-details/:ProjectId::StageName` |
| `description` | Description | `Projects` | `Description` | `/projects/project-details/:ProjectId::StageName` |
| `uacs` | UACS | `Projects` | `UACS` | `/projects/project-details/:ProjectId::StageName` |
| `programName` | Program Name | `Programs` | `Name` | `/programs/programdetails/:ProgramPK` |
| `roads` | Roads | `vRoads` | `RoadName` | *(no link — pending)* |
| `roadSection` | Road Section | `vRoadSections` | `RoadSectionId` | *(no link — pending)* |
| `bridge` | Bridge | `vBridges` | `BridgeName` | *(no link — pending)* |

> `vRoads`, `vRoadSections`, and `vBridges` need to be whitelisted in `GlobalSearchController.cs` when the backend views are ready.  
> Note: `tableKey` values for project and program entries use no `v` prefix (`'Projects'`, `'Programs'`), unlike the infrastructure entries which do use it (`'vRoads'`, `'vRoadSections'`, `'vBridges'`).

---

## Result Columns per Category (from `config.ts`, live)

The dialog renders exactly these columns (in this order, with these labels) for each category — not whatever the API row happens to contain:

| Category | Expected columns |
|----------|-----------------|
| Project ID | `ProjectId`, `Description`, `ProgramName`, `StageName`, `Region` |
| Alternate ID | `ProjectId`, `AlternateId`, `Description`, `StageName`, `Region` |
| Description | `ProjectId`, `Description`, `ProgramName`, `StageName`, `Region` |
| UACS | `ProjectId`, `UACS`, `Description`, `StageName`, `Region` |
| Program Name | `ProgramId`, `Name`, `StageName`, `YearStart`, `Status` |
| Roads | `RoadId`, `RoadName`, `Region`, `Length` |
| Road Section | `RoadSectionId`, `RoadName`, `Region`, `RoadLength` |
| Bridge | `BridgeId`, `BridgeName`, `Region`, `Length` |

---

## Service Functions (`Service.ts`)

| Function | Endpoint | Status | Notes |
|----------|----------|--------|-------|
| `fetchCategory()` | `POST /GlobalSearch/GetSearchCategory` | **Active** | Response shape: `res.Data.CategoryList: CategoryOption[]` |
| `globalSearch(Category, SearchFor)` | `POST /GlobalSearch/Search` | **Active** | Returns `GlobalSearchResponse: { Data, Title }` |
| `getSearchColumns(tableKey)` | `POST /GlobalSearch/GetColumns` | **Legacy / unused** | Not called by dialog; may be removed |

---

## TypeScript Interfaces (`Model.d.ts`)

| Interface | Status | Notes |
|-----------|--------|-------|
| `CategoryOption` | **Active** | `{ Id: number; CategoryName: string }` — populated via `fetchCategory()` |
| `GlobalSearchResponse` | **Active** | `{ Data: Record<string, unknown>[]; Title: string }` — result of a search |
| `GlobalSearchRequest` | **Reference** | `{ Category: string; SearchFor: string }` — shape sent to Search endpoint |
| `SearchableTable` | **Legacy / unused** | Leftover from earlier table-dropdown approach |
| `SearchableColumn` | **Legacy / unused** | Used only by the legacy `getSearchColumns` function |

---

## How to Add a New Searchable Field

Adding a new searchable field requires a backend whitelist change **and** a matching `config.ts` entry — the dialog no longer infers columns from the API response.

### Step 1 — Backend (`GlobalSearchController.cs`)

Ensure the table and column are whitelisted:

1. Add to `AllowedTableSqlNames`:
   ```csharp
   { "vMyNewView", "vMyNewView" },
   ```
2. Add to `AllowedColumns`:
   ```csharp
   {
       "vMyNewView", new()
       {
           ("ColumnName", "Display Label"),
       }
   },
   ```
3. Add a new `CategoryOption` row to the `GetSearchCategory` result set (e.g. insert into the source table/view).

### Step 2 — Navigation (optional)

If the new category should navigate to a detail page, add an entry to `CATEGORY_NAV` in `GlobalSearchDialog.tsx`:
```ts
'My Category Name': (row) =>
  row['MyPrimaryKey'] ? `/my-page/${row['MyPrimaryKey']}` : null,
```

### Step 3 — Add a `config.ts` entry (required)

Add a corresponding entry to `SEARCH_FIELD_CONFIG` in `config.ts`. Its `label` must exactly match the `CategoryName` string returned by the backend for this category — the dialog looks up `resultColumns` by that match, so a mismatch means the results table renders with no columns:
```ts
{
  key: 'myField',
  label: 'My Category Name',
  tableKey: 'vMyNewView',
  columnField: 'ColumnName',
  placeholder: 'e.g. some example value',
  resultColumns: [
    { field: 'MyPrimaryKey', label: 'ID' },
    { field: 'ColumnName',   label: 'Display Label' },
  ],
  getLink: (row) => row['MyPrimaryKey'] ? `/my-page/${row['MyPrimaryKey']}` : null,
},
```

> If this step is skipped, the category still appears in the dropdown (it comes from the backend) but its results table renders with zero columns, since no `resultColumns` can be found for it.

---

## Known Limitations & Future Improvements

| Item | Notes |
|------|-------|
| Results capped at 50 | By design. UI shows amber hint when limit is hit. Add pagination if needed. |
| No multi-field search | Current design: one field at a time. |
| No date-range search | Values are always `LIKE %value%`. Date filtering would need a new control. |
| Roads / Road Section / Bridge | Backend views not yet whitelisted — View buttons not shown. |
| `getSearchColumns` / `SearchableTable` / `SearchableColumn` | Legacy code — safe to remove if the GetColumns endpoint is also removed from the backend. |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-16 | Copilot | Initial implementation: backend controller, frontend config/service/dialog, navbar wired up |
| 2026-03-21 | Copilot | Revamped UI — replaced Table + Column dropdowns with single "Search By" dropdown; switched from `SEARCH_TABLE_CONFIG` to flat `SEARCH_FIELD_CONFIG`; removed `getSearchColumns` API call; added fields: Project ID, Alternate ID, Description, UACS, Program Name, Roads, Road Section, Bridge |
| 2026-03-24 | Copilot | Switched dropdown from hardcoded `SEARCH_FIELD_CONFIG` to backend-driven `CategoryOption[]` via `fetchCategory()`; result columns now derived dynamically from API response (`res.Data.CategoryList`); updated `Service.ts`; `config.ts` retained as reference only |
| 2026-03-24 | Copilot | Added `CATEGORY_NAV` map in `GlobalSearchDialog.tsx`; project categories navigate to `/projects/project-details/{ProjectId}:{StageName}`; Program Name navigates to `/programs/programdetails/{ProgramId}`; View button shown per row only when link resolves; dialog resets all state on close |
| 2026-07-31 | Claude | Added `EXCLUDED_RESULT_COLUMNS` / `isExcludedResultColumn()` to `config.ts` (exact-match list + `PK`/`FKId` suffix rule) and wired it into `GlobalSearchDialog.tsx`'s `dynamicColumns` filter, so internal PK/FK columns (e.g. `StageFKId`, `ProgramPK`) returned by backend view models no longer render in the results table |
| 2026-07-31 | Claude | Replaced dynamic column derivation with `SEARCH_FIELD_CONFIG`-driven columns: `GlobalSearchDialog.tsx` now looks up the entry whose `label` matches the selected `CategoryName` and renders its `resultColumns` directly, instead of deriving/filtering/ordering/labeling columns from the raw API row. Removed the now-unused `EXCLUDED_RESULT_COLUMNS`, `isExcludedResultColumn()`, `getColumnLabel()`, `COLUMN_ORDER_BY_CATEGORY`, `orderResultColumns()` from `config.ts`. `SEARCH_FIELD_CONFIG` is no longer reference-only — adding a category now requires a matching entry (see "How to Add a New Searchable Field") |
| 2026-08-11 | Claude | Fixed `Program Name` navigation to use `ProgramPK` instead of `ProgramId` in the URL (`GlobalSearchDialog.tsx`'s `CATEGORY_NAV` and `config.ts`'s reference `getLink`). `ProgramDetail.tsx`'s `:program` route param is resolved via `ProgramPK` everywhere else in the app (`Program.tsx`, `AddProgramDialog.tsx`); `ProgramId` is a separate display code and was producing a route the backend couldn't resolve |