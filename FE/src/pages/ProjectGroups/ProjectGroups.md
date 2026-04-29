# Project Groups — Developer Reference

Project Groups is a two-page feature for organizing infrastructure projects into named, permission-controlled collections. Each group is owned by a User Group and can contain any number of projects pulled from the broader project registry.

---

## Folder Structure

```
ProjectGroups/
  Model.d.ts                          # All TypeScript interfaces
  Service.ts                          # All API call functions
  rules/
    projectGroupRules.ts              # Form validation rules for AddProjectGroupModel
  dialogs/
    index.ts                          # Re-exports all dialog components
    AddProjectGroupDialog.tsx         # Create a new project group
    DeleteProjectGroupDialog.tsx      # Confirm-delete a project group (requires typing "delete")
    AddProjectDialog.tsx              # Search + batch-add projects to a group
    DeleteProjectDialog.tsx           # Confirm-delete a project from a group (requires typing "delete")
    FilterProjectGroupDialog.tsx      # Filter the project groups list
  Views/
    ProjectGroup.tsx                  # List page — paginated group list
    ProjectGroupDetails.tsx           # Detail page — edit group info + manage projects
```

> There is **no custom hook**. All state is managed directly inside the view components with `useState` / `useEffect`.

---

## Routes

| Path | Component | Purpose |
|---|---|---|
| `/project-groups` | `ProjectGroup.tsx` | Paginated list of all project groups |
| `/project-groups/:groupId` | `ProjectGroupDetails.tsx` | Detail view for a single group |

Navigation from list to detail: clicking a group's **Name** link or the **View** button calls `navigate('/project-groups/${group.GroupId}')`.

---

## `Model.d.ts` — Type Reference

### `ProjectGroups` (primary entity)

```ts
interface ProjectGroups {
  Id: number;
  GroupId: string;           // String identifier used as the URL segment (not the numeric Id)
  Name: string;
  Description?: string;
  UserGroup: number;         // Numeric FK → UserGroups.Id
  UserGroupName?: string;    // Denormalized display name
  NumberOfProjects?: number;
  CreatedBy?: string;
  CreatedDate?: string;
}
```

> `GroupId` (string) is the stable route key; `Id` (number) is the internal DB primary key. All API calls that target a specific group use `GroupId`.

### `ProjectGroupList` (used in paginated list)

Same shape as `ProjectGroups`. Used as the item type in `PaginationResponse<ProjectGroupList>`.

### `AddProjectGroupModel` (create payload)

```ts
interface AddProjectGroupModel {
  NewGroupId?: string;       // Returned by backend after creation — used for redirect
  Name: string;
  Description: string;
  UserGroup: number;
}
```

### `updateProjectGroupModel` (update payload)

```ts
interface updateProjectGroupModel {
  GroupDetails: ProjectGroups;
  Projects: ProjectList[];
}
```

> The update endpoint receives the full group details + current project list in one payload. This is the shape managed by `formData` in `ProjectGroupDetails.tsx`.

### `ProjectGroupDetailsModel` (detail page response)

```ts
interface ProjectGroupDetailsModel {
  GroupDetails: ProjectGroups;
  Projects: ProjectList[];
  UserGroups: UserGroups[];   // All available user groups — used to populate the UserGroup dropdown in detail page
}
```

### `ProjectList` (project row in a group)

```ts
interface ProjectList {
  Id?: number;
  ProgramId?: string;
  ProgramName?: string;
  ProjectId: string;           // String identifier — primary display key
  RevisionNumber?: number;
  Description?: string;
  Category?: number;
  Thrust?: number;
  Origin?: number;
  City?: number;
  LegislativeDistrict?: number;
  OperatingUnit?: string;
  ImplementingOffice?: string;
  DEO?: string;
  Region?: string;
  Agency?: number;
  ProjectCode?: string;
  ImplementationMode?: number;
  EmergencyMode?: boolean;
  Feasibility?: number;
  DetailedDesign?: boolean;
  RowAvailable?: boolean;
  CreatedBy?: string;
  CreatedDate?: string;
  UpdatedBy?: string;
  UpdatedDate?: string;
}
```

### `ProjectGroupsDropDowns` (list page response)

```ts
interface ProjectGroupsDropDowns extends PaginationResponse<ProjectGroupList> {
  Dropdowns: {
    UserGroups: UserGroups[];
  }
}
```

> The list page fetch (`fetchProjectGroup`) returns the group list AND the UserGroups dropdown in a single response. The dropdown is passed directly to `AddProjectGroupDialog` as `dropdownData`.

### `UserGroups` (local mirror of RBAC user group)

