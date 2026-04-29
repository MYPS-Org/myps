# Code Tables — User Manual

The **Code Tables** page is where administrators manage the system's reference and lookup data. Changes made here propagate immediately to project forms, funding profiles, revision workflows, and program management across the entire application.

---

## Accessing Code Tables

Navigate to **Code Tables** from the main menu. The page opens on the **Project Details** group by default.

---

## Layout Overview

The page uses a two-tier navigation system:

```
[Project Details] [Component Cost] [Major Item] [Funding Profile] [Revisions] [Programs] [Admin Areas]
         ↓  (secondary tabs appear when a group has more than one table)
[Category]  [Thrust]  [Agency]  [Origin]
```

- **Top row (primary tabs):** One pill button per group. The number badge shows how many tables are in that group.
- **Second row (secondary tabs):** Appears only when the active group has more than one table. Selecting a primary tab automatically switches to the first secondary tab in that group.

---

## Groups and Tables

### Project Details

Manages the dropdown values shown in the Project Details form.

| Tab | What it controls |
|-----|-----------------|
| Category | Project category options |
| Thrust | Thrust (program thrust) options, grouped by program |
| Agency | Implementing agency options |
| Origin | Project origin options |

### Component Cost

| Tab | What it controls |
|-----|-----------------|
| Cost Type | Cost component type codes used when entering component costs |

### Major Item

| Tab | What it controls |
|-----|-----------------|
| Work Category | Top-level groupings of work (scope of work categories) |
| Type of Work | Specific work types with unit of measure and quantity limits |
| Infrastructure Types | Infrastructure type codes used in major item locations |

### Funding Profile

| Tab | What it controls |
|-----|-----------------|
| Funding Agreement | Funding agreement records (Source Org, Code, Name, Financing Segment Code) |
| Funding Source | Funding source organizations (Local / Foreign) |

### Revisions

| Tab | What it controls |
|-----|-----------------|
| Categories | Revision category codes |
| Headers | Revision header codes |
| Documents | Revision document type codes |
| Reasons | Revision reasons with group and category associations |
| Statuses | Revision status codes |
| Rules | Field-level permission rules per revision reason (toggle UI) |
| Validation Dates | Revision submission window start/end dates per funding year |

### Programs

| Tab | What it controls |
|-----|-----------------|
| Program Stage | Pipeline stage options (e.g. BP, NEP, GAA) |
| Program Type | Program type classifications |
| Program Status | Program status values |

### Admin Areas

| Tab | What it controls |
|-----|-----------------|
| Regions | Region records (GDB ID, Name, Participant ID, Island Code) |
| Provinces | Province records linked to a Region |
| Cities/Municipalities | City records linked to a Province |
| Legislative Districts | District records linked to a Province |
| DEOs | District Engineering Office records linked to a Province and Region |

---

## Common Table Actions

Every table follows the same interaction pattern.

### Searching

Type in the **Search** box at the top-right of any table. The list filters as you type. Matching is case-insensitive and checks all key columns (e.g. Name, Code, ID). Some large tables (Cities, Districts, DEOs) also have a **parent-entity filter dropdown** (e.g. filter by Province) separate from the text search.

### Adding a Record

1. Click the **+ Add** button (indigo, top-right of the table).
2. A new row appears at the top of the table with an indigo left border. Fill in all required fields.
3. Click the **✓ (check)** button in the row to open the **Confirmation Dialog**.
4. Review the field summary shown in the dialog.
5. Click **Confirm Add** to save, or close the dialog to cancel without saving.

> Required fields must be filled before the ✓ button becomes active.

### Editing a Record

1. Click the **pencil (edit)** icon on any row.
2. The row switches to edit mode with an amber left border. Update the fields as needed.
3. Click the **✓ (check)** button (amber) to open the **Confirmation Dialog**.
4. Review the changes in the dialog.
5. Click **Save Changes** to save, or close the dialog to discard edits.
6. Click the **✗ (cancel)** button to exit edit mode without saving.

> Only one row can be in edit mode at a time.

### Deleting a Record

Click the **red trash** icon on a row. Depending on the table:

- **Most tables:** A confirmation dialog appears immediately asking you to confirm the deletion.
- **Revision tables (Categories, Headers, Documents, Statuses):** An inline confirmation row appears below the row. Confirm or cancel there.

