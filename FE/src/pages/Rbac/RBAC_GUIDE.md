# RBAC Page — Developer Reference

Role-Based Access Control page for managing application modules, users, and user groups. Entry point: `FE/src/pages/Rbac/`.

---

## Folder Structure

```
Rbac/
  Rbac.tsx                       # Root component — layout, tab nav, and all dialog mounts
  useRbac.ts                     # Custom hook — all state, filters, loading flags, handlers
  Model.d.ts                     # TypeScript interfaces and types
  service.ts                     # All API call functions
  appmodules.md                  # App Modules feature notes (legacy doc)
  RBAC_GUIDE.md                  # This file
  components/
    AppModuleTab.tsx              # App Modules tab — full inline CRUD + Sync buttons
    UsersTab.tsx                  # Users tab — sortable, filterable, badge expand
    UserGroupsTab.tsx             # User Groups tab — expandable rows with permission breakdown
    ApiPermissionsTab.tsx         # [INACTIVE] API Permissions tab component (not wired in Rbac.tsx)
    RoutePermissionsTab.tsx       # [INACTIVE] Route Permissions tab component (not wired in Rbac.tsx)
  dialogs/
    index.ts                      # Re-exports all dialogs
    AddUserDialog.tsx
    UpdateUserDialog.tsx
    DeleteUserDialog.tsx
    ViewUserDialog.tsx
    AddGroupDialog.tsx
    UpdateGroupDialog.tsx
    DeleteGroupDialog.tsx
    ViewGroupDialog.tsx
    FilterUserDialog.tsx
    FilterUserGroupDialog.tsx
    AddPermissionDialog.tsx       # [INACTIVE] Not wired in Rbac.tsx
    UpdatePermissionDialog.tsx    # [INACTIVE] Not wired in Rbac.tsx
    DeletePermissionDialog.tsx    # [INACTIVE] Not wired in Rbac.tsx
    ViewPermissionDialog.tsx      # [INACTIVE] Not wired in Rbac.tsx
    FilterPermissionDialog.tsx    # [INACTIVE] Not wired in Rbac.tsx
```

> **[INACTIVE]** — These files exist but are not imported or used in the current `Rbac.tsx`. They belong to the old separate API Permissions and Route Permissions tabs, which were removed. Their sync operations are now embedded directly in the App Modules tab header. These files are kept for reference but should not be relied upon.

---

## Active Tabs

| Tab Value | Label | Component | Data Source |
|---|---|---|---|
| `users` | Users | `UsersTab` | `fetchInitialData()` on mount (initial load); `fetchUsers(filter)` on tab switch / sort / filter / paginate |
| `userGroups` | User Groups | `UserGroupsTab` | `fetchUserGroups(filter)` on tab switch / sort / filter / paginate |
| `modules` | App Modules | `AppModuleTable` | `getAppModules(filter)` on tab switch / paginate |

> **Default tab:** `users`. Initial user data is pre-loaded by `fetchInitialData()` on mount — switching to the Users tab does not cause an extra fetch if the data is already present.

> **Tab order in UI:** App Modules | Users | User Groups (left to right).

---

## Initialization Sequence

On component mount, `useRbac` fires **two parallel requests**:

```
Promise.all([
  fetchInitialData(),           // POST /UserManagement/InitUserManagement
  fetchUserGroupDropdowns(),    // POST /UserManagement/ShowUserGroupDropdowns
])
```

- `fetchInitialData` → populates `UsersData` (initial user list) + `tabNumbers` (users count, groups count).
- `fetchUserGroupDropdowns` → populates `userGroupDropdowns` (AppModules, PermissionControllers, PermissionActions, PermissionViews) + builds `permissionViewsLookup` map (`Record<number, string>`: `PermissionView.Id → RouteName || Description || RoutePath`).

The `permissionViewsLookup` is available before any tab is clicked.

---

## `useRbac.ts` — State Hook

### State

