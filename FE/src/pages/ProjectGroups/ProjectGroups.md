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
    AddProjectDialog.tsx              # Paste a list of Project IDs, add them, show the per-ID result
    RemoveProjectsDialog.tsx          # Confirm removing one or many projects from the group (no typing)
    FilterProjectGroupDialog.tsx      # Filter the project groups list
  components/
    IdChipGroup.tsx                   # "Title (n)" + up to ten ID chips + "+N more" (copy of Program's PreviewGroup)
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

### `AddProjectsToGroupResult` / `RemoveProjectsFromGroupResult` (membership responses)

```ts
interface AddProjectsToGroupResult {
  Message: string;
  Title: string;
  AddedProjectIds: string[];
  AlreadyInGroupProjectIds: string[];
  InOtherGroupProjects: { ProjectId: string; GroupName: string }[];
  NotFoundProjectIds: string[];      // as typed
}

interface RemoveProjectsFromGroupResult {
  Message: string;
  Title: string;
  RemovedProjectIds: string[];
  NotInGroupProjectIds: string[];    // not found, ungrouped, or in another group; left unchanged
}
```

> Every ID in these results is a **Project ID**, even when the request matched a project by its `ProjectPK`. Both responses are 200 even when nothing changed.

### `UserGroups` (local mirror of RBAC user group)

