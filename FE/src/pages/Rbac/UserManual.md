# User Management — User Manual

This guide covers how to use the **User Management** section of the MYPS application. User Management is where system administrators control who can access the application, what groups they belong to, and what application modules and permissions exist.

---

## Overview

User Management is organized into three tabs:

| Tab | Purpose |
|---|---|
| **App Modules** | Define and maintain the application's functional modules; link backend API controllers and frontend routes to each module; sync permissions |
| **Users** | View, add, edit, and delete system users; assign users to groups |
| **User Groups** | View, add, edit, and delete user groups; control what each group can access |

> Access to User Management is typically restricted to system administrators. If you cannot see this section in the navigation, contact your administrator.

---

## App Modules Tab

App Modules define the top-level functional areas of the application (e.g., "Programs", "Projects", "Reports"). Each module groups together related backend API actions and frontend page routes.

### Viewing Modules

The App Modules table shows each module with:
- **Module Name** — the display name
- **Description** — a short description of the module
- **Controllers** — number of backend API controllers linked to this module
- **Views** — number of frontend routes linked to this module

Click any row (while not in edit mode) to expand it and see which controllers and routes are linked, along with their linked/unlinked status.

### Adding a Module

1. Click **Add Module** in the top right of the tab.
2. A new blank row appears at the top of the table.
3. Type the **Module Name** (required) and **Description** (optional).
4. The controllers/views panel below the row shows all available items. Use the toggle switches to mark which controllers and routes belong to this module. Toggling to blue means "linked."
5. Click the **checkmark** to save. The row is added to the list.
6. Click the **X** to cancel without saving.

### Editing a Module

1. Click the **pencil icon** on the row you want to edit.
2. The row becomes editable. Update the description or the linked controllers/views. The **Module Name** stays read-only: a module cannot be renamed, so add a new module instead.
3. Click the **checkmark** to save, or **X** to cancel.

> Only one module can be edited at a time. Add/Edit operations are locked while another edit is in progress.

### Deleting a Module

1. Click the **trash icon** on the row you want to delete.
2. An inline confirmation appears in the Actions column ("Confirm" and "Cancel").
3. Click **Confirm** to permanently delete the module, or **Cancel** to abort.

> A module can be deleted only once no controller or route is linked to it. Unlink them first; the delete is refused while any is still linked.

### Syncing Permissions

Two sync buttons appear in the App Modules tab header:

| Button | What it does |
|---|---|
| **Sync API** | Scans the backend for controller actions, registers new ones, and **removes** actions that no longer exist in the code from every group. Run this after deploying new backend endpoints. |
| **Sync Routes** | Registers the page routes of the page you have open. A route this version no longer has is removed only if no user group has it; one a group still has is kept and named in the notification. Run this after adding new pages or routes to the application. |

Both buttons ask for confirmation first, and are disabled while any module is being edited. After each sync, a notification gives the counts (added, updated, removed) and the module list is reloaded.

---

## Users Tab

The Users tab lists all registered users in the system.

### Reading the Users Table

| Column | What it shows |
|---|---|
| **User** | Full name (bold), system ID (below name), and email address (small text) |
| **User Group** | Blue badges showing which groups the user belongs to. If a user has more than 3 groups, a `+N more` badge appears — click it to see all; click `Show less` to collapse |
| **Region** | The user's assigned region |
| **Office** | The user's assigned office |
| **Status** | **Active** (green) or **Inactive** (red) |
| **Actions** | Edit (yellow pencil) and Delete (red trash) buttons |

### Sorting the Table

Click any sortable column header to sort by that column. Click again to reverse the sort order.

### Filtering Users

1. Click the **Filter** button (funnel icon).
2. A filter dialog appears with fields:
   - **Name** — search by the user's full name (partial match)
   - **User Group** — search by group name
   - **Status** — select All, Active, or Inactive