| State | Type | Purpose |
|---|---|---|
| `selectedTab` | `DefaultModelKey` | Active tab: `'users' | 'userGroups' | 'modules'` |
| `UsersData` | `PaginationResponse<Users>` | Users list with pagination |
| `ModulesData` | `PaginationResponse<AppModules>` | App modules list with pagination |
| `UserGroupsData` | `PaginationResponse<vUserGroups>` | User groups list with pagination |
| `UserFilter` | `UserPagination` | Current filter+sort+page for users |
| `UserGroupFilter` | `UserGroupPagination` | Current filter+sort+page for user groups |
| `ShowAppModulesFilter` | `ShowAppModulesPagination` | Current filter+sort+page for modules |
| `isLoadingUsers/Modules/UserGroups` | `boolean` | Loading flags (each tab independent) |
| `permissionViewsLookup` | `Record<number, string>` | Id → display name for route permissions |
| `userGroupDropdowns` | `UserGroupDropdowns` | Full dropdown dataset for group editing |
| `tabNumbers` | `{ users, modules, userGroups }` | Badge counts shown on tab buttons |
| `sortDirection` | `0 | 1 | null` | Shared sort indicator state |
| `expandedUserGroups` | `Set<number>` | User IDs whose group badges are expanded |
| Dialog open states | `boolean` | One per dialog: `isAddUserDialogOpen`, `isUpdateUserDialogOpen`, etc. |
| `selectedUserId`, `selectedGroupId` | `number | null` | Row ID for edit/delete/view dialogs |

### Key Handlers

| Handler | Behaviour |
|---|---|
| `getTableData(tabName)` | Sets `selectedTab`, fetches data for that tab. Guards against double-fetch with loading flags. |
| `handleSort(field, direction)` | Maps numeric `field` → sort field name, updates filter, re-fetches. Users: 0=Name, 1=Email, 2=Office, 3=Status. Groups: 0=GroupName. |
| `Paginate(page)` | Updates page in the active tab's filter, re-fetches. |
| `handleAutoRefresh(filterData)` | Re-fetches the active tab with the given filter. Used after dialog submits. Throws on error (caller must handle). |
| `handleClear()` | Resets name/group/status filter fields for active tab, re-fetches. |
| `handleExpand(e, userId)` | Toggles `expandedUserGroups` set for the given user ID. Stops event propagation. |

---

## `service.ts` — API Functions

All calls use `httpClient.post<T>(url, body, options)` from `../../services/httpClient`.

### Active Functions

| Function | Endpoint | Body | Return |
|---|---|---|---|
| `fetchInitialData()` | `POST /UserManagement/InitUserManagement` | `null` | `InitialDataResponse` |
| `fetchUsers(data)` | `POST /UserManagement/ShowUsers` | `UserPagination` | `PaginationResponse<Users>` |
| `addUser(data)` | `POST /UserManagement/AddUser` | `Users` | `Users` |
| `editUser(data)` | `POST /UserManagement/UpdateUser` | `Users` | `Users` |
| `deleteUser(data)` | `POST /UserManagement/DeleteUser` | `Users` | — |
| `fetchUserGroups(data)` | `POST /UserManagement/ShowUserGroups` | `UserGroupPagination` | `PaginationResponse<vUserGroups>` |
| `fetchUserGroupDropdowns()` | `POST /UserManagement/ShowUserGroupDropdowns` | — | `UserGroupDropdowns` |
| `addUserGroup(data)` | `POST /UserManagement/AddUserGroup` | `AddUserGroups` | — |
| `editUserGroup(data)` | `POST /UserManagement/UpdateUserGroup` | `UpdateUserGroupPayload` | — |
| `deleteUserGroup(groupId)` | `POST /UserManagement/DeleteUserGroup?id={groupId}` | *(id as query param, no body)* | — |
| `getAppModules(data)` | `POST /UserManagement/ShowAppModules` | `ShowAppModulesPagination` | `PaginationResponse<AppModules>` |
| `addAppModule(data)` | `POST /UserManagement/AddAppModule` | `AppModules` | `{ Id }` |
| `updateAppModule(data)` | `POST /UserManagement/UpdateAppModule` | `AppModules` | — |
| `deleteAppModule(data)` | `POST /UserManagement/DeleteAppModule` | `AppModules` | — |
| `callSyncPermissions()` | `POST /UserManagement/SyncAPIPermissions` | — | `{ Message }` |
| `callSyncViewPermissions(routes)` | `POST /UserManagement/SyncViewPermissions` | `{ RoutesAvailable: { RouteName?, path }[] }` | `{ Message }` |
| `fetchUserData(data)` | `POST /PIS/SearchUser` | `{ EmployeeId }` | `Users` |