```ts
interface UserGroups {
  Id: number;
  GroupName: string;
  NumberOfUsers: number;
  Description?: string;
  CreatedBy?: string;
  CreatedDate: string | null;
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
| `updateProjectGroup(data)` | `POST /projectgroup/updateprojectgroupdetails` | `{ GroupDetails }` | `ProjectGroupDetailsModel` | Group fields only (Name, Description, User Group). The DTO has no `Projects` list: membership is saved only by `addproject` / `deleteproject` |
| `deleteProjectGroup(groupId)` | `POST /projectgroup/deleteprojectgroup` | `{ GroupId: groupId }` | `ErrorResponse` | GroupId is the string key |
| `addProjectToGroup(data)` | `POST /projectgroup/addproject` | `{ ProjectId: string[], GroupId: string }` | `AddProjectsToGroupResult` | Partial success: adds only ungrouped projects, reports the rest. At most 500 IDs (400 above that). Never moves a project out of another group: the write is conditional, and a concurrent change gives 409 "Try Again". A project still pointing at a deleted group counts as ungrouped |
| `removeProjectsFromGroup(data)` | `POST /projectgroup/deleteproject` | `{ GroupId: string, ProjectIds: string[] }` | `RemoveProjectsFromGroupResult` | Nulls `ProjectGroupFK` only where it equals **this** group (conditional write; 409 "Try Again" on a concurrent change); other IDs come back in `NotInGroupProjectIds` |

> The action names stay `AddProject` / `DeleteProject`, so the existing `vUserActionPermission` rows still apply. `SearchProject` still exists on the API but the FE no longer calls it.

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
| `removeIds` | `string[] \| null` | Project IDs awaiting the remove confirm; `RemoveProjectsDialog` is open while non-null |
| `selectedIds` | `Set<string>` | Ticked rows, keyed by `ProjectId`. Cleared on every refresh |

### Initialization

On mount (and whenever `groupId` changes) the effect calls `fetchProjectGroupByName(groupId)` and populates both `projectGroupDetails` (read/display) and `formData` (edit copy). Only the latest load is applied. A load whose effect was already cleaned up (another group opened, or StrictMode's second mount in dev) is dropped. Until 2026-10-30, that late response overwrote whatever had been typed since the first load showed the form.

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

Click **Update** → `handleUpdate()` → `updateProjectGroup({ GroupDetails: formData.GroupDetails })` → `POST /projectgroup/updateprojectgroupdetails`. On success:
- A success toast shows the API's message: "Project Group '<Name>' updated successfully."
- The form and the saved copy (`projectGroupDetails.GroupDetails`) take the Name and Description **trimmed**, as the API saves them, so the dialogs show the saved name.
- There is no re-fetch.

Until 2026-10-30 a successful Update showed nothing, and the API's message named the group's row number.

> Until 2026-10-25 the page sent `formData.Projects` too, and the DTO bound them as `ProjectsInGroup` (string `Category`). The rows carry a numeric `Category`, so Update failed with 400 "Category: Please provide a valid text value." for any group with projects.

### Projects Table

Columns: a row checkbox (header checkbox = select all; indeterminate, set through a ref, when only some rows are ticked), Project ID (blue link → `/projects/project-details/{ProjectId}:{StageName}`, or `/lumpsum/{Id}` for a Lump Sum Project, as in the Projects list; a bare ProjectId shows "Project Not Available"), Category, Description, Implementing Office, Region, Created Date, Actions (red trash = remove this one).

Rendered from `projectGroupDetails.Projects` (display state, not `formData.Projects`).

Header buttons: **Remove selected (N)** (red, disabled at N = 0) → `setRemoveIds([...selectedIds])`, and **Add Projects** → opens `AddProjectDialog`.

### Refresh after add/remove: `refreshProjects()`

Both dialogs call `onClose(changed)`. When `changed` is true the page calls `refreshProjects()`, which re-fetches the details and replaces **only** `Projects` in both states, then clears the selection.

> **Do not refresh the way the page first loads.** That load sets `isLoading`, and `if (isLoading) return <skeleton/>` unmounts the whole page, including any open dialog. It also overwrites `formData.GroupDetails`, which throws away unsaved Name/Description edits.

### Add Projects Flow

1. Click **Add Projects** → `AddProjectDialog` opens.
2. The user pastes IDs. `parseProjectIds` splits on `/[,;\s]+/` and drops empties and case-insensitive duplicates (the first spelling wins). A live "N project ID(s)" count shows below.
3. **Add**: an empty list or more than 500 IDs gives an inline error, and no request is sent. Otherwise one `addProjectToGroup` call is made, and the dialog switches to its result view (`IdChipGroup`s: Added, Already in this group, In another group (not moved) as `ProjectId — GroupName`, Not found).
4. **Add more** clears back to the input. **Close**, the X and the backdrop all call `onClose(changed)`. Closing is ignored while a request is in flight, so `changed` is not lost.

### Remove Projects Flow

1. A row's trash icon sets `removeIds = [ProjectId]`. **Remove selected (N)** sets `removeIds` to the selection.
2. `RemoveProjectsDialog` shows "Remove N project(s) from *Group*? The projects are not deleted and can be added back." with the IDs as chips. No typing is required.
3. **Remove** → `removeProjectsFromGroup({ GroupId, ProjectIds })`. A success (or info, if nothing was removed) toast shows the API `Message`; `NotInGroupProjectIds` gets a second info toast. Then `onClose(removed > 0)`. On a failure the dialog stays open.

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
| Purpose | Paste a list of Project IDs and add them to the current group |
| Props | `isOpen`, `groupId: string`, `groupName: string`, `onClose(changed: boolean)` |
| Input | One textarea; separators `, ; space tab newline`; client-side dedupe; at most 500 IDs |
| Result | Per-ID breakdown from `AddProjectsToGroupResult`; **Add more** / **Close** |
| Reset | Clears everything when `isOpen` becomes true |

### `RemoveProjectsDialog`

| Aspect | Detail |
|---|---|
| Purpose | Remove one or many projects from the group (unlink; the projects are not deleted) |
| Props | `projectIds: string[] \| null` (open while non-null), `groupId`, `groupName`, `onClose(changed: boolean)` |
| Confirmation | Plain Cancel / **Remove**. No typing, because nothing is deleted |
| On success | Toasts the API `Message` (+ `NotInGroupProjectIds`), then `onClose(RemovedProjectIds.length > 0)` |
| Note | Replaces `DeleteProjectDialog`, whose "Delete Program" title and "permanently remove" text were wrong |

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
  └── updateProjectGroup({ GroupDetails })  // group fields only; no re-fetch

ProjectGroupDetails.tsx → Add Projects → AddProjectDialog
  └── addProjectToGroup({ ProjectId[], GroupId })   // one call per Add; result shown in the dialog
        └── onClose(changed) → refreshProjects()    // Projects only; no skeleton, edits kept

ProjectGroupDetails.tsx → Remove selected (N) / row trash → RemoveProjectsDialog
  └── removeProjectsFromGroup({ GroupId, ProjectIds[] })
        └── onClose(changed) → refreshProjects()
```

---

## Known Issues / Notes

- **Sorting not implemented**: Sort logic in `ProjectGroup.tsx` is wrapped in a commented-out `#region Sorting Logic` block. Column headers are not sortable in the current release.
- **Map View placeholder**: The detail page right column contains a static placeholder (pin SVG + "Map View" label). No map library is integrated yet.
- **Dialog title mismatch**: `DeleteProjectGroupDialog` shows the title "Delete Program", a copy-paste artifact from the Program module. It does not affect functionality. (`DeleteProjectDialog` had the same title; it was replaced by `RemoveProjectsDialog`.)
- **No loading indicator on detail update**: `handleUpdate` sets `isLoading` but no skeleton or spinner is shown in the form area during update.
- **Commented-out code**: `fetchProjectGroupEnums` call in `handleOpenDialog`, `editProjectGroup` import, breadcrumb nav, status badge helper — all commented out and pending future use.
- **Membership is not saved by Update**: `UpdateProjectGroupDetails` ignores `dto.Projects`. Adding and removing projects happen only through `AddProject` / `DeleteProject`, so `formData.Projects` is display-only.