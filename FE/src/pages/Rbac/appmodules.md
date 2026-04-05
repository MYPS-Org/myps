# App Modules — RBAC Feature

## Overview

The **App Modules** tab in the RBAC (Role-Based Access Control) page provides full CRUD management for application modules. Each module groups related API controllers and frontend route views together.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/UserManagement/ShowAppModules` | Paginated list with optional filters |
| POST | `/api/UserManagement/AddAppModule` | Create a new module |
| POST | `/api/UserManagement/UpdateAppModule` | Update an existing module |
| POST | `/api/UserManagement/DeleteAppModule` | Delete a module |

### Request Payload — ShowAppModules
```json
{
  "Filters": { "ModuleName": "string" },
  "limit": 0,
  "page": 0,
  "SortField": "string",
  "sortDirection": 0
}
```

### Request Payload — Add / Update / Delete
```json
{
  "Id": 0,
  "ModuleName": "string",
  "Description": "string",
  "ControllerCount": 0,
  "ViewCount": 0,
  "Controllers": "string",
  "Views": "string"
}
```

> `Controllers` and `Views` are stored as **stringified JSON arrays** — `[{"ControllerName":"...","Linked":false}]` and `[{"RouteName":"...","Linked":false}]` respectively. `ControllerCount` / `ViewCount` are derived from the count of items where `Linked === true`.

---

## Model

Defined in `Model.d.ts`:

```ts
export interface AppModules {
    Id: number;
    ModuleName: string;
    Description?: string;
    ControllerCount?: number;
    ViewCount?: number;
    Controllers?: string;   // stringified JSON: [{ControllerName: string, Linked: boolean}]
    Views?: string;         // stringified JSON: [{RouteName: string, Linked: boolean}]
}

export interface ShowAppModulesPagination extends PaginationParams {
    filters?: AppModuleFilter;
    sortField?: string;
    sortDirection?: 0 | 1;
}

export interface AppModuleFilter {
    ModuleName?: string;
}
```

---

## Service Functions

Defined in `service.ts`:

| Function | API Call |
|----------|----------|
| `getAppModules(data)` | `ShowAppModules` |
| `addAppModule(data)` | `AddAppModule` |
| `updateAppModule(data)` | `UpdateAppModule` |
| `deleteAppModule(data)` | `DeleteAppModule` |

---

## Files Changed / Added

### Modified Files
| File | Change |
|------|--------|
| `Model.d.ts` | Added `Controllers` and `Views` fields to `AppModules` |
| `service.ts` | Added `addAppModule`, `updateAppModule`, `deleteAppModule`, `callSyncViewPermissions` |
| `components/AppModuleTab.tsx` | Fully rewritten with inline row editing, `ModuleLinksEditor` toggle panel, and Sync API / Sync Routes buttons |
| `useRbac.ts` | Removed `permissions` and `routePermissions` tab state, handlers, and `DefaultModelKey` entries; `setModulesData` passed as `onDataChange` prop |
| `Rbac.tsx` | Removed API Permissions and Route Permissions tabs, their content blocks, and all permission-related dialogs |

## Sync Buttons

Two sync buttons are embedded in the `AppModuleTab` header. They are self-contained — no props or parent state needed.

| Button | API Endpoint | Description |
|--------|-------------|-------------|
| **Sync API** | `POST /api/UserManagement/SyncAPIPermissions` | Discovers all controllers/actions via reflection and upserts into `tPermissionControllers` / `tPermissionActions` |
| **Sync Routes** | `POST /api/UserManagement/SyncViewPermissions` | Sends the frontend `protectedRoutes` array (with `RouteName` + `path`, no `element`) as `RoutesAvailable` payload to upsert into `tPermissionViews` |

### Sync implementation notes
- Both buttons are disabled while a save/edit is in progress (`editId !== null`) or while the respective sync is running
- Success/error feedback is shown inline in the header via a `syncMessage` state (`{ text, type: 'success' | 'error' }`)
- Routes payload is built from `protectedRoutes` in `components/Routes.tsx`, mapping each entry to `{ RouteName, path }` (element is stripped)
- The `SyncViewPermissions` DTO payload shape: `{ RoutesAvailable: [{ RouteName?: string, path: string }] }`

### Removed tabs
The **API Permissions** and **Route Permissions** tabs have been removed from the RBAC page. Those views were static (no CRUD needed). The sync operations that previously lived on the API Permissions tab have been moved here.

---


All CRUD operations are handled directly inside `AppModuleTab.tsx` — no separate dialogs.

### Add Module
- Click **Add Module** button in the header to insert a blank amber-highlighted row at the top of the table
- Fill in **Module Name** (required) and **Description**; a linked toggle panel appears below the row for Controllers & Views
- Confirm with ✓ or cancel with ✗
- On success, the new module is prepended to the list and total count is incremented

### View Controllers & Views
- Each row shows `X / Y linked` with a chevron indicator in the Controllers and Views columns
- Clicking anywhere on the row (when not editing) toggles the `ModuleLinksEditor` expand panel
- The Actions cell uses `stopPropagation` so edit/delete buttons do not trigger the row toggle
- Each entry in the panel displays a Toggle switch — **read-only** when just viewing

### Edit Module
- Click the pencil icon to enter edit mode for that row (amber highlight)
- Module Name and Description become inline `<input>` fields
- The `ModuleLinksEditor` panel is automatically expanded and **editable** (Toggle switches active)
- Confirm with ✓ or cancel with ✗
- On success, the row is replaced with updated data

### Delete Module
- Click the trash icon to show an inline `Delete? ✓ ✗` confirmation in the Actions cell
- On confirm, the row is removed and total count is decremented

---

## State Management

All state is local to `AppModuleTab.tsx`:

```ts
editId          // null = none editing, 0 = adding new row, number = editing existing row
editForm        // { ModuleName, Description, controllers: ControllerItem[], views: ViewItem[] }
expandedId      // ID of the row whose toggle panel is expanded (view mode)
deleteConfirmId // ID of the row showing inline delete confirmation
isSaving        // prevents double-submit
error           // inline error message shown in header (for CRUD operations)
isSyncingApi    // true while Sync API call is in-flight
isSyncingViews  // true while Sync Routes call is in-flight
syncMessage     // { text: string, type: 'success' | 'error' } | null — shown in header after a sync
```

`onDataChange` (passed from `Rbac.tsx` as `setModulesData`) is called to perform optimistic updates to the parent pagination state.