### Legacy / Inactive Functions (still in service.ts, not called from active UI)

| Function | Endpoint |
|---|---|
| `fetchPermissions(data)` | `POST /UserManagement/ShowPermissions` |
| `addPermission(data)` | `POST /UserManagement/AddPermission` |
| `updatePermission(data)` | `POST /UserManagement/UpdatePermission` |
| `deletePermission(data)` | `POST /UserManagement/DeletePermission` |
| `fetchPermissionGroups()` | `POST /UserManagement/ShowPermissionGroups` |
| `getRoutePermissions(data)` | `POST /UserManagement/ShowViewPermissions` |

---

## `Model.d.ts` — Type Reference

### Users

```ts
interface Users {
  Id: number;
  UserGroupIds?: number[];         // Parallel array — matches index with UserGroupNames
  UserGroupNames?: string[];       // Parallel array — matches index with UserGroupIds
  ApplyFilter?: boolean;
  EmployeeId?: string;
  UserId: string;
  Name: string;
  Email?: string;
  RegCode: string;
  RegName?: string;
  PlantillaOffice?: string;
  PlantillaOfficeName?: string;
  IsActive: boolean;
}
```

> The old `UserGroups` comma-separated string field is gone. `UserGroupIds` and `UserGroupNames` are parallel arrays matching the login/session API shape.

### vUserGroups (User Group view model)

```ts
interface vUserGroups {
  Id: number;
  GroupName: string;
  ApplyFilter: boolean;
  NumberOfUsers: number;
  Description?: string;
  CreatedBy: string;
  CreatedDate: string;
  ModulePermissions: ModulePermission[];
  PermissionActionIds?: number[];  // Optional — only kept for locally-constructed fallback objects
  PermissionViewIds?: number[];    // Optional — only kept for locally-constructed fallback objects
}
```

> The API does NOT return flat `PermissionActionIds`/`PermissionViewIds`. Granted permissions are derived at render time from `ModulePermissions[].APIPermissions[].Actions.filter(a => a.IsGranted)` and `ModulePermissions[].ViewAccess.filter(v => v.IsGranted)`.

### Permission Hierarchy

```ts
interface ModulePermission {
  ModuleName: string;
  APIPermissions: UserGroupAPIPermission[];
  ViewAccess: UserGroupViewItem[];
}

interface UserGroupAPIPermission {
  ControllerName: string;
  Actions: UserGroupActionItem[];
  IsGranted: boolean;             // Controller-level grant flag
}

interface UserGroupActionItem {
  Id: number;
  ActionName: string;
  IsGranted: boolean;
}

interface UserGroupViewItem {
  Id: number;
  RouteName: string;
  RoutePath: string;
  IsGranted: boolean;
}
```

### AppModules

```ts
interface AppModules {
  Id: number;
  ModuleName: string;
  Description?: string;
  ControllerCount?: number;        // Count of { Linked: true } items in Controllers JSON
  ViewCount?: number;              // Count of { Linked: true } items in Views JSON
  Controllers?: string;            // Stringified JSON: [{ ControllerName: string, Linked: boolean }]
  Views?: string;                  // Stringified JSON: [{ RouteName: string, Linked: boolean }]
}
```

### Payload Interfaces

```ts
interface AddUserGroups {
  Id?: number;
  GroupName?: string;
  Description?: string;
  ApplyFilter?: boolean;
  PermissionIds: number[];         // Always sent as empty array [] on create (backend ignores it)
}

interface UpdateUserGroupPayload {
  Id: number;
  GroupName: string;
  Description?: string;
  ApplyFilter: boolean;
  PermissionActionIds: number[];   // IDs of granted UserGroupActionItem entries
  PermissionViewIds: number[];     // IDs of granted UserGroupViewItem entries
}
```

### Dropdown / Enum Interfaces

