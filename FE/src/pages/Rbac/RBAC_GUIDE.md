# RBAC Page — Developer Guide

Role-Based Access Control page for managing application modules, users, and user groups.

---

## Folder Structure

```
Rbac/
├── Rbac.tsx              # Root component — layout, tab nav, and dialogs
├── useRbac.ts            # Custom hook — all state, filters, and data-fetching logic
├── Model.d.ts            # TypeScript interfaces and types
├── service.ts            # API call functions
├── appmodules.md         # Detailed App Modules feature notes
├── components/
│   ├── AppModuleTab.tsx        # App Modules tab — full inline CRUD + Sync buttons
│   ├── UsersTab.tsx            # Users tab — with sort, filter, badge expand
│   └── UserGroupsTab.tsx       # User Groups tab — with permission badge lookup
└── dialogs/
    ├── index.ts                # Re-exports all dialogs
    ├── AddUserDialog.tsx
    ├── UpdateUserDialog.tsx
    ├── DeleteUserDialog.tsx
    ├── ViewUserDialog.tsx
    ├── AddGroupDialog.tsx
    ├── UpdateGroupDialog.tsx
    ├── DeleteGroupDialog.tsx
    ├── ViewGroupDialog.tsx
    ├── FilterUserDialog.tsx
    └── FilterUserGroupDialog.tsx
```

---

## Tabs

| Tab Value    | Label        | Component        | Data Source                                          |
|--------------|--------------|------------------|------------------------------------------------------|
| `modules`    | App Modules  | `AppModuleTab`   | `getAppModules()` → `AppModules[]` — paginated       |
| `users`      | Users        | `UsersTab`       | `fetchUsers()`                                       |
| `userGroups` | User Groups  | `UserGroupsTab`  | `fetchUserGroups()`                                  |

> The API Permissions and Route Permissions tabs have been removed. Their sync operations now live inside the **App Modules** tab header.

---

## `useRbac.ts` — State Hook

All state and data-fetching logic lives here. `Rbac.tsx` simply destructures from this hook.

### Returned values

| Category       | Key Examples                                                                 |
|----------------|------------------------------------------------------------------------------|
| Tab            | `selectedTab`, `getTableData`                                                |
| Data           | `UsersData`, `ModulesData` (`AppModules[]`), `UserGroupsData`                |
| Filters        | `UserFilter`, `ModulesFilter`, `UserGroupFilter`                             |
| Loading flags  | `isLoadingUsers`, `isLoadingModules`, `isLoadingUserGroups`                  |
| Dialog states  | `isAddUserDialogOpen`, `selectedUserId`, `isUpdateGroupDialogOpen`, etc.     |
| Handlers       | `handleSort`, `handleAutoRefresh`, `handleClear`, `handleExpand`, `Paginate` |
| Misc           | `tabNumbers`, `sortDirection`, `permissionViewsLookup`, `userGroupDropdowns`, `expandedUserGroups` |

### Key handlers

- **`getTableData(tabName)`** — switches the active tab and fetches data for it.
- **`handleSort(field, direction)`** — updates the sort filter and re-fetches for the active tab.
- **`Paginate(page)`** — updates the page in the active tab's filter and re-fetches.
- **`handleAutoRefresh(filterData)`** — re-fetches the active tab using the given filter (used after dialog submits).
- **`handleClear()`** — resets filter fields for the active tab and re-fetches.

---

## `service.ts` — API Functions

| Function                       | Endpoint                                              | Notes                                                              |
|--------------------------------|-------------------------------------------------------|--------------------------------------------------------------------|
| `fetchInitialData()`           | `POST /UserManagement/InitUserManagement`             |                                                                    |
| `fetchUsers(filter)`           | `POST /UserManagement/ShowUsers`                      |                                                                    |
| `addUser(data)`                | `POST /UserManagement/AddUser`                        | Accepts `Users` interface; `UserGroupIds` + `UserGroupNames` required |
| `editUser(data)`               | `POST /UserManagement/UpdateUser`                     | Same payload as `addUser`; `Id` must be set                        |
| `deleteUser(data)`             | `POST /UserManagement/DeleteUser`                     |                                                                    |
| `fetchUserGroups(filter)`      | `POST /UserManagement/ShowUserGroups`                 |                                                                    |
| `fetchUserGroupDropdowns()`    | `POST /UserManagement/ShowUserGroupDropdowns`         | Returns `AppModules`, `PermissionControllers`, `PermissionActions`, `PermissionViews` |
| `addUserGroup(data)`           | `POST /UserManagement/AddUserGroup`                   | Only accepts `GroupName` + `Description` — no permissions on create |
| `editUserGroup(data)`          | `POST /UserManagement/UpdateUserGroup`                | Accepts `UpdateUserGroupPayload` with `PermissionActionIds` + `PermissionViewIds` |
| `deleteUserGroup(id)`          | `POST /UserManagement/DeleteUserGroup?id={id}`        | Passes id as query param (not body)                                |
| `fetchPermissions(filter)`     | `POST /UserManagement/ShowPermissions`                |                                                                    |
| `fetchPermissionGroups(filter)`| `POST /UserManagement/ShowPermissionGroups`           |                                                                    |
| `getAppModules(filter)`        | `POST /UserManagement/ShowAppModules`                 |                                                                    |
| `addAppModule(data)`           | `POST /UserManagement/AddAppModule`                   |                                                                    |
| `updateAppModule(data)`        | `POST /UserManagement/UpdateAppModule`                |                                                                    |
| `deleteAppModule(data)`        | `POST /UserManagement/DeleteAppModule`                |                                                                    |
| `callSyncPermissions()`        | `POST /UserManagement/SyncAPIPermissions`             |                                                                    |
| `callSyncViewPermissions(routes)`| `POST /UserManagement/SyncViewPermissions`          |                                                                    |

