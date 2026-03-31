# RBAC Page — Developer Guide

Role-Based Access Control page for managing users, permissions, user groups, and route permissions.

---

## Folder Structure

```
Rbac/
├── Rbac.tsx              # Root component — layout, tab nav, and dialogs
├── useRbac.ts            # Custom hook — all state, filters, and data-fetching logic
├── Model.d.ts            # TypeScript interfaces and types
├── service.ts            # API call functions
├── components/
│   ├── AppModuleTab.tsx        # App Modules tab — read-only flat list via getAppModules()
│   ├── ApiPermissionsTab.tsx   # API Permissions tab — paginated, sortable, with sync
│   ├── UsersTab.tsx            # Users tab — with sort, filter, badge expand
│   ├── UserGroupsTab.tsx       # User Groups tab — with permission badge lookup
│   └── RoutePermissionsTab.tsx # Route Permissions tab — read-only paginated list
└── dialogs/
    ├── index.ts                # Re-exports all dialogs
    ├── AddUserDialog.tsx
    ├── UpdateUserDialog.tsx
    ├── DeleteUserDialog.tsx
    ├── ViewUserDialog.tsx
    ├── AddPermissionDialog.tsx
    ├── UpdatePermissionDialog.tsx
    ├── DeletePermissionDialog.tsx
    ├── ViewPermissionDialog.tsx
    ├── AddGroupDialog.tsx
    ├── UpdateGroupDialog.tsx
    ├── DeleteGroupDialog.tsx
    ├── ViewGroupDialog.tsx
    ├── FilterUserDialog.tsx
    ├── FilterPermissionDialog.tsx
    └── FilterUserGroupDialog.tsx
```

---

## Tabs

| Tab Value          | Label              | Component             | Data Source                                                         |
|--------------------|--------------------|-----------------------|---------------------------------------------------------------------|
| `modules`          | App Modules        | `AppModuleTable`      | `getAppModules()` → `AppModules[]` — flat list, no pagination       |
| `permissions`      | API Permissions    | `PermissionsTable`    | `fetchPermissions()` → `PaginationResponse<Permissions>` — paginated |
| `routePermissions` | Route Permissions  | `RoutePermissionsTab` | `getRoutePermissions()`                                             |
| `users`            | Users              | `UsersTab`            | `fetchUsers()`                                                      |
| `userGroups`       | User Groups        | `UserGroupsTab`       | `fetchUserGroups()`                                                 |

> **Note:** `modules` uses a completely separate API (`getAppModules`) and type (`AppModules`) from `permissions`. The `AppModuleTable` component (in `AppModuleTab.tsx`) is read-only — no filter, sort, or pagination.

---

## `useRbac.ts` — State Hook

All state and data-fetching logic lives here. `Rbac.tsx` simply destructures from this hook.

### Returned values

| Category       | Key Examples                                                |
|----------------|-------------------------------------------------------------|
| Tab            | `selectedTab`, `getTableData`                               |
| Data           | `UsersData`, `PermissionsData`, `ModulesData` (`AppModules[]`), `UserGroupsData`, `RoutePermissionsData` |
| Filters        | `UserFilter`, `PermissionFilter`, `UserGroupFilter`, `RoutePermissionFilter` |
| Loading flags  | `isLoadingUsers`, `isLoadingPermissions`, `isLoadingModules`, `isLoadingUserGroups`, `isLoadingRoutePermissions`, `isSyncingPermissions` |
| Dialog states  | `isAddUserDialogOpen`, `selectedUserId`, `isUpdateGroupDialogOpen`, etc. |
| Handlers       | `handleSort`, `handleAutoRefresh`, `handleClear`, `handleExpand`, `syncPermissions`, `Paginate` |
| Misc           | `tabNumbers`, `sortDirection`, `permissionViewsLookup`, `expandedUserGroups` |

### Key handlers

- **`getTableData(tabName)`** — switches the active tab and fetches data for it.
- **`handleSort(field, direction)`** — updates the sort filter and re-fetches for the active tab.
- **`Paginate(page)`** — updates the page in the active tab's filter and re-fetches.
- **`handleAutoRefresh(filterData)`** — re-fetches the active tab using the given filter (used after dialog submits).
- **`handleClear()`** — resets filter fields for the active tab and re-fetches.
- **`syncPermissions()`** — calls the sync API then refreshes the permissions list.

---

## `service.ts` — API Functions

| Function                  | Endpoint                                         |
|---------------------------|--------------------------------------------------|
| `fetchInitialData()`      | `POST /UserManagement/InitUserManagement`        |
| `fetchUsers(filter)`      | `POST /UserManagement/ShowUsers`                 |
| `fetchPermissions(filter)`| `POST /UserManagement/ShowPermissions`           |
| `fetchUserGroups(filter)` | `POST /UserManagement/ShowUserGroups`            |
| `fetchUserGroupDropdowns()`| `POST /UserManagement/ShowUserGroupDropdowns`   |
| `getRoutePermissions(filter)`| `POST /UserManagement/ShowViewPermissions`    |
| `callSyncPermissions()`   | `POST /UserManagement/SyncAPIPermissions`        |
| `getAppModules()`         | `POST /UserManagement/ShowAppModules`            |

---

## `Model.d.ts` — Key Types

| Type / Interface         | Purpose                                           |
|--------------------------|---------------------------------------------------|
| `Users`                  | User record                                       |
| `Permissions`            | API permission record (ControllerName, ActionName)|
| `AppModules`             | App module record (ModuleName, Description, ControllerCount, ViewCount) |
| `vUserGroups`            | User group view model                             |
| `PermissionViews`        | Route permission record                           |
| `UserPagination`         | Paginated filter params for users                 |
| `PermissionPagination`   | Paginated filter params for API permissions       |
| `UserGroupPagination`    | Paginated filter params for user groups           |
| `RoutePermissionPagination` | Paginated filter params for route permissions  |
| `InitialDataResponse`    | Shape of the initial data fetch response          |

---

## Adding a New Tab

1. Add the new `DefaultModelKey` value to the union type in `useRbac.ts`.
2. Add data state, filter state, and loading state in `useRbac.ts`.
3. Add fetch logic inside `getTableData`, `handleSort`, `Paginate`, and `handleAutoRefresh`.
4. Create a new component in `components/`.
5. Add a `<TabButton>` and render the new component in `Rbac.tsx`.

## Adding a New Dialog

1. Create `MyDialog.tsx` inside `dialogs/`.
2. Export it from `dialogs/index.ts`.
3. Import it in `Rbac.tsx` and add the open/close state to `useRbac.ts`.