```ts
interface UserGroups {
  Id: number;
  GroupName: string;
  NumberOfUsers: number;
  Description?: string;
  CreatedBy?: string;
  CreatedDate: string;
  PermissionIds: string;       // Comma-separated numeric IDs (not used in this module)
  PermissionNames: string;     // Comma-separated names (not used in this module)
}
```

---

## `Service.ts` — API Functions

All calls use `httpClient.post<T>(url, body, options)` from `../../services/httpClient`.

| Function | Endpoint | Body | Return | Notes |
|---|---|---|---|---|
| `fetchProjectGroup(data)` | `POST /projectgroup/showprojectgroups` | `ProjectGroupPagination` | `ProjectGroupsDropDowns` | Returns list + UserGroups dropdown |
| `addProjectGroup(data)` | `POST /projectgroup/addprojectgroup` | `AddProjectGroupModel` | `AddProjectGroupModel` | Response includes `NewGroupId` for redirect |
| `fetchProjectGroupByName(name)` | `POST /projectgroup/projectgroupdetails` | `{ GroupId: name }` | `ProjectGroupDetailsModel & UserGroups` | `name` is a `GroupId` string |
| `updateProjectGroup(data)` | `POST /projectgroup/updateprojectgroupdetails` | `updateProjectGroupModel` | `ProjectGroupDetailsModel` | Full group + project list |
| `deleteProjectGroup(groupId)` | `POST /projectgroup/deleteprojectgroup` | `{ GroupId: groupId }` | `ErrorResponse` | GroupId is the string key |
| `fetchProjectById(projectId)` | `POST /projectgroup/searchproject` | `{ ProjectId: projectId }` | `{ Project: ProjectList }` | Exact match by ProjectId |
| `addProjectToGroup(data)` | `POST /projectgroup/addproject` | `{ ProjectId: string[], GroupId: string }` | `ErrorResponse` | Accepts a batch array of project IDs |
| `deleteProject(projectId)` | `POST /projectgroup/deleteproject` | `{ ProjectId: projectId }` | `ErrorResponse` | Removes project from whichever group it is in |

---

## `rules/projectGroupRules.ts` — Form Validation

Used only in `AddProjectGroupDialog`. Validation is applied via the shared `formValidation<T>(data, rules)` utility from `../../utils/FormValidation`.

| Field | Rule | Message |
|---|---|---|
| `Name` | Required (truthy) | "Project Group Name is required." |
| `Description` | Required (truthy) | "Description is required." |
| `UserGroup` | Required (truthy / non-zero) | "User Group is required." |

On error: field labels turn red, border highlights red. Submission is blocked until all rules pass.

---

## `Views/ProjectGroup.tsx` — List Page

### Purpose

Shows a paginated, filterable, sortable table of all project groups. Entry point to the feature.

### State

| State | Type | Default | Purpose |
|---|---|---|---|
| `ProjectGroupData` | `ProjectGroupsDropDowns` | Empty pagination + empty dropdowns | Paginated list + dropdown data |
| `ProjectGroupFilters` | `ProjectGroupPagination` | `{ page: 1, limit: 20, filters: { Name: '', UserGroupName: '' } }` | Active filter/sort/page |
| `isAddProjectGroupOpen` | `boolean` | `false` | Controls `AddProjectGroupDialog` |
| `isDeleteProjectGroupOpen` | `boolean` | `false` | Controls `DeleteProjectGroupDialog` |
| `isFilterProjectGroupDialogOpen` | `boolean` | `false` | Controls `FilterProjectGroupDialog` |
| `selectedProjectGroup` | `string | null` | `null` | `GroupId` of the row pending delete |
| `isLoading` | `boolean` | `false` | Disables Add + Filter buttons during fetch |

### Initialization

On mount: `fetchProjectGroup(ProjectGroupFilters)` → populates `ProjectGroupData` (list) and `ProjectGroupData.Dropdowns.UserGroups` in one request.

### Table Columns

| Column | Source | Notes |
|---|---|---|
| Name | `group.Name` | Blue link button; click navigates to `/project-groups/${group.GroupId}` |
| Description | `group.Description` | Falls back to `'N/A'` if empty |
| Number of Projects | `group.NumberOfProjects` | Falls back to `0` |
| UserGroup | `group.UserGroupName` | Falls back to `'N/A'` |
| Created Date | `group.CreatedDate.StringToDate()` | String-to-date extension method |
| Created By | `group.CreatedBy` | — |
| Actions | — | Orange `View` button → navigates to detail; Red `TrashIcon` → opens delete dialog |

### Sorting

Sort logic is **commented out** in the current codebase (see `#region Sorting Logic` block). The `sortField` and `sortDirection` are in the filter model but not wired to column headers in this view.