3. Click **Apply** to filter. The Filter button will show an orange badge with the number of active filters.
4. Click **Clear Filters** (red button, visible when filters are active) to reset all filters.

### Adding a User

Users are registered using their government Employee ID from the Personnel Information System (PIS).

1. Click **Add User**.
2. In the dialog that opens, type the **Employee ID** of the person you want to add.
3. Click the **search icon** (magnifying glass). The system looks up the employee in PIS.
4. If found, the name, system ID, email, region, and office fields fill in automatically.
5. Select one or more **User Groups** from the checkbox list to assign the user to groups. At least one group is required: a user without a group cannot sign in.
6. The **Status** field defaults to Active.
7. Click **Add User** to save.

> If the Employee ID is not found in PIS, an error message will appear. Make sure you have the correct ID.
>
> If you submit without completing the PIS lookup, the form will not proceed — you must search first.

### Editing a User

1. Click the **pencil icon** on the user's row.
2. The Edit User dialog opens, pre-filled with the user's current data.
3. You can update the user's group assignments (add or remove groups using the checkboxes) and their active/inactive status.
4. To change the **Employee ID**, type the new one and click the **search icon**: PIS fills in the region and office. Saving a changed Employee ID without the search is refused, and a recorded Employee ID cannot be cleared.
5. Click **Update User** to apply changes.

> The User ID (login), name, email, region and office cannot be typed over here: the login never changes, and the region and office change only through the PIS search of a new Employee ID.
>
> On **your own account** the Employee ID, groups and status are locked, and the Delete button is disabled. Another administrator has to change them.

### Deleting a User

1. Click the **trash icon** on the user's row.
2. A confirmation dialog appears showing the user's name.
3. Click **Delete** to confirm.

> Deleting a user removes their system access. This action cannot be undone. Consider setting a user to **Inactive** instead if you want to temporarily disable access without permanently removing the account.

---

## User Groups Tab

User Groups are named sets of permissions. When a user is assigned to a group, they inherit all the access rights of that group.

### Reading the User Groups Table

| Column | What it shows |
|---|---|
| **Group Name** | The group's name, with a chevron (▼) indicating it can be expanded |
| **Members** | How many users are currently in this group |
| **Permissions** | Blue `N API` badge (number of backend API actions granted) + Green `N Routes` badge (number of frontend pages granted); or a gray "No permissions" badge if none assigned |
| **Description** | A short description of the group's purpose |
| **Created** | The date the group was created |
| **Actions** | Edit (yellow pencil) and Delete (red trash) buttons |

### Viewing a Group's Permissions

Click anywhere on a group row (except the action buttons) to expand it. The row expands to show a grid of **module permission cards**, one per module that has at least one permission granted for that group.

Each card shows:
- The module name
- **API** permissions — small blue chips showing the individual backend actions granted (e.g., `GetPrograms`, `CreateProgram`)
- **Routes** — small green chips showing the frontend pages granted (e.g., `Programs`, `ProgramDetail`)

Click the row again to collapse.

### Filtering User Groups

1. Click the **Filter Group** button.
2. A filter dialog appears with a **Group Name** field.
3. Click **Apply** to filter.
4. Click **Clear Filter** to reset.

### Adding a User Group

1. Click **Add Group**.
2. Fill in the **Group Name** (required, at most 100 characters, without double quotes or backslashes) and **Description** (optional). A name that matches an existing group, ignoring case and surrounding spaces, is refused.
3. Click **Create Group**.

> A new group starts with **no permissions**. You must edit the group afterwards to assign permissions. Permissions are not set during the creation step.

### Editing a User Group (Assigning Permissions)

This is the primary way to control what a group can access.

