# Global Search — Implementation Log

> **Purpose:** This file tracks every decision, change, and TODO for the Global Search feature.  
> Update this file whenever you add a table, change the UI, or touch the backend.

---

## Architecture Overview

### Approach: Config-Driven, Whitelist-Secured

The search is configured entirely through two in sync files:

| File | Role |
|------|------|
| `WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs` | Whitelist of allowed tables + columns, search endpoint |
| `FE/src/pages/GlobalSearch/config.ts` | Result columns to display + navigation links per table |

**Why config-driven?**  
With many pages and tables, hardcoding search logic per page would be unmaintainable. Instead, adding a new searchable table requires editing exactly two files.

---

## User Flow

```
Click 🔍 in navbar
  → GlobalSearchDialog opens (modal overlay)
    → Select Table (dropdown)
      → Column dropdown auto-populates via GET /api/GlobalSearch/GetColumns
        → Enter Value
          → Click Search
            → Results table appears with View buttons
              → Click View → navigates to detail page & dialog closes
```

---

## Backend

### File
`WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs`

### Endpoints

| Method | Route | Body | Returns |
|--------|-------|------|---------|
| POST | `/api/GlobalSearch/GetTables` | _(empty)_ | `[{ Key, Label }]` |
| POST | `/api/GlobalSearch/GetColumns` | `{ TableKey }` | `[{ Field, Label }]` |
| POST | `/api/GlobalSearch/Search` | `{ TableKey, ColumnField, Value }` | `{ Total, Data[] }` |

### Security
- **SQL Injection prevention:** Table names and column names are *never* taken directly from user input.  
  Both are validated against `AllowedTableSqlNames` and `AllowedColumns` dictionaries before being used in the SQL string.
- The search `Value` is always passed as a Dapper `@Value` parameter — fully parameterized.
- Results capped at **TOP 50** per query.

---

## Frontend

### Files Created

| File | Purpose |
|------|---------|
| `FE/src/pages/GlobalSearch/Model.d.ts` | TypeScript interfaces (`SearchableTable`, `SearchableColumn`, `GlobalSearchRequest`, `GlobalSearchResponse`) |
| `FE/src/pages/GlobalSearch/Service.ts` | `getSearchColumns(tableKey)`, `globalSearch(req)` |
| `FE/src/pages/GlobalSearch/config.ts` | `SEARCH_TABLE_CONFIG` — defines result columns & navigation links per table |
| `FE/src/components/GlobalSearch/GlobalSearchDialog.tsx` | The dialog UI component |

### Files Modified

| File | Change |
|------|--------|
| `FE/src/layouts/AppNavbar.tsx` | Added `useState` for dialog open state; wired `MagnifyingGlassIcon` click to open dialog; rendered `<GlobalSearchDialog>` |

---

## Searchable Tables (as of initial implementation)

| Table Key | Label | Navigate to |
|-----------|-------|-------------|
| `vProjects` | Projects | `/projects/project-details/:projectId` |
| `vPrograms` | Programs | `/programs/programdetails/:programId` |
| `vProjectGroups` | Project Groups | `/project-groups/:groupId` |
| `vUsers` | Users | *(no link — view-only)* |
| `vRevisionLists` | Revisions | `/revision/view/Revision/:transactionId` |

---

## How to Add a New Searchable Table

### Step 1 — Backend (`GlobalSearchController.cs`)

1. Add to `AllowedTableSqlNames`:
   ```csharp
   { "vMyNewView", "vMyNewView" },
   ```
2. Add to `TableLabels`:
   ```csharp
   { "vMyNewView", "My New View" },
   ```
3. Add to `AllowedColumns`:
   ```csharp
   {
       "vMyNewView", new()
       {
           ("ColumnName", "Display Label"),
           // ...
       }
   },
   ```

### Step 2 — Frontend (`config.ts`)

Add a new entry to `SEARCH_TABLE_CONFIG`:
```ts
{
  key: 'vMyNewView',
  label: 'My New View',
  resultColumns: [
    { field: 'ColumnName', label: 'Display Label' },
    // ...
  ],
  getLink: (row) => row['PrimaryKeyField']
    ? `/my-page/${row['PrimaryKeyField']}`
    : null,
},
```

That's all. No other files need to change.

---

## How to Add a New Column to an Existing Table

### Backend
Add the column to the relevant list in `AllowedColumns`:
```csharp
("NewColumn", "New Column Label"),
```

### Frontend
Add the column to `resultColumns` in the matching entry in `SEARCH_TABLE_CONFIG` if you also want it shown in results:
```ts
{ field: 'NewColumn', label: 'New Column Label' },
```

---

## Known Limitations & Future Improvements

| Item | Notes |
|------|-------|
| Results capped at 50 | By design. Add pagination if needed. |
| No multi-column search | Current design: one column at a time. |
| No date-range search | Values are always `LIKE %value%`. Date filtering would need a new control. |
| `vUsers` has no navigate link | Could be linked to `/user-management` with a filter pre-applied. |
| Column dropdown fetches from API | Could be made fully static (from `config.ts`) to reduce API calls — trade-off is less flexibility. |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-16 | Copilot | Initial implementation: backend controller, frontend config/service/dialog, navbar wired up |