---

## `Model.d.ts` — Key Types

| Type / Interface            | Purpose                                                                      |
|-----------------------------|------------------------------------------------------------------------------|
| `Users`                     | User record — `Id`, `UserGroupIds: number[]`, `UserGroupNames: string[]`, `ApplyFilter?`, `EmployeeId?`, `UserId`, `Name`, `Email?`, `RegCode`, `RegName?`, `PlantillaOffice?`, `PlantillaOfficeName?`, `IsActive` |
| `AppModules`                | App module record — `ModuleName`, `Description`, `ControllerCount`, `ViewCount`, `Controllers` (stringified JSON), `Views` (stringified JSON) |
| `AppModuleFilter`           | Filter params for App Modules (`ModuleName`)                                 |
| `ShowAppModulesPagination`  | Paginated filter params for App Modules                                      |
| `ModulePermission`          | Per-module permission shape returned by `ShowUserGroups` — `ModuleName`, `APIPermissions: UserGroupAPIPermission[]`, `ViewAccess: UserGroupViewItem[]` |
| `UserGroupAPIPermission`    | Controller-level permission item — `ControllerName`, `Actions: UserGroupActionItem[]`, `IsGranted` |
| `UserGroupActionItem`       | Action-level item — `Id`, `ActionName`, `IsGranted`                          |
| `UserGroupViewItem`         | View/route-level item — `Id`, `RouteName`, `RoutePath`, `IsGranted`          |
| `vUserGroups`               | User group view model — `ModulePermissions: ModulePermission[]` (mirrors `vUserGroups` SQL view). Flat `PermissionActionIds?` / `PermissionViewIds?` are kept as optional for error-fallback constructions only and are **not** returned by the API. |
| `AddUserGroups`             | Payload for `addUserGroup` (create only — permissions ignored by backend)    |
| `UpdateUserGroupPayload`    | Payload for `editUserGroup` — `Id`, `GroupName`, `Description`, `PermissionActionIds`, `PermissionViewIds` |
| `AppModuleDropdown`         | Simplified module record returned by `ShowUserGroupDropdowns` — `Id`, `ModuleName`, `Description` |
| `UserGroupDropdowns`        | Full dropdown response — `AppModules: AppModuleDropdown[]`, `PermissionControllers`, `PermissionActions`, `PermissionViews` |
| `PermissionControllers`     | Controller record — `Id`, `ModuleName?` (links to AppModule, currently empty until mapped), `ControllerName`, `Description` |
| `PermissionActions`         | Action record — `Id`, `ControllerName`, `ActionName`, `Description`          |
| `PermissionViews`           | Route permission record — `Id`, `RouteName?` (friendly name), `RoutePath`, `Description` |
| `Permissions`               | API permission record (`ControllerName`, `ActionName`)                       |
| `UserPagination`            | Paginated filter params for users                                            |
| `UserGroupPagination`       | Paginated filter params for user groups                                      |
| `InitialDataResponse`       | Shape of the initial data fetch response                                     |

> `Controllers` and `Views` in `AppModules` are stored as **stringified JSON arrays** — `[{"ControllerName":"...","Linked":false}]` and `[{"RouteName":"...","Linked":false}]`. `ControllerCount` / `ViewCount` are derived counts of items where `Linked === true`.

---

## Users Tab — How It Works

`UsersTab` renders `UsersData` (type `PaginationResponse<Users>`).

