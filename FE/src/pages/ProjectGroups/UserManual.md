# Project Groups — User Manual

Project Groups are named collections of infrastructure projects. They allow teams to organize related projects under a single group name and control which user group has ownership or visibility over that collection.

---

## Overview

The Project Groups section has two screens:

| Screen | How to reach it | What you do here |
|---|---|---|
| **Project Groups List** | Click "Project Groups" in the navigation | Browse all groups, filter, add new groups, delete groups |
| **Project Group Details** | Click a group name or the View button | Edit group info, view and manage the projects inside the group |

---

## Project Groups List

### What the table shows

| Column | What it means |
|---|---|
| **Name** | The group's name — click it to open the group's detail page |
| **Description** | A brief description of the group's purpose |
| **Number of Projects** | How many projects are currently linked to this group |
| **User Group** | The user group that owns or is responsible for this project group |
| **Created Date** | When the group was created |
| **Created By** | Who created the group |
| **Actions** | Orange **View** button (open detail page) and Red **Delete** button |

### Filtering the list

1. Click the **Filter** button (funnel icon) in the top-right area of the table.
2. A filter dialog opens with two fields:
   - **Name** — search for groups whose name contains this text
   - **User Group** — search by the name of the assigned user group
3. Click **Apply** to filter. The Filter button shows an orange badge with the number of active filters.
4. To remove filters, click the **Clear Filters** button (appears in red next to the Filter button when a filter is active), or click Filter and use the **Clear** button inside the dialog.

> Filters are additive — the list must match both Name and User Group if both are filled in.

### Adding a new project group

1. Click the **Add Project Group** button (blue, top-right of the table).
2. A dialog opens with three required fields:

   | Field | Description |
   |---|---|
   | **Project Group Name** | A unique, descriptive name for the group |
   | **Description** | A short explanation of what this group represents |
   | **User Group** | Select which user group owns this project group |

3. All three fields are required — the form will highlight any missing fields in red if you try to submit without filling them.
4. Click **Submit** to create the group.
5. After a successful save, you are automatically taken to the **Project Group Details** page for the new group, where you can start adding projects.

> To cancel without creating the group, click **Cancel** or the X button.

### Deleting a project group

> **Warning:** Deleting a project group is permanent. It removes the group and may affect users assigned to it. The projects themselves are not deleted — only the group container.

1. Click the red **trash icon** in the Actions column for the group you want to delete.
2. A confirmation dialog appears showing the group's name and a warning message.
3. Type **delete** in the confirmation field (any case — "DELETE" or "Delete" both work).
4. Click **Delete Group** to confirm. The group is removed from the list immediately.

> If you are unsure, click **Cancel** or the X button to close without deleting.

---

## Project Group Details

### Getting there

Click a group's **Name** link or the orange **View** button on the list page. The URL will be `/project-groups/{GroupId}`.

### Editing group information

The left panel on the detail page contains the group's core information. All fields are editable:

| Field | What to enter |
|---|---|
| **Name** | The group's display name |
| **Description** | A description of the group's purpose |
| **User Group** | Select a new owner group from the dropdown |

After making changes, click the green **Update** button to save. Changes are saved immediately; the page stays open.

> The right panel is reserved for a **Map View** feature (coming soon). It currently shows a placeholder.

### Viewing the projects in a group

Below the group info section, a **Projects** table lists all projects linked to this group.

| Column | What it shows |
|---|---|
| *(checkbox)* | Tick to select the project for removal. The checkbox in the header selects or clears every row |
| **Project ID** | Click to open the full project detail page |
| **Category** | Project category |
| **Description** | Short project description |
| **Implementing Office** | Implementing office |
| **Region** | Region |
| **Created Date** | When the project was created |
| **Actions** | Red trash icon to remove the project from this group |

A project can belong to only one project group at a time.

### Adding projects to a group

1. Click the blue **Add Projects** button above the projects table.
2. Paste or type the **Project IDs**. Separate them with commas, semicolons, spaces, tabs or new lines; a list copied from a spreadsheet column works as is. The count under the box shows how many distinct IDs you entered. An ID entered twice is counted once.
3. Click **Add**. You can add up to 500 projects at a time.
4. The dialog shows what happened to each ID:
   - **Added**: the project is now in this group.
   - **Already in this group**: nothing needed to change.
   - **In another group (not moved)**: the project belongs to the group named next to it and was left there. To move it, open that group, remove the project, then add it here.
   - **Not found**: no project has that ID. Check it for typing errors.
5. Click **Add more** to paste another list, or **Close**. The projects table shows the added projects. Name or Description edits you have not saved yet are kept.

### Removing projects from a group

1. Tick the checkbox of each project to remove, or tick the header checkbox to select them all.
2. Click the red **Remove selected (N)** button. To remove a single project, you can instead click the trash icon on its row.
3. Check the list of projects in the confirmation and click **Remove**. The rows disappear and a message says how many were removed.

> Removing a project from a group does **not** delete the project itself — it only unlinks it from this group. The project still exists in the system and can be found through the main Projects section or added to another group.

---

## Common Workflows

### Setting up a new project group for a team

1. Go to **Project Groups** list page.
2. Click **Add Project Group**.
3. Enter the group name, description, and select the team's user group from the dropdown.
4. Click **Submit** — you are redirected to the new group's detail page.
5. Click **Add Projects**, paste the list of Project IDs to include, and click **Add**.
6. Check the result: fix and re-add any **Not found** IDs with **Add more**.

### Changing which team owns a project group

1. Go to the group's detail page (click its name from the list).
2. In the left panel, find the **User Group** dropdown and select the new owning group.
3. Click **Update** to save.

### Removing a project that was incorrectly linked

1. Go to the group's detail page.
2. Find the project in the table and click the red trash icon (or tick several projects and click **Remove selected (N)**).
3. Click **Remove** to confirm.
4. The project disappears from the group's list. It remains in the system and can be added back or linked to a different group if needed.

### Finding groups for a specific team

1. On the Project Groups list page, click **Filter**.
2. Type the team's user group name in the **User Group** field.
3. Click **Apply** to see only groups owned by that team.

---

## Notes and Tips

- **Group names are not automatically unique** at the UI level — be consistent with naming conventions to avoid confusion.
- **The Number of Projects count** in the list page reflects the count from the last data load. After adding or removing projects on the detail page, go back to the list page to see the updated count.
- **Sorting is not available** on the project groups list. Use the Name filter to narrow the list when there are many groups.
- **Project IDs must be complete** in the Add Projects dialog; partial IDs come back as **Not found**. Letter case does not matter.
- **The Update button** on the detail page saves only the group metadata (Name, Description, User Group). Adding and removing projects takes effect immediately through **Add Projects** and **Remove**, without clicking Update.