```ts
interface UserGroupDropdowns {
  AppModules: AppModuleDropdown[];
  PermissionControllers: PermissionControllers[];
  PermissionActions: PermissionActions[];
  PermissionViews: PermissionViews[];
}

interface PermissionControllers { Id: number; ModuleName?: string; ControllerName: string; Description?: string; }
interface PermissionActions { Id: number; ControllerName: string; ActionName: string; Description?: string; }
interface PermissionViews { Id: number; RouteName?: string; RoutePath: string; Description?: string; }
```

---

## App Modules Tab (`components/AppModuleTab.tsx`)

### Overview

Self-contained inline CRUD table. No separate dialog — editing happens directly in the table row. Props:

```ts
interface AppModuleTableProps {
  data: PaginationResponse<AppModules>;
  isLoading: boolean;
  onPaginate: (page: number) => void;
  onDataChange: (updater: (prev: PaginationResponse<AppModules>) => PaginationResponse<AppModules>) => void;
}
```

### Internal State

| State | Purpose |
|---|---|
| `editId: number | null` | `null` = none editing; `0` = new add row; `>0` = editing existing row by Id |
| `editForm: EditForm` | `{ ModuleName, Description, controllers: ControllerItem[], views: ViewItem[] }` |
| `expandedId: number | null` | Row whose `ModuleLinksEditor` is expanded (read-only view for non-editing rows) |
| `deleteConfirmId: number | null` | Row awaiting inline delete confirmation |
| `isSaving, isSyncingApi, isSyncingViews` | Loading flags |
| `error: string` | Inline error message shown in header |

### Add Flow

1. Click **Add Module** → `startAdd()` → `editId = 0`, `editForm` pre-filled with template controllers/views from first existing row (all `Linked: false`), new empty row inserted at top of table.
2. User fills `ModuleName` + `Description` (optional), toggles controllers/views in the expanded `ModuleLinksEditor`.
3. Click checkmark → `handleSave()` → `addAppModule(payload)` → response `Id` replaces `Date.now()` fallback → row inserted via `onDataChange`.

### Edit Flow

1. Click pencil icon → `startEdit(item)` → `editId = item.Id`, `editForm` pre-filled from item.
2. Edit fields inline; toggle controllers/views.
3. Click checkmark → `handleSave()` → `updateAppModule(payload)` → row replaced via `onDataChange`.
4. Click X → `cancelEdit()` → restores original row.

### Delete Flow

1. Click trash icon → `deleteConfirmId = item.Id` (shows inline "Confirm / Cancel" in Actions column).
2. Click Confirm → `handleDelete(item)` → `deleteAppModule(item)` → row removed via `onDataChange`.

### `ModuleLinksEditor` Sub-component

Rendered inline (as a second `<tr>`) below the editing row. Two sections: Controllers and Views. Each is collapsible. Each item has:
- Display name (`ControllerName` or `RouteName` in monospace)
- `Toggle` switch (indigo when `Linked = true`, gray when `false`)

In view (non-edit) mode, `onChange` prop is `undefined` → toggles are disabled.

```ts
type ControllerItem = { ControllerName: string; Linked: boolean };
type ViewItem = { RouteName: string; Linked: boolean };
```

### Sync Buttons (in header)

Both are disabled while editing (`editId !== null`).

| Button | Handler | Endpoint | Payload |
|---|---|---|---|
| **Sync API** | `handleSyncApi` | `POST /UserManagement/SyncAPIPermissions` | none |
| **Sync Routes** | `handleSyncViews` | `POST /UserManagement/SyncViewPermissions` | `{ RoutesAvailable: protectedRoutes.map({ RouteName, path }) }` |

`protectedRoutes` is imported from `../../../components/Routes` — it is the application's full protected route registry.

---

## Users Tab (`components/UsersTab.tsx`)

### Props

Receives all handlers from `Rbac.tsx`; no internal data-fetching.

### Columns

| Column | Source | Notes |
|---|---|---|
| User | `Name` (bold), `UserId` (sub-text), `Email` (xs) | Email hidden if blank or whitespace-only (`.trim()` guard) |
| UserGroup | `UserGroupNames[]` | Blue badges; shows first 3, click `+N more` / `Show less` to expand — tracked in `expandedUserGroups` Set in parent |
| Region | `RegName` | Zinc badge; hidden if blank/whitespace |
| Office | `PlantillaOffice` | Blue badge; hidden if blank/whitespace |
| Status | `IsActive` | Green `Active` / Red `Inactive` badge |
| Actions | — | Yellow pencil (edit), Red trash (delete) |

