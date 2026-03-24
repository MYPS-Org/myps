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
| `FE/src/pages/GlobalSearch/Model.d.ts` | TypeScript interfaces — `CategoryOption` (`Id`, `CategoryName`), `GlobalSearchResponse` |
| `FE/src/pages/GlobalSearch/Service.ts` | `fetchCategory()` — loads `CategoryOption[]` from backend; `globalSearch(Category, SearchFor)` — executes search |

**Why backend-driven categories?**  
The "Search By" dropdown is populated by calling `GetSearchCategory` when the dialog opens, returning `CategoryOption[]` from the server. This means categories can be managed server-side without frontend deploys. Result columns are derived dynamically from the API response data. Navigation links are resolved client-side via the `CATEGORY_NAV` map in `GlobalSearchDialog.tsx`.

---

## User Flow

```
Click 🔍 in navbar
  → GlobalSearchDialog opens (modal overlay)
    → fetchCategory() called → "Search By" dropdown populated from backend CategoryOption[]
      → Select a category (e.g. "Project ID", "UACS", "Bridge")
        → Enter search value
          → Click Search
            → Results table appears with columns derived dynamically from response data
              → Click View → navigates to the detail page & dialog closes (for navigable categories)
```

> The dropdown is populated via `fetchCategory()` on dialog open — categories come from the backend, not a hardcoded config.  
> Navigation URLs are resolved by `CATEGORY_NAV` in `GlobalSearchDialog.tsx` using `ProjectId:StageName` for project categories.

---

## Backend

### File
`WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs`

### Endpoints

| Method | Route | Body | Returns |
|--------|-------|------|---------|
| POST | `/api/GlobalSearch/GetSearchCategory` | *(empty)* | `CategoryOption[]` (`Id`, `CategoryName`) |
| POST | `/api/GlobalSearch/Search` | `{ Category, SearchFor }` | `{ Total, Data[] }` |

> `GetTables` and `GetColumns` endpoints are no longer called by the frontend. They may remain on the backend or be removed.

### Security
- **SQL Injection prevention:** `TableKey` and `ColumnField` from the request are *never* interpolated directly into SQL.  
  Both are validated against `AllowedTableSqlNames` and `AllowedColumns` dictionaries before use.
- The search `Value` is always passed as a Dapper `@Value` parameter — fully parameterized.
- Results capped at **TOP 50** per query.

---

## Frontend

### Key Files

| File | Purpose |
|------|---------|
| `FE/src/pages/GlobalSearch/Model.d.ts` | TypeScript interfaces — `CategoryOption`, `GlobalSearchResponse` |
| `FE/src/pages/GlobalSearch/Service.ts` | `fetchCategory()` — loads categories; `globalSearch(Category, SearchFor)` — executes search |
| `FE/src/components/GlobalSearch/GlobalSearchDialog.tsx` | The dialog UI — dropdown from `CategoryOption[]`; result columns dynamic; `CATEGORY_NAV` map resolves View links |

### Files Modified

| File | Change |
|------|--------|
| `FE/src/layouts/AppNavbar.tsx` | Added `useState` for dialog open state; wired `MagnifyingGlassIcon` click to open dialog; rendered `<GlobalSearchDialog>` |

### `SearchFieldConfig` interface (`config.ts`)

```ts
interface SearchFieldConfig {
  key: string;           // unique internal key
  label: string;         // shown in "Search By" dropdown
  tableKey: string;      // backend: which view/table to query
  columnField: string;   // backend: which column to search against
  placeholder?: string;  // hint shown in the value input
  resultColumns: { field: string; label: string }[];
  getLink: ((row: Record<string, unknown>) => string | null) | null;
}
```

---

## Navigation Config (`CATEGORY_NAV`)

Defined in `GlobalSearchDialog.tsx`. Maps `CategoryName` → a function that builds a URL from a result row. Categories not listed here show no View button.

