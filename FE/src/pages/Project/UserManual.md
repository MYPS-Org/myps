# Project Module — User Manual

## Overview

The **Project** module is where you create, view, and manage individual infrastructure projects. Each project belongs to a **Program** and goes through pipeline stages (BP, NEP, GAA, etc.). This manual covers everything from finding an existing project to filling in all sections of the project form.

---

## Table of Contents

1. [Navigating to the Project List](#1-navigating-to-the-project-list)
2. [Searching for a Project](#2-searching-for-a-project)
3. [Viewing Stage History](#3-viewing-stage-history)
4. [Adding a New Project](#4-adding-a-new-project)
5. [Editing an Existing Project](#5-editing-an-existing-project)
6. [Form Sections — Detailed Guide](#6-form-sections--detailed-guide)
   - [6.1 Project Location Map](#61-project-location-map)
   - [6.2 Program Details](#62-program-details)
   - [6.3 Project Details](#63-project-details)
   - [6.4 Component Cost](#64-component-cost)
   - [6.5 Major Items of Work](#65-major-items-of-work)
   - [6.6 Funding Profile](#66-funding-profile)
   - [6.7 Supporting Documents](#67-supporting-documents)
   - [6.8 Activity Log](#68-activity-log)
7. [Saving a New Project](#7-saving-a-new-project)
8. [Updating an Existing Project](#8-updating-an-existing-project)
9. [Validation Errors and How to Fix Them](#9-validation-errors-and-how-to-fix-them)
10. [Importing a Lump Sum Project](#10-importing-a-lump-sum-project)
11. [Creating a Revision](#11-creating-a-revision)
12. [Unlocking a Project](#12-unlocking-a-project)
13. [Frequently Asked Questions](#13-frequently-asked-questions)

---

## 1. Navigating to the Project List

1. In the left navigation sidebar, click **Projects**.
2. The project list loads automatically, showing the most recent page of projects.

The list columns are:

| Column | Description |
|---|---|
| Project ID | Unique identifier; click the row to expand stage history |
| Description | Project name / description |
| Category | Infrastructure category |
| Region | Geographic region |
| Actions | **View** button — opens the project detail form |

---

## 2. Searching for a Project

1. In the search bar at the top of the list, type a **Project ID** (full or partial).
2. Press **Enter** or click the **Search** button.
3. The list refreshes showing only matching results.
4. To clear the search, click the **X** (clear) button that appears next to the search bar.

> **Note:** Search is by Project ID only, not by description or region.

---

## 3. Viewing Stage History

Each project row in the list can be expanded to show its revision history across pipeline stages.

1. Click anywhere on a project row (the row with the Project ID).
2. A sub-table appears below showing all stages and revision numbers for that project.
3. You can expand **multiple rows** at the same time.
4. Click the same row again to collapse it.

The stage history shows:
- Stage name (BP, NEP, GAA, etc.)
- Revision number
- Publication status

---

## 4. Adding a New Project

### Starting from the Project List

1. Click the **Add Project** button (top-right of the project list).
2. You will be taken to the Add Project form.

### Starting from a Program

1. You may also arrive at the Add Project form from within a Program, with the program pre-selected.

### Form is Empty

When adding a new project, all sections start empty. You must:
- Select a Program (required)
- Fill in all required Project Details fields
- (Optionally) add Component Costs, Major Items, Funding Profile, and Documents

### Saving

After filling in all required information, click **Save Project** (top-right of the form). See [Section 7](#7-saving-a-new-project) for the full save flow.

---

## 5. Editing an Existing Project

### Opening the Edit Form

1. From the project list, click the **View** button on any project row.
2. The edit form opens, pre-populated with all saved data.

### What You Can Edit

You can edit any field that is not greyed out (read-only). Fields that are always read-only in edit mode:
- Program Name, Program Type, Program Stage, Start Year (shown in the Program Details panel)

### When a Project Is Read-Only

The entire form becomes read-only (all fields greyed out and buttons hidden) when:
- The project is **inactive** (`IsActive = false`), or
- The project is at **GAA stage and is published** (StageId = 10, Status = 1 — use Revise instead)

---

## 6. Form Sections — Detailed Guide

The project form is divided into collapsible sections. Click any section header to expand or collapse it.

---

### 6.1 Project Location Map

- Shows the project's infrastructure locations on an interactive map (GeoJSON overlay).
- The map is only visible when editing an existing project that already has work locations saved.
- Click the **Project Location Map** header to expand or collapse the map panel.
- The map is read-only — you edit location coordinates in the Major Items of Work section.

---

### 6.2 Program Details

**Add mode:**
- A dropdown shows all available programs (GAA-R programs are excluded).
- Selecting a program auto-fills: Program Type, Start Year, Program Stage.
- You cannot change the program after the project is saved.

**Edit mode:**
- Program details are displayed as read-only fields.
- Displayed fields: Program Name, Program Type, Start Year, Program Stage.

---

### 6.3 Project Details

This section contains all the core fields that describe the project. Required fields are marked and will show an error if left blank when saving.

#### Identification Fields

| Field | Description |
|---|---|
| **Description** | Full name/description of the project (required) |
| Alternate ID | Alternative reference identifier |
| External ID | External system identifier |
| MYCA Approval Date | Date of MYCA approval |
| UACS | Unified Accounts Code Structure code |

#### Classification Fields

| Field | Description |
|---|---|
| **Category** | Infrastructure category (required, select from dropdown) |
| **Thrust** | Program thrust/priority (required, select from dropdown) |
| **Origin** | Origin of the project (required, select from dropdown) |
| **Agency** | Implementing agency (required, select from dropdown) |
| **Implementation Mode** | How the project will be implemented (required) |
| Emergency Mode | Emergency classification (optional) |
| Tier | Project tier (required) |
| Rank | Priority rank (optional) |

#### Geographic / Office Fields (Cascading Dropdowns)

These fields are linked — selecting one filters the options of the others below it.

| Field | Description | Cascade Rule |
|---|---|---|
| **Province** | Province where project is located (required) | Selecting province filters City, LD, DEO |
| **City / Municipality** | City or municipality (required) | Selecting city auto-sets Province |
| **Legislative District** | Legislative district (required) | Filtered by Province |
| **DEO** | District Engineering Office (required) | Filtered by Province |
| **Implementing Office (IO)** | Responsible office (required) | Filtered by DEO — shows regional offices and UPMO |
| **Operating Unit (OU)** | Operating unit (required) | Filtered by IO selection |
| **Region** | Region code (required) | Select from dropdown |

> **Tip:** Always select Province first — this gives the most accurate filtered choices for City, LD, DEO, IO, and OU.

#### Engineering Fields

| Field | Description |
|---|---|
| Feasibility | Feasibility study status |
| Feasibility Date | Date of feasibility completion |
| Detailed Design | Detailed design status |
| Detailed Design Date | Date of detailed design completion |
| Row Available | Right-of-way availability status |
| Region Wide | Whether the project is region-wide |

---

### 6.4 Component Cost

This section lists the budget components allocated for the project.

#### Adding a Component

1. Click **Add Component**.
2. In the dialog that opens:
   - **Component Type** — Select the type (e.g., Civil Works, ROW).
   - **Component** — Select the specific component (filtered by type).
   - **Description** — Enter a description. You can click the **sparkle icon** (AI auto-fill) to automatically generate a description based on the component.
   - **Total** — Enter the total cost in Philippine Pesos (₱).
   - **Per-Year Costs** — Click **Add Year** to break down the total cost per year. Each year entry has: Year, Amount, Start Date, End Date.
3. Click **Save** to add the component.

#### Budget Indicator

Below the component list is a budget status bar showing **Total Cost** vs. the program's maximum budget:

| Indicator | Meaning |
|---|---|
| Blue | Total cost below 75% of budget |
| Yellow | Total cost is 75–89% of budget |
| Orange | Total cost is 90–99% of budget (near limit) |
| Green | Total cost equals 100% of budget (perfect match) |
| Red | Total cost exceeds the budget |

> **Note:** You can still save components that exceed the budget — the system will warn you and ask you to confirm.

#### Editing a Component

Click the **pencil icon** on any row to open the edit dialog.

#### Deleting a Component

1. Click the **trash icon** on the component row.
2. A confirmation dialog shows how many **Major Items of Work** will also be removed (cascade delete).
3. Click **Confirm Delete** to proceed.

> **Warning:** Deleting a component will also delete all Major Items of Work and their work locations that are linked to that component.

---

### 6.5 Major Items of Work

This section defines the specific work activities for each component, including the locations where work will be done.

#### Adding a Major Item

1. Click **Add Major Item**.
2. In the dialog:
   - **Component** — Select from the components you defined in Section 6.4.
   - **Year of Work** — The year this work will be performed (defaults to program start year).
   - **Infrastructure Type** — Select the type of infrastructure (e.g., National Road, National Bridge, Local Road).
   - **Type of Work** — Select the specific scope of work (filtered by Infrastructure Type).
3. Click **Save** to add.

> **Note for ROW components:** If you select a ROW component, Infrastructure Type and Type of Work are automatically limited to ROW-applicable options only.

#### Expanding a Major Item Row

- Click the arrow icon on any major item row to expand it and see its **Work Locations**.
- Click again to collapse.

#### Work Locations

Each major item can have one or more work locations (the specific road sections or bridges where work occurs).

##### Adding a Work Location

1. Click **Add Location** inside an expanded major item row.
2. In the Add Infrastructure dialog:
   - **Road tab:** Search for a road section by ID or name.
   - **Bridge tab:** Select a road section first, then select a bridge.
   - Select a row, then click **Confirm**.
3. Back in the work location row, fill in:

| Field | Description |
|---|---|
| **Detailed Scope** | Specific description of work at this location (required, must be unique within the major item) |
| Physical Target | Numeric target quantity |
| **Length** | Length of work (km or meters, depending on infrastructure type) |
| Start Chainage | Starting chainage marker (required for national roads) |
| End Chainage | Ending chainage marker (required for national roads; must be > Start Chainage) |
| Start Station Limit | Description of start point |
| End Station Limit | Description of end point |
| Start X / Start Y | GPS coordinates of starting point (must be within Philippine bounds) |
| End X / End Y | GPS coordinates of ending point (must be within Philippine bounds) |

> **Chainage rules for National Roads:** End Chainage must be greater than Start Chainage. Both are required.

> **Coordinate bounds:** Longitude (X): 116.67° to 126.60°. Latitude (Y): 4.67° to 21.17°. Coordinates outside these bounds will trigger a validation error.

##### Duplicate Scope Warning

If you enter the same **Detailed Scope** with identical chainages and station limits as another location in the same major item, the system will show a validation error when you try to save. Each location must have a unique combination of Detailed Scope + Start Chainage + End Chainage + Start Station Limit + End Station Limit.

#### Editing a Major Item

Click the **pencil icon** on a major item row to modify its Component, Year, Infrastructure Type, or Type of Work.

#### Deleting a Major Item

1. Click the **trash icon** on a major item row.
2. The confirmation dialog shows how many **work locations** will also be deleted.
3. Click **Confirm Delete**.

---

### 6.6 Funding Profile

This section records the funding sources for the project.

#### Adding a Funding Entry

1. Click **Add Funding**.
2. A new row appears in the table. Fill in:
   - **Source** — Funding source (e.g., GAA, ODA, LGU) — select from dropdown.
   - **Agreement** — Agreement type (e.g., Loan, Grant) — select from dropdown.
   - **Amount** — Enter the funding amount in Philippine Pesos (₱).
3. The **Percentage** column is automatically calculated: `Amount / Total Amount × 100%`.

#### Total Percentage Indicator

- **Green:** Total percentage equals 100% (valid).
- **Yellow:** Total is less than 100% (remaining percentage shown).
- **Red:** Total exceeds 100% (overage shown).

> **Important:** The total funding percentage must equal exactly 100% (±0.03% tolerance) before you can save an update. If it is not 100%, the system will block saving and show an error.

#### Deleting a Funding Entry

Click the **trash icon** on the row you want to remove. The percentages of remaining rows automatically recalculate.

---

### 6.7 Supporting Documents

This section lets you attach PDF documents to the project (e.g., feasibility study, design drawings, approvals).

#### Uploading a Document

1. Click **Add Document**.
2. In the dialog:
   - **Document Type** — Select the type (e.g., Feasibility Study, Design Plan).
   - **Description** — Optional description of the file.
   - **File** — Click to browse and select a **PDF file** (PDF only; other file types are rejected).
3. Click **Upload** to save.

The document appears in the table with:
- File name (clickable link — opens the file in a new tab)
- Document Type
- Description
- Upload date

#### Deleting a Document

Click the **trash icon** on any document row. This immediately deletes the file from the server.

> **Note:** Document deletion is immediate and cannot be undone.

---

### 6.8 Activity Log

The activity log shows a timeline of all changes made to the project, including who made the change and when.

- **Filter bar:** Click **All**, **Created**, **Updated**, or **Deleted** to filter by action type.
- Each entry shows:
  - Action type (colour-coded badge: green=created, blue=updated, red=deleted)
  - Relative time (e.g., "2h ago")
  - Full timestamp (hover over the relative time)
  - User who made the change
  - Fields that were changed (expandable JSON diff view)

This section is read-only.

---

## 7. Saving a New Project

1. Fill in all required fields in the **Project Details** section (see Section 6.3 for required fields).
2. Optionally complete other sections (Component Costs, Major Items, Funding, Documents).
3. Click **Save Project** (top-right of the form).
4. A confirmation dialog appears: **"Are you sure you want to save this new project?"**
5. Click **Save Project** to confirm.

### What Happens After Saving

- The system creates the project and assigns a **Project ID**.
- You are automatically redirected to the **Edit view** of the newly created project.
- You can then continue editing all sections including Component Costs, Major Items, and Funding Profile.

### "Proceed with Caution" Dialog

In some cases, after clicking **Save Project**, the system may show a **"Proceed with Caution"** warning dialog instead of saving immediately. This happens when the backend detects a potential issue (e.g., a similar project already exists).

- Read the warning message carefully.
- Click **Cancel** to go back and review your data.
- Click **Yes, Proceed Anyway** to save despite the warning.

---

## 8. Updating an Existing Project

1. Make any desired changes in any section.
2. Click **Update Project** (orange button, top-right of the form).
3. The system runs **validation checks** (see Section 9).
4. If all checks pass, a confirmation dialog appears.
5. Click **Update Project** to confirm.
6. On success, the page reloads with the latest saved data.

### "Proceed with Caution" Dialog

Same as during Add — if the backend returns a warning, the Proceed dialog will appear. You may choose to proceed or cancel.

### When "Update Project" is Not Visible

The Update Project button is hidden when:
- The project is inactive (read-only mode)
- The project is published at GAA stage (use **Revise Project** instead)

---

## 9. Validation Errors and How to Fix Them

When you try to save or update, the system checks for errors. Errors are shown as **toast notifications** (small pop-up messages, usually in red at the top-right of the screen).

### Required Field Errors (Shown All at Once)

These appear when mandatory fields are missing:

| Error Message | How to Fix |
|---|---|
| "Program ID is required" | Select a program in the Program Details section |
| "Description is required" | Enter a project description |
| "Category is required" | Select a category from the dropdown |
| "Thrust is required" | Select a thrust/priority |
| "Origin is required" | Select the project origin |
| "Province is required" | Select a province |
| "City is required" | Select a city or municipality |
| "Legislative District is required" | Select a legislative district |
| "Operating Unit is required" | Select an operating unit |
| "Implementing Office is required" | Select an implementing office |
| "DEO is required" | Select a DEO |
| "Region is required" | Select a region |
| "Agency is required" | Select an agency |
| "Implementation Mode is required" | Select an implementation mode |

### Business Rule Errors (Edit Mode Only)

These appear when the data does not pass the system's business rules:

| Error Message | How to Fix |
|---|---|
| "Funding percentage total must equal 100%" | Adjust funding amounts so percentages add up to 100% |
| "Total component cost does not match the program budget" | Adjust component totals to match the program's maximum cost |
| "Duplicate Detailed Scope ... at locations X and Y" | Change the Detailed Scope text (or chainages) so no two locations in the same major item are identical |
| "Location X: Length must be greater than 0" | Enter a valid length greater than zero |
| "Start X coordinate ... out of valid range" | Enter a longitude between 116.67 and 126.60 (Philippine range) |
| "Start Y coordinate ... out of valid range" | Enter a latitude between 4.67 and 21.17 (Philippine range) |
| "End X/Y coordinate ... out of valid range" | Same as above for end coordinates |

---

## 10. Importing a Lump Sum Project

The Import feature is available for **Lump Sum** projects (Project IDs ending in "LS") that are not yet at the published GAA stage.

### When Is This Button Visible?

The **Itemized Lump Sum** button (with an upload icon) appears at the top-right of the edit form when:
- You are editing an existing project
- The Project ID ends with "LS"
- The project has not yet reached the final published stage

### How to Import

1. Click the **Itemized Lump Sum** button.
2. The Import dialog opens.
3. **Drag and drop** your `.xlsx` file into the upload area, or click to **browse** for the file.
4. The system parses the file and shows a preview with multiple tabs:
   - **Summary** — Total rows found by category
   - **Projects** — Project detail rows
   - **Funding** — Funding profile rows
   - **Components** — Component cost rows
   - **Cost Per Year** — Per-year cost breakdown
   - **Major Items** — Major items of work
   - **Major Locations** — Work locations
   - **Errors** — Any parse errors found
5. Review the data in each tab. If there are errors, the **Errors** tab opens automatically — fix the Excel file and re-upload.
6. When the data looks correct, click **Submit**.
7. On success, the page reloads with the imported data applied.

> **Important:** The import replaces existing data in the affected sections. Review the preview carefully before submitting.

---

## 11. Creating a Revision

Revisions are only available for projects at the **published GAA stage** (the final stage).

### When Is Revision Available?

The **Revise Project** button (yellow dropdown) appears at the top-right when the project is published and at the final pipeline stage.

### How to Create a Revision

1. Click **Revise Project** to open the dropdown.
2. Select a **revision type** (e.g., Minor Revision, Major Revision) from the list.
3. The Revision dialog opens.
4. Select a **Category** (if applicable for the revision type).
5. Select a **Reason** from the filtered list.
6. Click **Submit**.
7. You will be navigated to the revision/modification workflow.

> **Note:** Both Category and Reason selections are required. The available options change depending on which revision type you selected.

---

## 12. Unlocking a Project

If a project is **locked** (IsUnlock = true), the **Unlock Project** button appears at the top-right.

- Click **Unlock Project** to unlock it for editing.

> The Unlock feature is only visible in edit mode, when the project is active and not at the final published stage.

---

## 13. Frequently Asked Questions

**Q: I can't find a project in the list. What should I do?**
Use the search box at the top to search by Project ID. If you still can't find it, it may be in a different stage or the search might need to be more specific.

---

**Q: Why are some dropdown options greyed out or empty?**
Many dropdowns (City, Legislative District, DEO, IO, OU) depend on your selection in previous fields. For example, if no Province is selected, the City dropdown will show no options. Always fill in Province first, then move down the hierarchy.

---

**Q: The "Update Project" button is missing. Why?**
The button is hidden if the project is inactive or if it is at the published GAA stage. If the project is published, use **Revise Project** instead.

---

**Q: I deleted a component cost and now some Major Items of Work disappeared. Is this expected?**
Yes. Deleting a component cost automatically removes all Major Items of Work that are linked to that component, along with all their work locations. The system warns you how many major items will be affected before you confirm the delete.

---

**Q: I entered coordinates but the system says they are out of range.**
Coordinates must be within the Philippine bounding box: Longitude (X) between 116.67° and 126.60°, Latitude (Y) between 4.67° and 21.17°. Make sure you have not swapped X and Y (longitude and latitude).

---

**Q: Why is the funding percentage not adding up to 100%?**
The percentage is calculated automatically from the amounts you enter. To reach 100%, the sum of all active funding amounts must be set correctly. Check that no rows have a zero or blank amount. The percentage indicator at the top of the funding table shows how close you are to 100%.

---

**Q: I see a "Proceed with Caution" dialog when trying to save. What does this mean?**
The backend has detected a potential duplicate or issue with the project you are trying to save. Read the warning message carefully. You can cancel and review your data, or proceed anyway if you are confident the project is correct.

---

**Q: What file types can I upload as supporting documents?**
Only **PDF files** are accepted. Other file types (Word, Excel, images, etc.) will be rejected with an error message.

---

**Q: Can I edit a project after it is published?**
Published projects (at GAA stage) cannot be directly edited. You must create a **Revision** using the Revise Project button, which initiates a controlled change process.