### Filter Indicator

The Filter button shows an orange count badge when active filters are set. "Clear Filters" (red button) visible when any filter is active.

### Sorting

Columns are sortable (mapped in `handleSort`): 0=Name, 1=Email, 2=Office, 3=Status.

---

## User Groups Tab (`components/UserGroupsTab.tsx`)

### Columns

| Column | Source | Notes |
|---|---|---|
| Group Name | `GroupName` | Includes expand chevron |
| Members | `NumberOfUsers` | User icon + count |
| Permissions | Derived from `ModulePermissions` | Blue `N API` + Green `N Routes` badges; zinc "No permissions" if none |
| Description | `Description` | Truncated |
| Created | `CreatedDate` | Formatted date |
| Actions | — | Yellow pencil, Red trash; click stops row expand propagation |

### Expanded Row

Clicking any row (except Actions buttons) toggles `expandedRows` Set (local state). Expanded rows show a blue-tinted detail panel:

- Permission breakdown organized by module (`ModulePermissions`).
- Modules with no granted permissions are skipped.
- Each module card shows: module name, API action chips (blue), route chips (green) — only granted items.
- Granted counts: `APIPermissions.flatMap(api => api.Actions.filter(a => a.IsGranted))` + `ViewAccess.filter(v => v.IsGranted)`.

---

## Users — Dialogs

### `AddUserDialog`

**Employee ID lookup flow:**
1. User types Employee ID and clicks the search icon (or presses Enter).
2. `fetchUserData({ EmployeeId })` → `POST /PIS/SearchUser` → auto-fills Name, UserId, Email, RegCode, PlantillaOffice.
3. On fetch success, `isDataLoaded = true`; submit is blocked until lookup succeeds.
4. User selects groups via checkboxes (fetched from `fetchUserGroups` on dialog open, limit 100).

**Submit payload (`addUser`):**
```json
{
  "Id": 0,
  "EmployeeId": "string",
  "UserId": "string",
  "Name": "string",
  "Email": "string",
  "RegCode": "string",
  "PlantillaOffice": "string",
  "IsActive": true,
  "UserGroupIds": [1, 2],
  "UserGroupNames": ["Admin", "Editor"]
}
```

### `UpdateUserDialog`

- Pre-populates from `user.UserGroupIds` (toggles group checkboxes by Id).
- Also fetches available groups via `fetchUserGroups` on open (limit 100).
- On submit, resolves `UserGroupNames` from `availableGroups` by matching Id.
- Calls `editUser(payload)` — same shape as add, but `Id > 0`.

### `DeleteUserDialog`

- Shows user name + UserId.
- Calls `deleteUser(user)`.
- Calls `onSubmit(deletedUserId)` on success → parent filters user out of list.

### `ViewUserDialog`

- Read-only display of user details.
- Currently available but not wired to a trigger button in `UsersTab` (edit + delete are the only action buttons).

### `FilterUserDialog`

Filter fields:

| Field | Type | Backend filter key |
|---|---|---|
| Name | text | `UserFilter.filters.Name` |
| User Group | text | `UserFilter.filters.UserGroup` |
| Status | select (All / Active / Inactive) | `UserFilter.filters.IsActive: boolean | undefined` |

---

## User Groups — Dialogs

### `AddGroupDialog`

- Fields: `GroupName` (required), `Description` (optional), `ApplyFilter` (boolean checkbox).
- Calls `addUserGroup({ GroupName, Description, ApplyFilter, PermissionIds: [] })`.
- Backend ignores `PermissionIds` on create — permissions must be set via **Update** after creation.
- On success: triggers `handleAutoRefresh(UserGroupFilter)` in `Rbac.tsx` (full re-fetch).

### `UpdateGroupDialog`

The most complex dialog. Manages granular permission assignment via the **`ModuleAccordion`** component.