| Category Name | URL Pattern |
|---------------|-------------|
| Project ID | `/projects/project-details/{ProjectId}:{StageName}` |
| Alternate ID | `/projects/project-details/{ProjectId}:{StageName}` |
| Description | `/projects/project-details/{ProjectId}:{StageName}` |
| UACS | `/projects/project-details/{ProjectId}:{StageName}` |
| Program Name | `/programs/programdetails/{ProgramId}` |
| Roads | *(no link — pending)* |
| Road Sections | *(no link — pending)* |
| Bridge | *(no link — pending)* |

To add navigation for a new category, add an entry to `CATEGORY_NAV` in `GlobalSearchDialog.tsx`.

---

## Searchable Fields (current)

| Key | Label | Backend Table | Column | Navigate to |
|-----|-------|--------------|--------|-------------|
| `projectId` | Project ID | `vProjects` | `ProjectId` | `/projects/project-details/:id` |
| `alternateId` | Alternate ID | `vProjects` | `AlternateId` | `/projects/project-details/:id` |
| `description` | Description | `vProjects` | `Description` | `/projects/project-details/:id` |
| `uacs` | UACS | `vProjects` | `UACS` | `/projects/project-details/:id` |
| `programName` | Program Name | `vPrograms` | `Name` | `/programs/programdetails/:id` |
| `roads` | Roads | `vRoads` | `RoadName` | *(no link — pending)* |
| `roadSection` | Road Section | `vRoadSections` | `RoadSectionId` | *(no link — pending)* |
| `bridge` | Bridge | `vBridges` | `BridgeName` | *(no link — pending)* |

> `vRoads`, `vRoadSections`, and `vBridges` need to be whitelisted in `GlobalSearchController.cs` when the backend views are ready.

---

## How to Add a New Searchable Field

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

### Step 2 — Frontend (`config.ts`)

Add a new entry to `SEARCH_FIELD_CONFIG`:
```ts
{
  key: 'myField',
  label: 'My Field Label',
  tableKey: 'vMyNewView',
  columnField: 'ColumnName',
  placeholder: 'e.g. some example value',
  resultColumns: [
    { field: 'PrimaryKey', label: 'ID' },
    { field: 'ColumnName', label: 'Display Label' },
  ],
  getLink: (row) => row['PrimaryKey']
    ? `/my-page/${row['PrimaryKey']}`
    : null,
},
```

That's all. No other files need to change.

---

## Known Limitations & Future Improvements

| Item | Notes |
|------|-------|
| Results capped at 50 | By design. Add pagination if needed. |
| No multi-field search | Current design: one field at a time. |
| No date-range search | Values are always `LIKE %value%`. Date filtering would need a new control. |
| Roads / Road Section / Bridge | Backend views not yet whitelisted — links return `null` for now. |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-16 | Copilot | Initial implementation: backend controller, frontend config/service/dialog, navbar wired up |
| 2026-03-21 | Copilot | Revamped UI — replaced Table + Column dropdowns with single "Search By" dropdown; switched from `SEARCH_TABLE_CONFIG` to flat `SEARCH_FIELD_CONFIG`; removed `getSearchColumns` API call; added fields: Project ID, Alternate ID, Description, UACS, Program Name, Roads, Road Section, Bridge |
| 2026-03-24 | Copilot | Switched dropdown from hardcoded `SEARCH_FIELD_CONFIG` to backend-driven `CategoryOption[]` via `fetchCategory()`; result columns now derived dynamically from API response; updated `Service.ts` type annotation to `CategoryOption[]`; removed config-driven `resultColumns` and `getLink` |
| 2026-03-24 | Copilot | Added `CATEGORY_NAV` map in `GlobalSearchDialog.tsx`; project categories (Project ID, Alternate ID, Description, UACS) navigate to `/projects/project-details/{ProjectId}:{StageName}`; Program Name navigates to `/programs/programdetails/{ProgramId}`; View button shown per row only when link resolves |