1. Click the **pencil icon** on the group's row.
2. The Edit Group dialog opens showing:
   - **Group Name** — editable, except for **DPC**, **RPC** and **AUC**, whose names the revision approval steps use (DPC submits, RPC endorses, AUC approves)
   - **Description** — editable
   - **Project visibility** — which projects the members see: **All projects**, **Own region** or **Own district office** (from the member's Plantilla Office), or **By program Data Security** (with Apply Filter, the programs whose Data Security Access includes the member's region). A user in several groups sees the widest. The same choice is in the Add Group dialog, and the User Groups list shows each group's setting.
   - **Module Permissions** accordion — a list of all application modules

**Working with the Module Permissions accordion:**

- Each module is shown as a collapsible panel.
- Modules that already have permissions granted are **highlighted in blue** and expanded automatically when the dialog opens.
- The panel header shows a count badge: `X/Y API` and `X/Y Routes` (granted out of total).
- Click a module header to expand or collapse it.
- Use **Expand All** / **Collapse All** buttons to manage all panels at once.

Inside each expanded module:

- **API Permissions** — grouped by controller. Check individual actions, or use the **controller-level checkbox** to select/deselect all actions in that controller at once. The controller checkbox shows as partially filled (indeterminate) when only some of its actions are selected.
- **Route Access** — check individual frontend routes to grant page-level access.

3. After configuring permissions, click **Save Changes**.

> Permissions take effect immediately. Users already logged in may need to refresh their session to see changes.
>
> Permissions the dialog does not list (of controllers or pages outside every module) are kept when you save. A save that would take the User Management page, its actions or session validation away from a group **you** belong to is refused, so you cannot lock yourself out.

### Deleting a User Group

Deleting a group is a destructive operation and requires an explicit confirmation to prevent accidents.

1. Click the **trash icon** on the group's row.
2. The Delete Group dialog opens showing the group name and current member count.
3. Type **DELETE** (case-insensitive) in the confirmation field.
4. Click **Delete Group** to confirm.

> A group that still has members cannot be deleted: the dialog says so and **Delete Group** stays disabled. Remove the group from those users' accounts in the **Users** tab first. Deleting an empty group removes its permission assignments and cannot be undone.

---

## Common Workflows

### Adding a new employee to the system

1. Go to **App Modules** tab → verify the modules they will need exist (add if missing).
2. Go to **User Groups** tab → confirm the appropriate group exists and has the right permissions (edit if needed).
3. Go to **Users** tab → click **Add User** → search by Employee ID → assign the correct group(s) → save.

### Onboarding a new role / department

1. Go to **User Groups** tab → click **Add Group** → set name and description → save.
2. Click the **pencil icon** on the new group → assign the required module permissions using the accordion → save.
3. Go to **Users** tab → for each user in that role, click the pencil icon → add the new group to their assignments → save.

### Syncing after a system update (new pages or API endpoints were deployed)

1. Go to **App Modules** tab.
2. Click **Sync API** — this registers any new backend API actions.
3. Click **Sync Routes** — this registers any new frontend pages.
4. Review the App Modules list — new controllers/routes will now appear as unlinked. Click the module they belong to (pencil icon) and toggle the new items to linked.
5. Go to **User Groups** → update any groups that need access to the new permissions.

### Temporarily disabling a user without deleting them

1. Go to **Users** tab → click the pencil icon on the user → change Status to **Inactive** → save.

The user will no longer be able to log in, and a session they already have open is refused (pages and reports alike), but their account and history remain intact.

---

## Tips and Notes

- **Filtering is additive**: multiple filter fields combine (AND logic). A user must match all active filters to appear.
- **Group permissions are inherited, not per-user**: individual users do not have their own permissions — everything flows from their group assignments.
- **Module links affect Sync**: running Sync API/Sync Routes only registers items in the permission system. You still need to manually link them to a module before they can be assigned to groups.
- **Sort direction is shared across tabs**: sorting one tab and switching to another may carry over the sort indicator visually. The actual sort applied is always scoped to the current tab's filter.
- **Pagination**: each tab shows a limited number of rows per page. Use the pagination controls at the bottom of each table to navigate.