User group membership is stored as **parallel arrays** — `UserGroupIds: number[]` and `UserGroupNames: string[]` — matching the login/session API response shape. The tab reads `user.UserGroupNames` directly to render group badges (no string splitting needed).

Whitespace-only field values (common in the API response for `Email`, `PlantillaOffice`, `RegName`) are treated as empty — `.trim()` guards are applied before rendering.

### Columns

| Column     | Source Field(s)                         | Notes                                                                 |
|------------|-----------------------------------------|-----------------------------------------------------------------------|
| User       | `Name` (bold), `UserId` (sub-text), `Email` (xs, only if non-empty) | `Email` is hidden if blank or whitespace-only |
| UserGroup  | `UserGroupNames[]`                      | Blue badges; shows first 3, expandable with `+N more` / `Show less`  |
| Region     | `RegName`                               | Zinc badge; hidden if blank/whitespace                                |
| Office     | `PlantillaOffice`                       | Blue badge; hidden if blank/whitespace                                |
| Status     | `IsActive`                              | Green `Active` / Red `Inactive` badge                                 |
| Actions    | —                                       | Edit (yellow pencil), Delete (red trash)                              |

### User Dialogs

| Dialog               | Trigger                  | API Call                      | Notes                                                                                      |
|----------------------|--------------------------|-------------------------------|--------------------------------------------------------------------------------------------|
| `AddUserDialog`      | "Add User" button        | `addUser`                     | Looks up employee via `fetchUserData({ EmployeeId })` first; selects groups by name (checkbox); payload sends `UserGroupIds` + `UserGroupNames` |
| `UpdateUserDialog`   | Edit (pencil) button     | `editUser`                    | Pre-populates from `user.UserGroupIds`; checkboxes toggle by group `Id`; payload sends `UserGroupIds` + `UserGroupNames` (names resolved from `availableGroups`) |
| `DeleteUserDialog`   | Delete (trash) button    | `deleteUser`                  |                                                                                            |
| `ViewUserDialog`     | (available, not wired)   | —                             | Read-only                                                                                  |
| `FilterUserDialog`   | Filter button            | —                             | Filters by `Name`, `UserGroup`, `IsActive`                                                 |

### Add / Update payload shape

```json
{
  "Id": 0,
  "UserGroupIds": [1],
  "UserGroupNames": ["Admin"],
  "ApplyFilter": false,
  "EmployeeId": "string",
  "UserId": "string",
  "Name": "string",
  "Email": "string",
  "RegCode": "string",
  "RegName": "string",
  "PlantillaOffice": "string",
  "PlantillaOfficeName": "string",
  "IsActive": true
}
```

> The old `UserGroups` comma-separated string field has been removed. The `service.ts` functions `addUser` and `editUser` both accept the `Users` interface directly — no extra mapping needed.

---

## User Groups Tab — How It Works

`UserGroupsTab` renders `UserGroupsData` (type `PaginationResponse<vUserGroups>`).

The `permissionViewsLookup` map (built from `fetchUserGroupDropdowns`) resolves view permission IDs to readable route names for display in the table.

Each group's granted view IDs are **derived at render time** from `group.ModulePermissions` by collecting all `ViewAccess` entries where `IsGranted === true`. This replaces the old flat `PermissionViewIds` array that was never populated.

On tab switch, `getTableData('userGroups')` calls only `fetchUserGroups` — no extra API calls.

The `permissionViewsLookup` is populated once on page mount via `fetchUserGroupDropdowns`, run in parallel with `fetchInitialData`. This means the lookup is ready before any tab is clicked.

### Group Dialogs

| Dialog               | Trigger                                  | API Call                           | Notes                                                        |
|----------------------|------------------------------------------|------------------------------------|--------------------------------------------------------------|
| `AddGroupDialog`     | "Add Group" button                       | `addUserGroup`                     | Name + Description only — backend does not accept permissions on create |
| `UpdateGroupDialog`  | Edit (pencil) button                     | `editUserGroup` on submit — no extra API call on open | Receives `dropdowns: UserGroupDropdowns` prop (kept for interface compat, no longer used for rendering). Uses `ModuleAccordion` component to display `group.ModulePermissions` organized by module. Pre-selects by extracting IDs where `IsGranted === true`. See **ModuleAccordion** section below. |
| `DeleteGroupDialog`  | Delete (trash) button                    | `deleteUserGroup(id)` — query param | Requires typing "DELETE" to confirm                         |
| `FilterUserGroupDialog` | Filter button                         | —                                  | Filters by `GroupName`                                       |
| `ViewGroupDialog`    | (available, not wired to a button)       | —                                  | Read-only                                                    |

> **Backend constraint:** `AddUserGroup` only creates the group record. Use the Edit dialog to assign `PermissionActionIds` and `PermissionViewIds`. The `AddGroupDialog` shows a hint to inform the user.