> Deletions cannot be undone from the UI. Confirm carefully before proceeding.

### Pagination

Large tables are paginated. Use the **Previous / Next** buttons (or page number buttons) at the bottom of the table to navigate. Default page size is **15 rows**; Cities, Districts, and DEOs show **20 rows** per page.

---

## Confirmation Dialog

When adding or editing a record, a modal dialog displays a summary of the values about to be saved.

| Element | Meaning |
|---------|---------|
| Green icon + "Add New …" heading | You are creating a new record |
| Amber icon + "Save Changes to …" heading | You are updating an existing record |
| Field rows | Each field and its new value. Monospace badges indicate IDs or codes. "empty (optional)" means an optional field was left blank. |
| **Confirm Add** / **Save Changes** button | Submits the request to the server |
| Spinner on button | Request is in-flight; wait for it to complete |

Close the dialog with the **✗** button or by clicking outside to cancel without saving.

---

## Revision Rules (Field Permission Editor)

The **Rules** tab under **Revisions** is a specialized editor for controlling which project fields can be edited during a revision, and whether child records (Component Cost items, Funding Profile rows, etc.) can be added or deleted.

### Reading the Table

Each row represents a **revision reason**. Columns include:

| Column | Meaning |
|--------|---------|
| Reason | The revision reason text |
| PCMA Status | PCMA package status filter for this rule |
| Package Status | Package status filter for this rule |
| View Rules | Expand an inline read-only toggle panel |
| Actions | Edit (pencil) and Delete (trash) |

### Viewing Field Rules

Click **View Rules** on any row to expand a collapsible panel showing all field toggles for that reason. The panel is **read-only** in view mode.

- **Indigo toggle (on):** This field is editable during the revision.
- **Gray toggle (off):** This field is locked (cannot be changed).

The panel is organized into six sections. Each section header shows a summary: `editable count / total fields · Can Add · Can Delete`.

| Section | Toggle type |
|---------|------------|
| Project Details | Field-level boolean toggles only |
| Component Cost | Field toggles + Can Add / Can Delete |
| Component Cost Year | Field toggles + Can Add / Can Delete |
| Major Item of Work | Field toggles + Can Add / Can Delete |
| Major Item Location | Field toggles + Can Add / Can Delete |
| Funding Profile | Field toggles + Can Add / Can Delete |

### Editing Field Rules

1. Click the **pencil** icon on the row you want to edit.
2. The row expands into full edit mode: all toggles become interactive.
3. Click any toggle to switch it on or off.
4. Click the **✓ (check)** button when done to open the Confirmation Dialog.
5. Confirm to save. The page reloads rule data from the server after saving.

---

## Admin Areas

Admin area tables manage the geographic reference data used throughout the system. The tables are hierarchically related:

```
Region
  └── Province
        ├── City / Municipality
        ├── Legislative District
        └── DEO (District Engineering Office)
```

### Relationship dropdowns

When adding or editing a **Province**, a **Region** dropdown lets you select the parent region. The region name is auto-filled from the selection.

When adding or editing a **City**, **Legislative District**, or **DEO**, a **Province** dropdown lets you select the parent province. Province name is auto-filled. For DEOs, a **Region** dropdown is also shown.

### Province filter

The **Cities**, **Legislative Districts**, and **DEOs** tables include a **Province filter** dropdown above the table. Selecting a province narrows the list to records belonging to that province. Select "All Provinces" to clear the filter.

---

## Tips and Notes

- **Data updates are live.** After any successful add, edit, or delete, the table automatically re-fetches data from the server to stay in sync with backend-assigned IDs.
- **Loading state.** A "Loading…" placeholder appears in the table while data is being fetched. Wait for it to complete before interacting.
- **Error banners.** If the initial data load fails, an error banner appears with a **Retry** link. Click Retry to attempt the fetch again.
- **Toast notifications.** A small notification appears at the corner of the screen after every save or delete confirming success or reporting an error.
- **Validation Dates** (under Revisions → Validation Dates) currently uses local sample data. API integration is pending; changes made here are not persisted to the server.
- **Legacy tables** (Implementation Mode, Emergency Mode, Row Available, Feasibility, Detailed Design, Region-Wide) exist in the codebase but are not exposed in the current navigation. They may appear in a future update.
