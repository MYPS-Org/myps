# Global Search — Implementation Log

> **Purpose:** This file tracks every decision, change, and TODO for the Global Search feature.  
> Update this file whenever you add a search field, change the UI, or touch the backend.

---

## Architecture Overview

### Approach: Config-Driven, Whitelist-Secured

The search is configured entirely through two in-sync files:

| File | Role |
|------|------|
| `WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs` | Whitelist of allowed tables + columns, search endpoint |
| `FE/src/pages/GlobalSearch/config.ts` | Flat list of searchable fields — each carries its own `tableKey`, `columnField`, result columns, and nav link |

**Why flat field config?**  
The client wants a simple "Search By" experience — a single dropdown listing specific fields (e.g. "Project ID", "UACS", "Bridge") rather than a SQL-like Table → Column two-step. Each entry in `SEARCH_FIELD_CONFIG` encapsulates everything needed for one searchable field, keeping the UI and backend calls simple.

---

## User Flow

```
Click 🔍 in navbar
  → GlobalSearchDialog opens (modal overlay)
    → Select a field from "Search By" dropdown (e.g. "Project ID", "UACS", "Bridge")
      → Enter search value (placeholder updates to show an example)
        → Click Search
          → Results table appears with View buttons
            → Click View → navigates to detail page & dialog closes
```

> No API call is made to populate the dropdown — fields are hardcoded in `config.ts`.

---

## Backend

### File
`WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs`

### Endpoints

| Method | Route | Body | Returns |
|--------|-------|------|---------|
| POST | `/api/GlobalSearch/Search` | `{ TableKey, ColumnField, Value }` | `{ Total, Data[] }` |

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
| `FE/src/pages/GlobalSearch/Model.d.ts` | TypeScript interfaces (`GlobalSearchRequest`, `GlobalSearchResponse`) |
| `FE/src/pages/GlobalSearch/Service.ts` | `globalSearch(req)` — posts to `/api/GlobalSearch/Search` |
| `FE/src/pages/GlobalSearch/config.ts` | `SEARCH_FIELD_CONFIG` — flat array of `SearchFieldConfig` entries |
| `FE/src/components/GlobalSearch/GlobalSearchDialog.tsx` | The dialog UI — single "Search By" dropdown |

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