### Pagination

Shows up to 7 page buttons, centred on the current page. "First" and "Last" buttons skip to page 1 and `totalPages`. Page size is fixed at 20.

### Post-Add Behavior

`AddProjectGroupDialog.onSubmit` **navigates away** to the new group's detail page (`/project-groups/${response.Data.NewGroupId}`) immediately on success. The parent's `onSubmit` callback also appends the new group to `ProjectGroupData.lists` locally, but this is rarely visible because the navigation happens first.

### Post-Delete Behavior

`DeleteProjectGroupDialog.onSubmit` → parent removes the deleted `GroupId` from `ProjectGroupData.lists` optimistically and decrements `total`.

---

## `Views/ProjectGroupDetails.tsx` — Detail Page

### Purpose

Full CRUD page for a single project group: edit group metadata and manage the project list.

### Route Parameter

`useParams<{ groupId: string }>()` → `groupId` is the string `GroupId` from the URL.

### State

| State | Type | Purpose |
|---|---|---|
| `projectGroupDetails` | `ProjectGroupDetailsModel` | Full server state (GroupDetails + Projects + UserGroups) |
| `formData` | `updateProjectGroupModel` | Editable copy of GroupDetails + Projects (what gets submitted) |
| `isLoading` | `boolean` | Loading/skeleton state |
| `isAddProjectOpen` | `boolean` | Controls `AddProjectDialog` |
| `isDeleteProjectOpen` | `boolean` | Controls `DeleteProjectDialog` |
| `selectedProject` | `{ ProjectId: string }` | Project row pending delete |

### Initialization

On mount: `fetchProjectGroupDetails(groupId)` → `fetchProjectGroupByName(groupId)` → populates both `projectGroupDetails` (read/display) and `formData` (edit copy).

### Layout

3-column grid layout:
- **Left column (1/3)**: Editable form fields — Name, Description, UserGroup dropdown, Update button
- **Right column (2/3)**: Map View placeholder (not yet implemented — displays a static placeholder with a pin icon)

### Editable Fields (left column)

| Field | Input type | Bound to |
|---|---|---|
| Name | `<input type="text">` | `formData.GroupDetails.Name` |
| Description | `<textarea>` | `formData.GroupDetails.Description` |
| User Group | `<select>` | `formData.GroupDetails.UserGroup` (numeric Id) |

UserGroup dropdown is populated from `projectGroupDetails.UserGroups` (loaded with initial fetch). The dropdown maps `UserGroup.Id → value`, `UserGroup.GroupName → label`.

### Update Flow

Click **Update** → `handleUpdate()` → `updateProjectGroup(formData)` → `POST /projectgroup/updateprojectgroupdetails`. No re-fetch on success; current `formData` remains as-is.

### Projects Table

Columns: Project ID (blue link → `/projects/project-details/{ProjectId}`), Category, Description, Origin, City, Legislative District, Operating Unit, Implementing Office, DEO, Region, Agency, Created By, Created Date, Actions (red trash delete).

Rendered from `projectGroupDetails.Projects` (display state, not `formData.Projects`).

### Add Project Flow

1. Click **Add Project** → `AddProjectDialog` opens.
2. User enters an exact `ProjectId` and clicks the search icon (or presses Enter).
3. Dialog calls `fetchProjectById(searchTerm)` → `POST /projectgroup/searchproject` → shows the matched `ProjectList` row.
4. User clicks the `+` icon to add the match to a local staging list.
5. Multiple searches can be made; each match is added to the staging list.
6. Click **Submit** → `addProjectToGroup({ ProjectId: string[], GroupId })` → batch insert.
7. On success: dialog calls `onSubmit(selectedProjects)` → parent calls `handleAutoRefresh()` → re-fetches full group details.

### Delete Project Flow

1. Click the red trash icon on a project row → `handleDeleteOpen(project.ProjectId)` → sets `selectedProject` + opens `DeleteProjectDialog`.
2. `DeleteProjectDialog` calls `deleteProject(projectId)` → `POST /projectgroup/deleteproject`.
3. On success: parent `handleDeleteProject(projectId)` removes from both `formData.Projects` and `projectGroupDetails.Projects` optimistically (no re-fetch).

> **Important:** The delete API call is made inside the dialog component itself. The parent handler only manages local state cleanup after the dialog calls `onSubmit`.

---

## Dialog Catalog

### `AddProjectGroupDialog`