---

## `UpdateGroupDialog` — `ModuleAccordion` Component

`ModuleAccordion` replaces the old flat `CheckboxSelect` panels. It renders one collapsible accordion panel per module from `group.ModulePermissions`.

### Layout per module panel

```
▼ UserManagement        [25/25 API]  [1/1 Routes]   ← blue highlight = has grants
  API Permissions
  └ ☐ UserManagementController  0/25           ← indeterminate checkbox (select all)
      ☒ AddAppModule
      ☒ AddUser
      ...
  Route Access
      ☒ UserManagement   /user-management

► CodeTable             [0/3 API]  [1/1 Routes]   ← collapsed by default (no API grants)
```

### Behaviour

| Feature | Detail |
|---------|--------|
| **Initial open state** | Modules with at least one `IsGranted === true` item start expanded; all others start collapsed |
| **Expand All / Collapse All** | Buttons in the section header |
| **Controller select-all** | `IndeterminateCheckbox` toggles all actions for that controller at once |
| **Selection summary bar** | Shows total selected count with split API/Routes badges, always visible above the accordion |
| **Color coding** | Blue border + blue header = module has grants; gray = nothing granted |
| **Source of truth** | `group.ModulePermissions` provides structure; local `actionIds`/`viewIds` state tracks selection |
| **Submit payload** | Sends flat `PermissionActionIds` + `PermissionViewIds` arrays to `UpdateUserGroup` endpoint |

---

## App Modules Tab

`AppModuleTab.tsx` provides full inline CRUD with no separate dialogs, plus two sync buttons. All CRUD state is local to the component; `onDataChange` prop is `setModulesData` from `useRbac`.

### CRUD Operations

| Operation | Trigger | Behavior |
|-----------|---------|----------|
| **Add**   | _Add Module_ button in header | Inserts blank amber-highlighted row at top; fill Module Name + Description + linked Controllers/Views; confirm ✓ or cancel ✗ |
| **Edit**  | Pencil icon on row | Row goes amber; Module Name and Description become inline inputs; `ModuleLinksEditor` panel expands as editable |
| **Delete**| Trash icon on row | Inline _Delete? ✓ ✗_ confirmation in Actions cell; removes row on confirm |

All three operations call `showToast` for success feedback via `useToast()` from `ToasterContext`.

### Controllers & Views Panel (`ModuleLinksEditor`)

- Each row shows `X / Y linked` with a chevron in the Controllers and Views columns.
- Clicking anywhere on a non-editing row toggles the expand panel (Actions cell uses `stopPropagation`).
- Each entry in the panel shows a Toggle switch — **read-only** when viewing, **editable** when in edit/add mode.

### Sync Buttons

Two sync buttons are embedded in the header. They are self-contained — no props or parent state needed.

| Button | API Endpoint | Description |
|--------|-------------|-------------|
| **Sync API** | `POST /UserManagement/SyncAPIPermissions` | Discovers all controllers/actions via reflection and upserts into `tPermissionControllers` / `tPermissionActions` |
| **Sync Routes** | `POST /UserManagement/SyncViewPermissions` | Sends the frontend `protectedRoutes` array (mapped to `{ RouteName, path }`) as `RoutesAvailable` payload |

- Both buttons are disabled while an edit is in progress (`editId !== null`) or while the sync is running.
- Success feedback uses `showToast`; errors are logged to console.
- Routes payload shape: `{ RoutesAvailable: [{ RouteName?: string, path: string }] }`.
- Route `element` is stripped before sending.

---

## Success Notifications

All dialogs and tabs that call service functions use `showToast` from `ToasterContext` for success messages. Error handling is left to local state or `console.error` per component.

```tsx
import { useToast } from '../../../components/toaster/ToasterContext';

const { showToast } = useToast();

// After a successful service call:
showToast({ message: 'User added successfully.', type: 'success' });
```

---

## Adding a New Tab

1. Add the new `DefaultModelKey` value to the union type in `useRbac.ts`. The current union is `'users' | 'userGroups' | 'modules'`.
2. Add data state, filter state, and loading state in `useRbac.ts`.
3. Add fetch logic inside `getTableData`, `handleSort`, `Paginate`, and `handleAutoRefresh`.
4. Create a new component in `components/`.
5. Add a `<TabButton>` and render the new component in `Rbac.tsx`.

## Adding a New Dialog

1. Create `MyDialog.tsx` inside `dialogs/`. Import `useToast` and call `showToast` on success.
2. Export it from `dialogs/index.ts`.
3. Import it in `Rbac.tsx` and add the open/close state to `useRbac.ts`.
