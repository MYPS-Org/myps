# Program Management — User Manual

The **Programs** section lets you create, manage, and advance infrastructure programs through a defined approval pipeline. Each program groups related projects and moves through stages from proposal to publication.

---

## Navigating to Programs

Click **Programs** in the left navigation menu. The program list page opens.

---

## Program List Page

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Programs                                                               │
│                                              [🔍 Search] [Filters] [+ Add Program] │
├─────────────────────────────────────────────────────────────────────────┤
│  Name           │ Status   │ Type     │ Projects │ Start Year │ Actions │
├─────────────────────────────────────────────────────────────────────────┤
│  ▶ BP 2025      │ Working  │ Regular  │ 12       │ 2025       │ View 🗑 │
│  ▶ GAA 2024     │ Approved │ Regular  │ 45       │ 2024       │ View 🗑 │
└─────────────────────────────────────────────────────────────────────────┘
│  ◀ 1  2  3  ▶                                                           │
```

### Table Columns

| Column | Description |
|--------|-------------|
| **Name** | Program name — click to expand stage history |
| **Status** | Current workflow status (colored badge) |
| **Type** | Program type (Regular, Special, TF, etc.) |
| **No. of Projects** | Count of projects linked to this program, not counting deleted ones |
| **Start Year** | Program's starting fiscal year |
| **Actions** | View (opens detail) and Delete buttons |

### Status Badge Colors

| Color | Status |
|-------|--------|
| Orange | Working |
| Green | Approved |
| Yellow | Pending |
| Red | Rejected |
| Blue | Proposed |

---

## Searching and Filtering

### Quick Search (by Name)

1. Type in the search box (top-right of the table header).
2. Press **Enter** or click the blue **Search** button.
3. The list filters to programs whose name matches the text.
4. To clear, click the red **Clear** button (appears when a search is active).

### Advanced Filters

1. Click the yellow **Filters** button (funnel icon).
2. A dialog opens with three filter options:
   - **Start Year** — select a specific year from a dropdown
   - **Program Group** — select by group/region
   - **Program Stage** — filter by pipeline stage (BP, NEP, GAA, etc.)
3. Click **Apply Filters** to update the list, or **Clear** to reset all filters.
4. A small blue number badge on the Filters button shows how many filters are active.

> Search term and advanced filters work together — applying filters keeps your search term intact.

---

## Viewing Program Stages (Expand Row)

Click on a **program name** in the list to expand it and see all stages that program has passed through.

The expanded sub-table shows:

| Column | Description |
|--------|-------------|
| Stage Name | Pipeline stage (BP, NEP, GAA, etc.) |
| Type | Program type at that stage |
| Start Year | Year for that stage revision |
| Projects | Number of projects at that stage |
| Amount | Total cost at that stage (₱) |
| Actions | View Details button |

Click **View Details** to open that specific stage of the program.

Click the program name again to collapse the row.

---

## Adding a New Program

1. Click the blue **+ Add Program** button.
2. The **Add New Program** dialog opens.

### Add Program Form Fields

| Field | Description |
|-------|-------------|
| **Program Name** | Auto-generated from Stage + Start Year (e.g., "BP 2025") — cannot be typed directly |
| **Sub Name** | Optional extra label appended to the auto name (e.g., "Metro Manila") |
| **Stage** | Select the starting pipeline stage |
| **Year Start** | Starting fiscal year |
| **Program Type** | Regular, Special, TF, etc. |
| **Skip Reason** | Required if the selected stage requires a skip explanation |
| **User Groups** | Select one or more user groups that can access this program |
| **Data Security Access** | Select offices/organizations with data access |

> **TF programs:** Selecting Type = TF automatically sets the stage to the final stage and generates the name "TF{Year}".

3. Click **Submit** to create the program. You are taken to the new program's detail page automatically.

---

## Deleting a Program

1. Click the red **trash icon** next to a program in the list.
2. A confirmation dialog appears showing the program name.
3. Type **DELETE** (uppercase) in the confirmation box.
4. Click the **Delete Program** button to confirm.

> This action is permanent and cannot be undone.

---

## Program Detail Page

Click **View** on any program row to open the detail page.

### Layout Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Form: Name, Year, Type, Cost, Status, User Groups, Data Security]      │
│                                    │  [Map — Future Integration]         │
│  [Proceed to NEP] [Update]         │                                     │
├──────────────────────────────────────────────────────────────────────────┤
│  Projects                        [Publish] [Add Project] [Batch] [Actions]│
│  Project ID │ Description │ Category │ … │ Publishable │ Published       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Program Information Fields

| Field | Editable | Notes |
|-------|----------|-------|
| Name | No | Read-only |
| Start Year | No | Read-only |
| Program Type | Yes | Select from dropdown |
| Cost | No | Auto-calculated from the projects at the program's current stage; a deleted project does not count |
| Status | Yes | Editable only when program is active |
| User Groups | Yes | Checkbox list — search, select all, clear all |
| Data Security Access | Yes | Grouped by organization type |
| Created Date | No | |
| Created By | No | |

### Saving Changes

After editing any field, the **Update** button (green) becomes active. Click it to save changes.

> The Update button is disabled if nothing has changed.

---

## Advancing the Program Stage

When a program is ready to move to the next phase:

1. Click **Proceed to {Stage Name}** (blue button at the bottom of the form).
2. The **Proceed to Next Stage** dialog opens.

### Proceed to Next Stage Dialog

| Field | Description |
|-------|-------------|
| **Program Name** | Auto-filled from current name; updates when Year changes |
| **Sub Name** | Optional label appended to the name at the new stage |
| **Start Year** | Year for the new stage revision |

3. Review the target stage and name.
4. Click **Confirm** to advance. You are navigated to the new stage automatically.

> At certain stages (BP and NEP), a **Proceed to {Skip Stage}** button also appears, allowing you to jump two stages at once.

---

## Publishing a Program to PCMA

When a program is at the final stage (GAA) and its status is **Approved**:

1. A yellow **Publish Program** button appears in the Projects section header.
2. Click it to open the **Publish Program** confirmation dialog.
3. Review the warning: this will make the program available to other applications (PCMA).
4. Click **Publish to PCMA** to confirm.

---

## Managing Projects in a Program

### Adding a New Project

When a program is active and approved:

1. Click the blue **Add Project** button in the Projects section.
2. You are taken to the **Add Project** form with the program pre-selected.

### Adding an Existing Project

1. Click **Add Existing Project** (visible when the program is active and not yet at the final stage).
2. The **Add Existing Project** dialog opens showing all projects not yet in this program.
3. Search by Project ID, Description, Office, or Category.
4. Check the boxes next to the projects you want to add.
5. Click **Add Selected** to link them to this program.

---

## Actions Menu (Gear Icon)

Click the **⚙ Actions** dropdown in the Projects section header for these tools:

| Option | What it does |
|--------|-------------|
| **Download Template** | Downloads the Excel import template |
| **Import Projects** | Opens the import dialog to bulk-add projects from an Excel file |
| **Export Projects** | Exports all projects in this program to an Excel file |
| **Generate Reports** | Opens the **Reports** page with this program's year, stage and program already selected (shown only if you can open Reports) |

### Importing Projects from Excel

1. Click **Actions → Import Projects**.
2. Drag and drop your `.xlsm` file onto the drop zone, or click to browse.
3. The file is validated and parsed automatically.
4. Review the tabbed preview:
   - **Summary** — count of projects, funding rows, components, errors
   - **Projects** — one row per project
   - **Funding** — funding profiles
   - **Components** — component cost entries
   - **Cost / Year** — year-by-year cost breakdown
   - **Major Items** — major items of work
   - **Locations** — project locations
   - **Errors** — any validation problems found in the file
5. If there are errors, resolve them in the template and re-upload.
6. Click **Import** to submit the data.

> The import file must be the authorized MYPS template with STATUS = VALIDATED and the correct signature. Files that fail validation will show an error and cannot be imported.

### Exporting Projects

1. Click **Actions → Export Projects**.
2. A confirmation dialog appears.
3. Click **Export** to download an Excel file with all projects in this program and stage.

### Generating Reports

1. Click **Actions → Generate Reports**.
2. The **Reports** page opens with **Year**, **Program Stage** and this program already selected. A program is listed only at its current stage, so opened from an earlier stage it is not ticked.
3. Choose the **Report Type** and the remaining fields, then click **Generate Report**.

---

## Batch Actions (Tag Icon)

Click the **🏷 Batch Actions** dropdown to perform operations on multiple projects at once.

> Batch publish controls only appear when the program is at GAA stage and has Approved status.

### Batch Delete

1. Click **Batch Actions → Batch Delete**.
2. Enter the Project IDs to delete (comma, semicolon, space, or line-break separated).
3. Click **Delete Projects**.
4. A confirmation dialog appears — confirm to proceed.

A delete is **permanent only for a project still at the BP or RBP stage** (its BP/P Project ID is then given to the next new project). At any other stage the project is deleted at that stage only and can be restored. Published projects, and projects of an Approved program, are not deleted (Lump Sum itemized projects are always deleted permanently). The success message names only what happened.

### Delete One Project

Each row of the Projects table has a red trash icon in its **Actions** column. It deletes that one project with the same rules as Batch Delete: the **Delete Project** dialog shows whether the project will be deleted permanently, deleted at this stage only, or not deleted and why. Type **DELETE** and click **Yes, Delete Project**.

### Deleted Projects (Restore)

The **Deleted projects (N)** button next to **Batch Actions** lists the projects deleted at the program's current stage, with who deleted each one and when. Click **Restore** on a row, or tick rows and click **Restore selected**: the projects come back into the Projects table. A row that cannot be restored (published, or the program is Approved) says why. **Batch Actions → Batch Restore** still restores by typed Project IDs.

A project deleted before the program moved to its current stage stays deleted. It is listed under **Deleted at an earlier stage**, with the stage it was deleted at and a note that the program has moved on. **Restore into &lt;stage&gt;** adds it to the current stage with the data it had when deleted; the stages in between are skipped, and a BP Project ID becomes P at a P stage. Lump Sum projects, and projects whose ID now belongs to another project, cannot be restored this way.

### Restrict Publishing

Marks projects so they will **not** appear in published reports.

1. Click **Batch Actions → Restrict Publishing**.
2. Enter Project IDs.
3. Click **Restrict Publishing** and confirm.

### Allow Publishing

Marks projects as ready to be included in published reports.

1. Click **Batch Actions → Allow Publishing**.
2. Enter Project IDs.
3. Click **Mark as Ready to Publish** and confirm.

---

## Navigating to a Project

In the Projects table, click on a **Project ID** to go to that project's detail page.

---

## Tips

| Tip | Detail |
|-----|--------|
| Expand rows before clicking View | Expanding shows all stages; View Details in the sub-table opens the correct stage |
| Filters persist while paginating | Page through results without losing your filter settings |
| Stage affects available actions | Add Project and Publish buttons only appear at the right stage |
| Name is auto-generated | Program names follow a system convention — use Sub Name for custom labels |
| Update only enables when changes exist | If nothing changed, the Update button remains disabled |