| Aspect | Detail |
|---|---|
| Purpose | Create a new project group |
| Props | `isOpen`, `onClose`, `onSubmit`, `dropdownData` (passed from `ProjectGroupData.Dropdowns`) |
| Fields | Name (required), Description (required), UserGroup dropdown (required) |
| Validation | `formValidation<AddProjectGroupModel>` with `projectGroupFormRules` — runs on submit |
| On success | Navigates to `/project-groups/${response.Data.NewGroupId}`; also calls `onSubmit(formData)` |
| Reset | Clears all fields on close |

### `DeleteProjectGroupDialog`

| Aspect | Detail |
|---|---|
| Purpose | Permanently delete a project group |
| Props | `isOpen`, `onClose`, `onSubmit`, `projectGroup: ProjectGroups` |
| Confirmation | User must type `"delete"` (case-insensitive) — submit button inactive until text matches |
| On success | Calls `onSubmit(projectGroup.GroupId)` → parent filters group from local list |
| Warning shown | Group name; generic warning that action is permanent |

### `AddProjectDialog`

| Aspect | Detail |
|---|---|
| Purpose | Search projects by ID and batch-add to the current group |
| Props | `isOpen`, `onClose`, `onSubmit`, `groupId?: string` |
| Search | Exact `ProjectId` match via `fetchProjectById` — one result at a time |
| Staging | Results are added to an in-dialog list; user can queue multiple before submitting |
| On success | `addProjectToGroup({ ProjectId: string[], GroupId })` → calls `onSubmit(selectedProjects)` |
| Reset | Clears search and staging list on open |

### `DeleteProjectDialog`

| Aspect | Detail |
|---|---|
| Purpose | Remove a project from the group |
| Props | `isOpen`, `onClose`, `onSubmit`, `project: ProjectList` |
| Confirmation | User must type `"delete"` (case-insensitive) |
| On success | `deleteProject(project.ProjectId)` → calls `onSubmit(project.ProjectId)` → parent removes from local state |
| Note | Dialog title incorrectly reads "Delete Program" — copy-paste artifact from Program module |

### `FilterProjectGroupDialog`

| Aspect | Detail |
|---|---|
| Purpose | Filter the project groups list |
| Props | `isOpen`, `onClose`, `onSubmit`, `onClear`, `initialData?: ProjectGroupFilter` |
| Fields | Name (text), User Group (text — `UserGroupName` filter) |
| Behavior | Re-syncs to `initialData` on open; Clear button resets fields + calls `onClear` |
| Filter indicator | Parent shows orange ring + count badge on Filter button when any filter is active |

---

## Data Flow Summary

```
ProjectGroup.tsx (mount)
  └── fetchProjectGroup(filters)
        └── response.Data → ProjectGroupData (lists + Dropdowns.UserGroups)

AddProjectGroupDialog (submit)
  └── addProjectGroup(formData)
        └── response.Data.NewGroupId → navigate('/project-groups/{NewGroupId}')

ProjectGroupDetails.tsx (mount from :groupId param)
  └── fetchProjectGroupByName(groupId)
        └── response.Data → projectGroupDetails + formData

ProjectGroupDetails.tsx → Update button
  └── updateProjectGroup(formData)       // no re-fetch; formData retained as-is

ProjectGroupDetails.tsx → Add Project → AddProjectDialog
  └── fetchProjectById(searchTerm)       // lookup
  └── addProjectToGroup({ ProjectId[], GroupId })
        └── onSubmit → handleAutoRefresh → fetchProjectGroupByName (full re-fetch)

ProjectGroupDetails.tsx → Delete Project → DeleteProjectDialog
  └── deleteProject(projectId)           // API call in dialog
        └── onSubmit → handleDeleteProject → local state removal only
```

---

## Known Issues / Notes

- **Sorting not implemented**: Sort logic in `ProjectGroup.tsx` is wrapped in a commented-out `#region Sorting Logic` block. Column headers are not sortable in the current release.
- **Map View placeholder**: The detail page right column contains a static placeholder (pin SVG + "Map View" label). No map library is integrated yet.
- **Dialog title mismatch**: `DeleteProjectDialog` and `DeleteProjectGroupDialog` both show the title "Delete Program" — copy-paste artifact from the Program module; does not affect functionality.
- **No loading indicator on detail update**: `handleUpdate` sets `isLoading` but no skeleton or spinner is shown in the form area during update.
- **Commented-out code**: `fetchProjectGroupEnums` call in `handleOpenDialog`, `editProjectGroup` import, breadcrumb nav, status badge helper — all commented out and pending future use.
- **`deleteProject` local state note**: After deleting a project via the dialog, only `formData.Projects` and `projectGroupDetails.Projects` are updated locally. If the user clicks Update afterwards, the `formData.Projects` (already without the deleted project) is re-submitted, which is consistent. However, if `handleUpdate` ran first and then delete happened, no additional backend sync is needed.