**Opening state:**
- Receives `group: vUserGroups` (full `ModulePermissions` tree with `IsGranted` flags).
- Extracts initial `actionIds` = all `Action.Id` where `IsGranted === true` across all modules.
- Extracts initial `viewIds` = all `ViewAccess.Id` where `IsGranted === true` across all modules.
- The `dropdowns: UserGroupDropdowns` prop is accepted for interface compatibility but is NOT used for rendering — the permission tree is rendered from `group.ModulePermissions` directly.

**`ModuleAccordion` component:**
- Displays one accordion panel per module.
- Modules with any granted permissions auto-expand on open.
- Header shows: module name + `X/Y API` badge + `X/Y Routes` badge.
- Each module has:
  - **API Permissions** section: grouped by controller. Each controller has an `IndeterminateCheckbox` (select-all for that controller's actions) + individual action checkboxes.
  - **Route Access** section: individual route checkboxes.
- **Expand All / Collapse All** toolbar buttons.

**`IndeterminateCheckbox`:**
- Native checkbox with `ref.current.indeterminate = true` when some-but-not-all actions in a controller are checked.
- Three states: all checked, some checked (indeterminate), none checked.

**Submit payload (`editUserGroup`):**
```json
{
  "Id": 5,
  "GroupName": "Editors",
  "Description": "...",
  "ApplyFilter": false,
  "PermissionActionIds": [3, 7, 12],
  "PermissionViewIds": [1, 4]
}
```

### `DeleteGroupDialog`

- Requires user to type exactly `"delete"` (case-insensitive) in a confirmation input before the submit button activates.
- Calls `deleteUserGroup(group.Id)` — id passed as **query param**, not body.
- On success: calls `onSubmit(group.Id)` → parent filters group out of list.

### `ViewGroupDialog`

Read-only display of group details + permission summary.

### `FilterUserGroupDialog`

Filter fields:

| Field | Type | Backend filter key |
|---|---|---|
| Group Name | text | `UserGroupFilter.filters.GroupName` |

> `PermissionNames` filter field exists in `UserGroupFilter` but no input for it in `FilterUserGroupDialog`.

---

## Post-Submit Refresh Pattern

After any mutation (add/edit/delete), the parent (`Rbac.tsx`) calls `handleAutoRefresh(filter)`:

- **User mutations (add/update):** Parent optimistically updates local list, then re-fetches on next tab focus.
- **Group add/update:** Calls `handleAutoRefresh(UserGroupFilter)` → full re-fetch from server.
- **User/Group delete:** Parent removes item from local list immediately (optimistic), no re-fetch.

For group add success, if the re-fetch throws, a fallback `vUserGroups` object is constructed locally and appended to the list.

---

## `Rbac.tsx` — Root Component

`Rbac.tsx` is a thin orchestration layer. It:
- Destructures everything from `useRbac()`.
- Renders a tab navigation bar (3 `TabButton` components, each with icon + label + count badge).
- Conditionally renders the active tab component.
- Mounts all dialog components at the bottom. Dialogs are conditionally rendered with `&&` guards where the selected item must exist (edit/delete/view) to avoid rendering with `undefined` props.

The `TabButton` helper (defined inline) is a styled button that calls `getTableData(value)` only when the tab is not already selected (prevents redundant fetches).

---

## Legacy / Removed Features

The following were present in an earlier version and are no longer active:

- **API Permissions tab** (`ApiPermissionsTab.tsx`): Read-only table of `Permissions` (ControllerName + ActionName). Had Sort, Filter, Sync buttons. Now inactive; sync moved to App Modules header.
- **Route Permissions tab** (`RoutePermissionsTab.tsx`): Read-only table of `PermissionViews` (RoutePath + Description). Now inactive.
- **Permission dialogs** (`AddPermissionDialog`, `UpdatePermissionDialog`, `DeletePermissionDialog`, `ViewPermissionDialog`, `FilterPermissionDialog`): Were used in the API Permissions tab. Now inactive.
- **`UserGroups.PermissionIds`** (comma-separated string): Old flat permissions field. Replaced by `ModulePermissions` tree in `vUserGroups`.
- **`Users.UserGroups`** (comma-separated string): Old groups field. Replaced by `UserGroupIds[]` + `UserGroupNames[]` parallel arrays.