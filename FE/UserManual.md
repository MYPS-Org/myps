# MYPS User Manual

> **Last Updated:** April 29, 2026
> **Version:** 1.0

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Global Search](#2-global-search)
- [3. Programs](#3-programs)
- [4. Projects](#4-projects)
- [5. Project Groups](#5-project-groups)
- [6. Project Modification](#6-project-modification)
- [7. Infrastructure Administration (RBIA)](#7-infrastructure-administration-rbia)
- [8. Code Tables](#8-code-tables)
- [9. User Management (RBAC)](#9-user-management-rbac)

---

## 1. Introduction

**MYPS** (Multi-Year Planning and Scheduling) is the central platform for managing infrastructure programs and projects across the road network. It covers the full lifecycle — from initial program proposals through budget approvals, project planning, revision tracking, and final publication to partner systems such as PCMA.

The system is organized around the following main modules:

| Module | Purpose |
|--------|---------|
| **Programs** | Create and advance infrastructure programs through pipeline stages (BP, NEP, GAA) |
| **Projects** | Create, edit, and manage individual infrastructure projects within a program |
| **Project Groups** | Organize projects into named collections owned by specific user groups |
| **Modification** | Request, review, and approve changes to published projects |
| **Infrastructure Administration (RBIA)** | Manage the future road network inventory: roads, road sections, and bridges |
| **Code Tables** | Manage all system reference and lookup data |
| **User Management** | Control user accounts, groups, and permissions |
| **Global Search** | Search across projects, programs, and infrastructure records instantly |

Access to each module is controlled by **Role-Based Access Control (RBAC)**. If a module does not appear in your navigation sidebar, contact your system administrator to request access.

---

## 2. Global Search

**Global Search** lets you find any project, program, or infrastructure record instantly from anywhere in the application — without leaving the page you are on.

### Opening Global Search

Click the **magnifying glass icon (🔍)** in the top navigation bar. A search dialog opens as an overlay on top of the current page.

---

### The Search Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  🔍  Global Search                                      [✕]  │
├──────────────────────────────────────────────────────────────┤
│  Search By                Value                  [🔍 Search] │
│  [ Select category… ▼ ]   [ Enter search value… ]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Results appear here                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Section | Purpose |
|---------|---------|
| **Search By** dropdown | Choose what type of record to search for |
| **Value** input | Type the text you want to find |
| **Search** button | Run the search |
| **Results area** | Scrollable table of matching records |

---

### Step-by-Step: Running a Search

**Step 1 — Choose a Category**

Click the **Search By** dropdown. Available categories:

| Category | Finds records by… | Example values |
|----------|-------------------|----------------|
| **Project ID** | The project's unique ID | `2024`, `DPWH-001` |
| **Alternate ID** | An alternate project identifier | `ALT-2024` |
| **Description** | Words in the project description | `road construction`, `bridge` |
| **UACS** | Unified Accounts Code Structure code | `2122`, `212202000` |
| **Program Name** | Name of a program | `infrastructure`, `DPWH` |
| **Roads** | Road name | `national highway`, `marcos` |
| **Road Section** | Road section identifier | `RS-001` |
| **Bridge** | Bridge name | `marcos bridge`, `pasig` |

**Step 2 — Enter a Value**

Type your search term. Partial matches work; search is case-insensitive. The Value field is disabled until you select a category.

**Step 3 — Click Search**

Click the blue **Search** button. Both a category and a value must be entered before the button activates.

---

### Reading the Results

**Project categories** (Project ID, Alternate ID, Description, UACS) return: `ProjectId`, `Description`, `ProgramName`, `StageName`, `Region`

**Program Name** returns: `ProgramId`, `Name`, `StageName`, `YearStart`, `Status`

**Roads** returns: `RoadId`, `RoadName`, `Region`, `Length`

**Road Section** returns: `RoadSectionId`, `RoadName`, `Region`, `RoadLength`

**Bridge** returns: `BridgeId`, `BridgeName`, `Region`, `Length`

A summary line above the table shows the match count. If exactly **50 rows** appear, a notice is shown: *(capped at 50 — refine your search)*. Add more characters to narrow results.

---

### Going to a Record

For **Project ID**, **Alternate ID**, **Description**, **UACS**, and **Program Name**, each result row has a **View ↗** button. Click it to open the record's detail page — the dialog closes automatically.

> Roads, Road Section, and Bridge do not have a View link yet.

---

### Closing the Dialog

Click the **✕** button or click the dark backdrop outside the dialog. All state is cleared on close.

---

### Tips

| Tip | Detail |
|-----|--------|
| Partial search works | Type `2024` to find all records with "2024" in the ID |
| Broad first, then narrow | Start short; add characters if the 50-result cap appears |
| Case does not matter | All searches are case-insensitive |
| Category change clears results | Switching categories resets the value and results table |

---

## 3. Programs

The **Programs** section lets you create, manage, and advance infrastructure programs through a defined approval pipeline. Each program groups related projects and moves through stages from proposal to publication.

### Navigating to Programs

Click **Programs** in the left navigation menu.

---

### Program List Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Programs                                                               │
│                                 [🔍 Search] [Filters] [+ Add Program]  │
├─────────────────────────────────────────────────────────────────────────┤
│  Name         │ Status   │ Type    │ Projects │ Start Year │ Actions    │
├─────────────────────────────────────────────────────────────────────────┤
│  ▶ BP 2025    │ Working  │ Regular │ 12       │ 2025       │ View 🗑    │
│  ▶ GAA 2024   │ Approved │ Regular │ 45       │ 2024       │ View 🗑    │
└─────────────────────────────────────────────────────────────────────────┘
│  ◀ 1  2  3  ▶                                                           │
```

#### Table Columns

| Column | Description |
|--------|-------------|
| **Name** | Program name — click to expand stage history |
| **Status** | Current workflow status (colored badge) |
| **Type** | Program type (Regular, Special, TF, etc.) |
| **No. of Projects** | Count of projects linked to this program |
| **Start Year** | Program's starting fiscal year |
| **Actions** | View (opens detail) and Delete buttons |

#### Status Badge Colors

| Color | Status |
|-------|--------|
| Orange | Working |
| Green | Approved |
| Yellow | Pending |
| Red | Rejected |
| Blue | Proposed |

---

### Searching and Filtering

**Quick Search (by Name):** Type in the search box and press **Enter** or click **Search**. Click **Clear** to reset.

**Advanced Filters:** Click the yellow **Filters** button to filter by:
- **Start Year** — select a specific year
- **Program Group** — select by group/region
- **Program Stage** — filter by pipeline stage (BP, NEP, GAA, etc.)

Click **Apply Filters** to update the list, or **Clear** to reset. A blue number badge on the Filters button shows how many filters are active. Search and filters work together.

---

### Viewing Program Stages (Expand Row)

Click on a **program name** to expand it and see all stages that program has passed through.

| Column | Description |
|--------|-------------|
| Stage Name | Pipeline stage (BP, NEP, GAA, etc.) |
| Type | Program type at that stage |
| Start Year | Year for that stage revision |
| Projects | Number of projects at that stage |
| Amount | Total cost at that stage (₱) |
| Actions | View Details button |

Click **View Details** to open that specific stage. Click the program name again to collapse.

---

### Adding a New Program

1. Click the blue **+ Add Program** button.
2. Fill in the **Add New Program** dialog:

| Field | Description |
|-------|-------------|
| **Program Name** | Auto-generated from Stage + Start Year (e.g., "BP 2025") — read-only |
| **Sub Name** | Optional extra label appended to the auto name |
| **Stage** | Select the starting pipeline stage |
| **Year Start** | Starting fiscal year |
| **Program Type** | Regular, Special, TF, etc. |
| **Skip Reason** | Required if the selected stage requires a skip explanation |
| **User Groups** | Select one or more user groups that can access this program |
| **Data Security Access** | Select offices/organizations with data access |

> **TF programs:** Selecting Type = TF automatically sets the stage to the final stage and generates the name "TF{Year}".

3. Click **Submit**. You are taken to the new program's detail page automatically.

---

### Deleting a Program

1. Click the red **trash icon** next to a program in the list.
2. A confirmation dialog appears showing the program name.
3. Type **DELETE** (uppercase) in the confirmation box.
4. Click **Delete Program** to confirm.

> This action is permanent and cannot be undone.

---

### Program Detail Page

Click **View** on any program row to open the detail page.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Form: Name, Year, Type, Cost, Status, User Groups, Data Security]      │
│                                    │  [Map — Future Integration]         │
│  [Proceed to NEP] [Update]         │                                     │
├──────────────────────────────────────────────────────────────────────────┤
│  Projects          [Publish] [Add Project] [Batch] [Actions]             │
│  Project ID │ Description │ Category │ … │ Publishable │ Published       │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Program Information Fields

| Field | Editable | Notes |
|-------|----------|-------|
| Name | No | Read-only |
| Start Year | No | Read-only |
| Program Type | Yes | Select from dropdown |
| Cost | No | Auto-calculated from linked projects |
| Status | Yes | Editable only when program is active |
| User Groups | Yes | Checkbox list — search, select all, clear all |
| Data Security Access | Yes | Grouped by organization type |
| Created Date | No | |
| Created By | No | |

After editing any field, the **Update** button (green) becomes active. Click it to save changes.

---

### Advancing the Program Stage

1. Click **Proceed to {Stage Name}** (blue button at the bottom of the form).
2. In the **Proceed to Next Stage** dialog, fill in:

| Field | Description |
|-------|-------------|
| **Program Name** | Auto-filled; updates when Year changes |
| **Sub Name** | Optional label at the new stage |
| **Start Year** | Year for the new stage revision |

3. Click **Confirm** to advance.

> At BP and NEP stages, a **Proceed to {Skip Stage}** button also appears, allowing you to jump two stages at once.

---

### Publishing a Program to PCMA

When a program is at the final stage (GAA) and its status is **Approved**:

1. A yellow **Publish Program** button appears in the Projects section header.
2. Click it to open the **Publish Program** confirmation dialog.
3. Review the warning — this makes the program available to PCMA.
4. Click **Publish to PCMA** to confirm.

---

### Managing Projects in a Program

#### Adding a New Project

When a program is active and approved, click the blue **Add Project** button to go to the Add Project form with the program pre-selected.

#### Adding an Existing Project

1. Click **Add Existing Project**.
2. Search by Project ID, Description, Office, or Category.
3. Check the boxes next to the projects you want to add.
4. Click **Add Selected** to link them.

---

### Actions Menu (Gear Icon)

Click **⚙ Actions** in the Projects section header for these tools:

| Option | What it does |
|--------|-------------|
| **Download Template** | Downloads the Excel import template |
| **Import Projects** | Bulk-add projects from an Excel file |
| **Export Projects** | Exports all projects to Excel |
| **Generate Report** | Download AIP, RBP, or RDIP PDF reports |

#### Importing Projects from Excel

1. Click **Actions → Import Projects**.
2. Drag and drop your `.xlsm` file or click to browse.
3. Review the tabbed preview (Summary, Projects, Funding, Components, Cost/Year, Major Items, Locations, Errors).
4. Fix any errors in the template and re-upload if needed.
5. Click **Import** to submit.

> The file must be the authorized MYPS template with STATUS = VALIDATED and the correct signature.

#### Generating Reports

1. Click **Actions → Generate Report**.
2. Select a **Report Type**:

| Report | Availability |
|--------|-------------|
| AIP-Exec-01 | BP or earlier, GAA stage |
| AIP-Exec-02 | BP or earlier, GAA stage |
| RBP | BP stage only |
| RBP Components | BP stage only |
| RBP Tier | BP stage only |
| RDIP | Pre-BP stages |

3. Optionally filter by Category, Region, DEO, Implementing Office, Operating Unit, or Legislative District.
4. Click **Generate** to download the PDF.

---

### Batch Actions (Tag Icon)

Click **🏷 Batch Actions** to perform operations on multiple projects at once. Batch publish controls only appear at GAA stage with Approved status.

| Option | What it does |
|--------|-------------|
| **Batch Delete** | Enter Project IDs → confirm delete |
| **Restrict Publishing** | Marks projects so they will not appear in published reports |
| **Allow Publishing** | Marks projects as ready to be included in published reports |

---

### Tips

| Tip | Detail |
|-----|--------|
| Expand rows before clicking View | Sub-table shows all stages; View Details opens the correct stage |
| Filters persist while paginating | Page through results without losing filter settings |
| Stage affects available actions | Reports, Add Project, and Publish only appear at the right stage |
| Name is auto-generated | Use Sub Name for custom labels |
| Update only enables when changes exist | Button is disabled if nothing changed |

---

## 4. Projects

The **Project** module is where you create, view, and manage individual infrastructure projects. Each project belongs to a **Program** and goes through pipeline stages (BP, NEP, GAA, etc.).

---

### Navigating to the Project List

Click **Projects** in the left navigation sidebar. The list columns are:

| Column | Description |
|--------|-------------|
| Project ID | Unique identifier; click the row to expand stage history |
| Description | Project name / description |
| Category | Infrastructure category |
| Region | Geographic region |
| Actions | **View** button — opens the project detail form |

---

### Searching for a Project

1. Type a **Project ID** (full or partial) in the search bar.
2. Press **Enter** or click **Search**.
3. Click the **X** button to clear the search.

> Search is by Project ID only, not by description or region.

---

### Viewing Stage History

Click anywhere on a project row to expand it and see its revision history across pipeline stages. The sub-table shows: Stage name, Revision number, Publication status. Click the row again to collapse. Multiple rows can be expanded at the same time.

---

### Adding a New Project

1. Click the **Add Project** button (top-right of the project list), or arrive from within a Program.
2. Fill in all required fields.
3. Click **Save Project** (top-right of the form).

---

### Editing an Existing Project

1. Click the **View** button on any project row.
2. The edit form opens, pre-populated with all saved data.

**Fields always read-only in edit mode:** Program Name, Program Type, Program Stage, Start Year.

**When the entire form is read-only:**
- The project is **inactive** (`IsActive = false`), or
- The project is at **GAA stage and is published** (use **Revise Project** instead)

---

### Form Sections — Detailed Guide

The form is divided into collapsible sections. Click any section header to expand or collapse it.

#### 4.1 Project Location Map

Shows the project's infrastructure locations on an interactive map (GeoJSON overlay). Only visible when editing an existing project with saved work locations. Read-only — edit coordinates in the Major Items of Work section.

---

#### 4.2 Program Details

**Add mode:** Select from a dropdown of available programs (GAA-R programs are excluded). Selecting a program auto-fills Program Type, Start Year, and Program Stage. Cannot be changed after saving.

**Edit mode:** Program details are read-only. Displays: Program Name, Program Type, Start Year, Program Stage.

---

#### 4.3 Project Details

##### Identification Fields

| Field | Description |
|-------|-------------|
| **Description** | Full name/description of the project (required) |
| Alternate ID | Alternative reference identifier |
| External ID | External system identifier |
| MYCA Approval Date | Date of MYCA approval |
| UACS | Unified Accounts Code Structure code |

##### Classification Fields

| Field | Description |
|-------|-------------|
| **Category** | Infrastructure category (required) |
| **Thrust** | Program thrust/priority (required) |
| **Origin** | Origin of the project (required) |
| **Agency** | Implementing agency (required) |
| **Implementation Mode** | How the project will be implemented (required) |
| Emergency Mode | Emergency classification (optional) |
| Tier | Project tier (required) |
| Rank | Priority rank (optional) |

##### Geographic / Office Fields (Cascading Dropdowns)

| Field | Description | Cascade Rule |
|-------|-------------|--------------|
| **Province** | Province where project is located (required) | Filters City, LD, DEO |
| **City / Municipality** | City or municipality (required) | Auto-sets Province |
| **Legislative District** | Legislative district (required) | Filtered by Province |
| **DEO** | District Engineering Office (required) | Filtered by Province |
| **Implementing Office (IO)** | Responsible office (required) | Filtered by DEO |
| **Operating Unit (OU)** | Operating unit (required) | Filtered by IO |
| **Region** | Region code (required) | Select from dropdown |

> Always select Province first — this gives the most accurate filtered choices for City, LD, DEO, IO, and OU.

##### Engineering Fields

| Field | Description |
|-------|-------------|
| Feasibility | Feasibility study status |
| Feasibility Date | Date of feasibility completion |
| Detailed Design | Detailed design status |
| Detailed Design Date | Date of detailed design completion |
| Row Available | Right-of-way availability status |
| Region Wide | Whether the project is region-wide |

---

#### 4.4 Component Cost

##### Adding a Component

1. Click **Add Component**.
2. Select **Component Type** and **Component** (filtered by type).
3. Enter **Description** (or click the sparkle icon to auto-fill from the component type).
4. Enter **Total** cost in Philippine Pesos (₱).
5. Click **Add Year** to break down cost per year (Year, Amount, Start Date, End Date).
6. Click **Save**.

##### Budget Indicator

| Indicator Color | Meaning |
|-----------------|---------|
| Blue | Total cost below 75% of budget |
| Yellow | Total cost is 75–89% of budget |
| Orange | Total cost is 90–99% of budget (near limit) |
| Green | Total cost equals 100% of budget (perfect match) |
| Red | Total cost exceeds the budget |

##### Editing / Deleting a Component

- **Edit:** Click the pencil icon on any row.
- **Delete:** Click the trash icon. A confirmation dialog shows how many Major Items of Work will also be removed (cascade delete). Click **Confirm Delete** to proceed.

> Deleting a component also deletes all linked Major Items of Work and their work locations.

---

#### 4.5 Major Items of Work

##### Adding a Major Item

1. Click **Add Major Item**.
2. Select **Component**, **Year of Work**, **Infrastructure Type**, and **Type of Work**.
3. Click **Save**.

> For ROW components, Infrastructure Type and Type of Work are automatically limited to ROW-applicable options.

##### Work Locations

Click the arrow icon on a major item row to expand its work locations. Click **Add Location** to add a new one.

In the Add Infrastructure dialog:
- **Road tab:** Search for a road section by ID or name.
- **Bridge tab:** Select a road section first, then select a bridge.
- Select a row and click **Confirm**.

Fill in the work location fields:

| Field | Description |
|-------|-------------|
| **Detailed Scope** | Specific description of work (required, must be unique within the major item) |
| Physical Target | Numeric target quantity |
| **Length** | Length of work (km or meters) |
| Start Chainage | Starting chainage marker (required for national roads) |
| End Chainage | Ending chainage marker (required; must be > Start Chainage) |
| Start Station Limit | Description of start point |
| End Station Limit | Description of end point |
| Start X / Start Y | GPS coordinates of starting point |
| End X / End Y | GPS coordinates of ending point |

> **Coordinate bounds:** Longitude (X): 116.67° to 126.60°. Latitude (Y): 4.67° to 21.17°.

> **Duplicate Scope:** Each location must have a unique combination of Detailed Scope + Start Chainage + End Chainage + Start Station Limit + End Station Limit.

---

#### 4.6 Funding Profile

##### Adding a Funding Entry

1. Click **Add Funding**.
2. A new row appears. Fill in **Source**, **Agreement**, and **Amount**.
3. The **Percentage** column is auto-calculated: `Amount / Total Amount × 100%`.

##### Total Percentage Indicator

| Color | Meaning |
|-------|---------|
| Green | Total equals 100% (valid) |
| Yellow | Total is less than 100% |
| Red | Total exceeds 100% |

> The total funding percentage must equal exactly 100% (±0.03% tolerance) before saving an update.

##### Deleting a Funding Entry

Click the trash icon on the row. Remaining percentages recalculate automatically.

---

#### 4.7 Supporting Documents

Upload PDF documents (e.g., feasibility study, design drawings, approvals).

1. Click **Add Document**.
2. Select **Document Type**, enter an optional **Description**, and choose a **PDF file** (PDF only).
3. Click **Upload**.

The file appears in the table as a clickable link. Click the trash icon on any row to delete the file immediately (cannot be undone).

---

#### 4.8 Activity Log

Shows a timeline of all changes made to the project — who, when, and what changed. Filter by: All, Created, Updated, Deleted. Each entry shows a color-coded badge, relative time, user, and expandable JSON diff view. This section is read-only.

---

### Saving a New Project

1. Fill in all required fields in the Project Details section.
2. Click **Save Project** (top-right of the form).
3. A confirmation dialog appears. Click **Save Project** to confirm.

After saving, the system assigns a **Project ID** and redirects you to the Edit view.

**"Proceed with Caution" dialog:** If the backend detects a potential duplicate, a warning dialog appears. Click **Cancel** to review, or **Yes, Proceed Anyway** to save.

---

### Updating an Existing Project

1. Make any desired changes.
2. Click **Update Project** (orange button, top-right).
3. If validation passes, a confirmation dialog appears. Click **Update Project**.

The **Update Project** button is hidden when the project is inactive or published at GAA stage (use **Revise Project** instead).

---

### Validation Errors and How to Fix Them

#### Required Field Errors

| Error Message | How to Fix |
|---------------|------------|
| "Program ID is required" | Select a program in Program Details |
| "Description is required" | Enter a project description |
| "Category is required" | Select a category |
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

#### Business Rule Errors

| Error Message | How to Fix |
|---------------|------------|
| "Funding percentage total must equal 100%" | Adjust funding amounts to total 100% |
| "Duplicate Detailed Scope …" | Change Detailed Scope or chainages so no two locations are identical |
| "Location X: Length must be greater than 0" | Enter a valid length greater than zero |
| "Start X/Y coordinate … out of valid range" | Enter coordinates within Philippine bounds (Lon: 116.67–126.60, Lat: 4.67–21.17) |
| "End X/Y coordinate … out of valid range" | Same as above for end coordinates |

---

### Importing a Lump Sum Project

The **Itemized Lump Sum** button appears when editing an existing project whose Project ID ends with "LS" and has not yet reached the final published stage.

1. Click **Itemized Lump Sum**.
2. Drag and drop your `.xlsx` file or click to browse.
3. Review the tabbed preview: Summary, Projects, Funding, Components, Cost Per Year, Major Items, Major Locations, Errors.
4. Fix any errors in the Excel file and re-upload if needed.
5. Click **Submit**.

> The import replaces existing data in the affected sections. Review carefully before submitting.

---

### Creating a Revision

Only available for projects at the **published GAA stage**.

1. Click **Revise Project** (yellow dropdown, top-right).
2. Select a **revision type** from the list.
3. In the Revision dialog, select a **Category** and a **Reason**.
4. Click **Submit**. You will be navigated to the revision/modification workflow.

---

### Unlocking a Project

If a project is **locked**, the **Unlock Project** button appears at the top-right (edit mode only, when active and not at the final published stage). Click it to unlock for editing.

---

### Frequently Asked Questions

**Q: I can't find a project in the list.**
Use the search box to search by Project ID. If you still can't find it, it may be in a different stage or inactive.

**Q: Why are some dropdown options greyed out or empty?**
Many dropdowns depend on previous selections. Always fill in Province first, then move down the hierarchy.

**Q: The "Update Project" button is missing.**
The button is hidden if the project is inactive or at the published GAA stage. Use **Revise Project** if published.

**Q: I deleted a component and Major Items disappeared.**
Yes — deleting a component cascade-deletes all linked Major Items and their work locations. The system warns you before you confirm.

**Q: Coordinates are out of range.**
Philippine bounds: Longitude (X) 116.67°–126.60°, Latitude (Y) 4.67°–21.17°. Do not swap X and Y.

**Q: The funding percentage is not adding up to 100%.**
Percentage is auto-calculated from the amounts you enter. Ensure no rows have zero or blank amounts.

**Q: What is the "Proceed with Caution" dialog?**
The backend detected a potential duplicate or issue. Read the warning carefully. Cancel to review, or proceed if confident.

**Q: What file types can I upload as supporting documents?**
Only **PDF files** are accepted.

**Q: Can I edit a published project?**
Published GAA projects cannot be directly edited. Use **Revise Project** to initiate a controlled change process.

---

## 5. Project Groups

Project Groups are named collections of infrastructure projects. They allow teams to organize related projects under a single group name and control which user group has ownership or visibility over that collection.

### Overview

| Screen | How to reach it | What you do here |
|--------|-----------------|-----------------|
| **Project Groups List** | Click "Project Groups" in navigation | Browse all groups, filter, add new groups, delete groups |
| **Project Group Details** | Click a group name or the View button | Edit group info, view and manage the projects inside the group |

---

### Project Groups List

#### What the table shows

| Column | What it means |
|--------|---------------|
| **Name** | The group's name — click it to open the group's detail page |
| **Description** | A brief description of the group's purpose |
| **Number of Projects** | How many projects are currently linked to this group |
| **User Group** | The user group that owns or is responsible for this project group |
| **Created Date** | When the group was created |
| **Created By** | Who created the group |
| **Actions** | Orange **View** button and Red **Delete** button |

#### Filtering the list

1. Click the **Filter** button (funnel icon).
2. Filter by **Name** and/or **User Group**.
3. Click **Apply** to filter. Click **Clear Filters** to reset.

> Filters are additive — the list must match both fields if both are filled.

#### Adding a new project group

1. Click the **Add Project Group** button (blue, top-right).
2. Fill in three required fields:

| Field | Description |
|-------|-------------|
| **Project Group Name** | A unique, descriptive name for the group |
| **Description** | A short explanation of what this group represents |
| **User Group** | Select which user group owns this project group |

3. Click **Submit**. You are automatically taken to the new group's detail page.

#### Deleting a project group

1. Click the red **trash icon** in the Actions column.
2. A confirmation dialog appears.
3. Type **delete** in the confirmation field (any case).
4. Click **Delete Group** to confirm.

> Deleting a project group is permanent. The projects themselves are not deleted — only the group container.

---

### Project Group Details

Navigate here by clicking a group's **Name** link or the orange **View** button.

#### Editing group information

The left panel contains core information — all fields are editable:

| Field | What to enter |
|-------|--------------|
| **Name** | The group's display name |
| **Description** | A description of the group's purpose |
| **User Group** | Select a new owner group from the dropdown |

Click the green **Update** button to save.

#### Viewing the projects in a group

| Column | What it shows |
|--------|---------------|
| **Project ID** | Click to open the full project detail page |
| **Category** | Project category code |
| **Description** | Short project description |
| **Origin** | Origin code |
| **City** | City code |
| **Legislative District** | Legislative district assignment |
| **Operating Unit** | Assigned operating unit |
| **Implementing Office** | Implementing office |
| **DEO** | DEO assignment |
| **Region** | Region code |
| **Agency** | Agency code |
| **Created By** | Who added this project |
| **Created Date** | When the project was added |
| **Actions** | Red trash icon to remove the project from this group |

#### Adding projects to a group

1. Click the blue **Add Project** button above the projects table.
2. Type the exact **Project ID** in the search dialog.
3. Click the search icon or press **Enter**.
4. If found, click the **+** icon to add it to your selection list. You can add multiple projects before submitting.
5. Click **Submit**.

> Projects are added by exact Project ID — partial matches will not work. If a project is already in the group, adding it again will not create a duplicate.

#### Removing a project from a group

1. Click the red **trash icon** on the project row.
2. A confirmation dialog appears.
3. Type **delete** in the confirmation field.
4. Click **Delete** to confirm.

> Removing a project from a group does **not** delete the project — it only unlinks it from this group.

---

### Common Workflows

**Setting up a new project group for a team:**
1. Add Project Group → fill name, description, user group → Submit.
2. On the detail page, click Add Project → search and add each project by ID.

**Changing which team owns a project group:**
1. Open the detail page → update User Group dropdown → click Update.

**Finding groups for a specific team:**
1. On the list page, click Filter → enter the team's user group name → Apply.

---

### Notes and Tips

- Group names are not automatically unique — use consistent naming conventions.
- The **Number of Projects** count reflects the last data load. Return to the list page after changes to see the updated count.
- Sorting is not available on the project groups list — use the Name filter instead.
- Project ID must be exact when searching in the Add Project dialog.
- The **Update** button saves only the group metadata. Adding/removing projects is done separately.

---

## 6. Project Modification

The **Modification** module allows you to request changes to approved projects and track those requests through a review and approval workflow. Modifications are formally documented, categorized by type (e.g., Adjustment, Termination, Additional Funding), and require a supporting approval document before submission.

### Approval Workflow

1. **Region Office** — initial review and approval
2. **Central Office (CO)** — final approval that publishes changes to MYPS and PCMA

---

### Starting a Modification Request

Modification requests are initiated **from the Project Details page**, not from the Modification module directly.

1. Open the project from the Projects list.
2. Click the **Modify** or **Request Revision** button.
3. Select the **Modification Category** and the specific **Reason**.
4. Click **Proceed** — the Modification form opens pre-loaded with the project's current data.

---

### Modification Form Sections

| Section | Description |
|---------|-------------|
| **Revision Info** | Shows category, reason, Project ID, and attached documents or correction notes |
| **Program Details** | Program information — generally read-only |
| **Project Details** | Editable project fields (depends on modification category and PCMA status) |
| **Map** | Geographic view of the project — read-only |
| **Component Costs** | Project components with costs — add, edit, or delete as allowed |
| **Major Items of Work** | Work items linked to components — add, edit, delete, or copy |
| **Funding Profile** | Funding sources and amounts |
| **Notes** | Free-text notes for this revision |
| **Activity Log** | History of changes and transactions |

---

### Field Editability Rules

Which fields can be edited depends on three factors:

**1. Modification Category and Reason**

Each category/reason combination has a specific set of allowed fields. Examples:
- **Adjustment — Correction of MYPS typographical error** → only Description is editable
- **Adjustment — Move funds between existing Project Components** → only component cost fields
- **Termination** → component cost fields and major item fields may be edited

Disallowed fields are **grayed out**.

**2. PCMA Construction Status**

| Situation | What you can edit |
|-----------|-------------------|
| **Not yet started** and **not packaged** | All fields allowed by your category/reason |
| **Not yet started** or **On-going** and **packaged** | Limited fields (Description, some cost fields) |
| **Completed** or **Terminated** | No fields are editable |

**3. API-Provided Field Rules**

The system receives exact field permissions from the server based on your specific category, reason, and project status. These override all defaults.

---

### Working with Component Costs

**Adding a Component:**
1. Click **Add Component** (if allowed).
2. Select a **Component Type**.
3. Optionally click **Auto-Fill** (sparkle icon) to auto-populate the description.
4. Enter **Description**, **Start Date**, **End Date**, and **Total Amount**.
5. Add per-year cost breakdown rows as needed.
6. Click **Save**.

**Editing:** Click the pencil icon. Only fields allowed by your modification rules are editable.

**Deleting:** Click the trash icon. A confirmation shows which component and how many linked Major Items will be deleted. Confirm to proceed (cascade delete).

---

### Excess Component Warning

If the **Project Cost is greater than the total of all component costs**, the system prompts:

> "The Project Cost (₱X) is greater than the Total Project Component Cost (₱Y). Is this an intentional reduction of Project Cost?"

- **OK** — The system automatically creates an **EXC (Excess)** component for the difference.
- **Cancel** — Return to the form without creating the component.

Applies when category is: Adjustment, Change in Authority to Implement, For Savings - Partial Unutilized Balance, Non Implementable, or Termination.

---

### Working with Major Items of Work

- **Expand/Collapse:** Click the arrow (▶) on a major item row to see its work locations.
- **Adding:** Click **Add Major Item** → select Component, Year of Work, Work Type, Infrastructure Type → Save.
- **Copying:** Click the copy icon → select a target component → confirm.
- **Editing:** Click the pencil icon. Only allowed fields are active.
- **Deleting:** Click the trash icon. Confirm (note cascade warning for work locations).
- **Work Locations:** Expand the row → click **Add Work Location** → fill in infrastructure details → save.

---

### Specific Modification Types

**Termination:** A dialog appears asking "Does this project have unfinished work?" Select Yes or No. For **Termination - No Disbursement** (Reason ID 37): the system automatically finds all terminated components, sets their amounts to zero, and creates an EXC excess component.

**Non-Implementable:** A dialog shows project components. Select which to mark as non-implementable (at least one required).

---

### Submitting the Modification Request

1. Click **Submit Revision** in the action bar.
2. Fill in:
   - **Date of Approval** — date the approval document was issued
   - **Approval Document** — upload the supporting PDF file (required)
   - **Certification checkbox** — check "I certify that the information is accurate"
3. Click **Submit**.

A Transaction ID is generated for tracking. You will be navigated back to the modification list.

---

### Viewing the Modification List

Navigate to **Modification** from the main menu.

| Column | Description |
|--------|-------------|
| Revision Name | Type of revision |
| Reason | Reason for the modification |
| Region Status | Approval status at Region level |
| CO Status | Approval status at Central Office level |
| Created By | Who submitted the request |
| Date | Date created |

**Status Badge Colors:**

| Color | Meaning |
|-------|---------|
| Yellow | For Approval — awaiting review |
| Red (light) | For Correction — returned for changes |
| Red (dark) | Disapproved |
| Green | Approved |
| Gray | Other / Pending |

Type a **Project ID** in the search box and press **Search** to filter. Click any row to open the full revision detail view.

---

### Reviewing and Approving a Modification (Reviewer Role)

**Approve:**
1. Click **Approve** → review project and modification details in the confirmation dialog.
2. Click **Confirm Approve**. Changes are published to the project.

**Disapprove:**
1. Click **Disapprove** → enter a required **Rejection Reason**.
2. Click **Confirm Disapprove**. The request is marked as Disapproved.

**Request Changes (For Review):**
1. Click **Request Changes** → enter required **Review Comments**.
2. Click **Submit**. The request is returned to the requester.

---

### Resubmitting After a Review Request

If your request was returned with comments ("For Correction" status):

1. Open the request from the Modification list.
2. Review corrections in the **Revision Info** section.
3. Make the necessary changes.
4. Click **Resubmit** → upload the updated approval document, set the date, check certification → click **Resubmit**.

---

### Quick Reference

| Action | How |
|--------|-----|
| Start a modification | From Project Details page → Modify / Request Revision |
| Submit a revision | Fill out changes → Submit Revision → upload PDF → certify → Submit |
| Search modifications | Modification list → type Project ID in search box |
| View a revision | Click any row in the Modification list |
| Approve a revision | View revision → Approve → confirm |
| Disapprove a revision | View revision → Disapprove → enter reason → confirm |
| Return for corrections | View revision → Request Changes → enter comments → submit |
| Resubmit after correction | View revision → make changes → Resubmit → upload PDF → submit |

---

## 7. Infrastructure Administration (RBIA)

**Infrastructure Administration** (RBIA) is the module where you manage the future road network inventory — roads, road sections, and bridges. This data forms the base layer for planning projects and tracking infrastructure across the country.

### Three-Level Hierarchy

```
Road  ──►  Road Section  ──►  Bridge
```

---

### Navigating the Module

Three tabs at the top:

| Tab | What it shows |
|-----|---------------|
| Roads | All future national roads |
| Road Sections | All future road sections linked to those roads |
| Bridges | All future bridges linked to road sections |

Each tab shows a count badge with the total number of records.

---

### Common Table Actions

- **Search bar** — type and press Enter or click Search to filter by the main identifier.
- **Filter button** — open the filter dialog. The button turns orange when a filter is active.
- **Clear Filter / X button** — remove the current filter and reload all records.
- **Pagination** — navigate pages using Previous / Next.
- **Sort** — click any column header to sort ascending or descending.

---

### Roads Tab

#### The Road ID Format

Format: **`FR{5-digit-number}{IslandCode}`**

- `FR` — prefix for Future Roads
- 5 digits — zero-padded sequential number (e.g., `00001`)
- Island Code — alphabetic code for the island group (e.g., `LZ` for Luzon, `VS` for Visayas)

Example: `FR00001LZ`

#### Roads Table Columns

| Column | Description |
|--------|-------------|
| Road ID | Unique identifier (blue badge) |
| Road Name | Name of the road |
| Classification | Road class (green badge): Primary, Secondary, Tertiary, Quaternary |
| Actions | Edit, Delete, and Add Section buttons |

#### Adding a Road

1. Click **Add Road** (blue, top-right of the Roads table).
2. Enter a **Road ID** using the format `FR{5digits}{IslandCode}`.
3. Enter the **Road Name**.
4. Select the **Classification** from the dropdown.
5. Click **Save**.

#### Editing a Road

Click the yellow pencil icon → update fields → click **Save**.

#### Deleting a Road

Click the red trash icon → type `delete` → click **Confirm Delete**.

> Deleting a road removes it permanently. Ensure no active road sections are linked before deleting.

#### Searching and Filtering Roads

- **Inline search:** Searches by Road Name.
- **Filter dialog:** Filter by Road ID, Road Name, or Classification. Click **Apply Filters**.
- **Clear:** Click **Clear Filter** or **Clear** inside the filter dialog.

#### Adding a Road Section from a Road

Each road row has a blue **+ Add Section** button. Click it to open the Add Road Section dialog with the Road ID pre-filled. This is the **primary way** to create road sections — the standalone option in the Road Sections tab is disabled.

---

### Road Sections Tab

#### The Road Section ID Format

Format: **`FS{5-digit-number}{IslandCode}`**

- `FS` — prefix for Future Sections
- 5 digits — sequential number
- Island Code — inherited automatically from the parent Road ID

#### Road Sections Table Columns

| Column | Description |
|--------|-------------|
| Section Road ID | Unique section identifier (purple badge) |
| Road ID | Parent road identifier (blue badge) |
| Length (m) | Road section length in metres |
| Engineering District | DEO responsible for this section (orange badge) |
| Actions | Edit, Delete, and Add Bridge buttons |

#### How to Add a Road Section

Road sections can only be added from the **Roads tab** (click the **+ Add Section** button on a road row).

The dialog opens with the parent road pre-filled:
1. Enter the **Section Number** (5 digits only).
2. Select the **Engineering District** (DEO).
3. Enter the **Road Length** in metres.
4. Click **Save**.

The Section Road ID is generated automatically: `FS{number}{IslandCode}`.

#### Editing / Deleting a Road Section

- **Edit:** On the Road Sections tab, click the yellow pencil icon → update → **Save**.
- **Delete:** Click the red trash icon → type `delete` → **Confirm Delete**.

#### Searching and Filtering Road Sections

- **Inline search:** Searches by Section Road ID.
- **Filter dialog:** Filters by Road ID, Section Road ID, and Engineering District (DEO).

#### Adding a Bridge from a Road Section

Click the blue **+ Add Bridge** button on a road section row to open the Add Bridge dialog with the Road Section pre-filled.

---

### Bridges Tab

#### The Bridge ID Format

Format: **`FB{5-digit-number}{IslandCode}`**

- `FB` — prefix for Future Bridges
- 5 digits — sequential number
- Island Code — inherited automatically from the parent Road Section ID

#### Bridges Table Columns

| Column | Description |
|--------|-------------|
| Section Road ID | Parent road section ID (blue badge) |
| Bridge Name | Name of the bridge |
| Bridge ID | Unique bridge identifier (purple badge) |
| From (m) | Starting chainage from the section start |
| Length (m) | Bridge length in metres |
| Carriage Way | Number of carriageways (blue badge, shows "N Way") |
| Actions | Edit and Delete buttons |

#### How to Add a Bridge

Bridges can only be added from the **Road Sections tab** (click **+ Add Bridge** on a road section row).

The dialog opens with the parent road section pre-filled:
1. Enter the **Bridge Number** (5 digits only).
2. Enter the **Bridge Name** (required).
3. Enter the **From** value — chainage (in metres) from the start of the road section.
4. Enter the **Length** in metres.
5. Enter the number of **Carriage Ways**.
6. Optionally enter the **Overall Width**.
7. Click **Save**.

The Bridge ID is generated automatically: `FB{number}{IslandCode}`.

#### Editing / Deleting a Bridge

- **Edit:** Click the yellow pencil icon → update → **Save**.
- **Delete:** Click the red trash icon → type `delete` → **Confirm Delete**.

#### Searching and Filtering Bridges

- **Inline search:** Searches by Bridge Name.
- **Filter dialog:** Filters by Section Road ID, Bridge ID, and Bridge Name.

---

### Importing Data from External Sources

Click the **Import** button (blue, top-right of the page) to pull infrastructure data from the RBIA Geographic Information System (GIS).

#### Import Groups

| Group | Items | Status |
|-------|-------|--------|
| Road Network from RBIA | Roads | Available |
| Road Network from RBIA | Road Sections | Available |
| Road Network from RBIA | Bridges | Available |
| Road Network from RBIA | Region | Pending |
| Admin Areas | City/Municipality, Legislative District | Pending |
| Internal Org | DEO, Implementing Office | Pending |

#### How to Import

1. Click **Import** (top-right).
2. The import dialog shows groups. Check the items you want to import.
3. Use the group-level checkbox to select all items in a group (dash = partial selection).
4. Click **Start Import** and wait for the dialog to close.

> Only Roads, Road Sections, and Bridges are currently connected to the GIS.

---

### Typical Workflows

**Full Infrastructure Setup (Road → Section → Bridge):**
1. Roads tab → Add Road → fill details → Save.
2. Click **+ Add Section** on the new road's row → fill details → Save.
3. Road Sections tab → click **+ Add Bridge** on the new section → fill details → Save.

**Importing Existing Road Network:**
1. Click **Import** → check Roads, Road Sections, and Bridges → **Start Import**.

**Checking Which Sections Belong to a Road:**
1. Road Sections tab → Filter → enter the Road ID → **Apply Filters**.

**Checking Which Bridges Belong to a Section:**
1. Bridges tab → Filter → enter the Section Road ID → **Apply Filters**.

---

### Quick Reference

| Task | Where |
|------|-------|
| Add a road | Roads tab → Add Road button |
| Add a road section | Roads tab → "+ Add Section" on a road row |
| Add a bridge | Road Sections tab → "+ Add Bridge" on a section row |
| Edit any record | Click yellow pencil on any row |
| Delete any record | Click red trash → type "delete" → confirm |
| Filter records | Click Filter button (orange = filter active) |
| Clear filter | Click red "Clear Filter" button |
| Import from GIS | Click Import button (blue, top-right) |

---

## 8. Code Tables

The **Code Tables** page is where administrators manage the system's reference and lookup data. Changes made here propagate immediately to project forms, funding profiles, revision workflows, and program management across the entire application.

### Accessing Code Tables

Navigate to **Code Tables** from the main menu. The page opens on the **Project Details** group by default.

---

### Layout Overview

```
[Project Details] [Component Cost] [Major Item] [Funding Profile] [Revisions] [Programs] [Admin Areas]
         ↓  (secondary tabs appear when a group has more than one table)
[Category]  [Thrust]  [Agency]  [Origin]
```

- **Top row (primary tabs):** One pill button per group. The number badge shows how many tables are in that group.
- **Second row (secondary tabs):** Appears only when the active group has more than one table.

---

### Groups and Tables

#### Project Details

| Tab | What it controls |
|-----|-----------------|
| Category | Project category options |
| Thrust | Thrust options, grouped by program |
| Agency | Implementing agency options |
| Origin | Project origin options |

#### Component Cost

| Tab | What it controls |
|-----|-----------------|
| Cost Type | Cost component type codes |

#### Major Item

| Tab | What it controls |
|-----|-----------------|
| Work Category | Top-level groupings of work |
| Type of Work | Specific work types with unit of measure and quantity limits |
| Infrastructure Types | Infrastructure type codes |

#### Funding Profile

| Tab | What it controls |
|-----|-----------------|
| Funding Agreement | Funding agreement records (Source Org, Code, Name, Financing Segment Code) |
| Funding Source | Funding source organizations (Local / Foreign) |

#### Revisions

| Tab | What it controls |
|-----|-----------------|
| Categories | Revision category codes |
| Headers | Revision header codes |
| Documents | Revision document type codes |
| Reasons | Revision reasons with group and category associations |
| Statuses | Revision status codes |
| Rules | Field-level permission rules per revision reason (toggle UI) |
| Validation Dates | Revision submission window start/end dates per funding year |

#### Programs

| Tab | What it controls |
|-----|-----------------|
| Program Stage | Pipeline stage options (e.g. BP, NEP, GAA) |
| Program Type | Program type classifications |
| Program Status | Program status values |

#### Admin Areas

| Tab | What it controls |
|-----|-----------------|
| Regions | Region records (GDB ID, Name, Participant ID, Island Code) |
| Provinces | Province records linked to a Region |
| Cities/Municipalities | City records linked to a Province |
| Legislative Districts | District records linked to a Province |
| DEOs | District Engineering Office records linked to a Province and Region |

---

### Common Table Actions

#### Searching

Type in the **Search** box at the top-right of any table. Filtering is case-insensitive. Large tables (Cities, Districts, DEOs) also have a **parent-entity filter dropdown** (e.g., filter by Province).

#### Adding a Record

1. Click the **+ Add** button (indigo, top-right).
2. A new row appears. Fill in all required fields.
3. Click the **✓ (check)** button to open the **Confirmation Dialog**.
4. Click **Confirm Add** to save, or close to cancel.

#### Editing a Record

1. Click the **pencil** icon on any row.
2. The row switches to edit mode. Update the fields.
3. Click the **✓ (check)** button to open the Confirmation Dialog.
4. Click **Save Changes** to save, or **✗** to cancel.

> Only one row can be in edit mode at a time.

#### Deleting a Record

Click the **red trash** icon on a row.
- **Most tables:** A confirmation dialog appears immediately.
- **Revision tables (Categories, Headers, Documents, Statuses):** An inline confirmation row appears below the row.

> Deletions cannot be undone from the UI.

#### Pagination

Use **Previous / Next** or page number buttons at the bottom. Default page size is **15 rows**; Cities, Districts, and DEOs show **20 rows** per page.

---

### Confirmation Dialog

| Element | Meaning |
|---------|---------|
| Green icon + "Add New …" heading | You are creating a new record |
| Amber icon + "Save Changes to …" heading | You are updating an existing record |
| Field rows | Each field and its new value. Monospace badges = IDs or codes. "empty (optional)" = optional field left blank |
| **Confirm Add** / **Save Changes** button | Submits the request to the server |
| Spinner on button | Request is in-flight; wait for it to complete |

Close with the **✗** button or by clicking outside to cancel.

---

### Revision Rules (Field Permission Editor)

The **Rules** tab under **Revisions** controls which project fields can be edited during a revision, and whether rows can be added or deleted in each section — based on the revision's reason, the project's PCMA status, and the project's package status.

> When a user opens a revision, the system automatically looks up the matching Rule row using Reason + PCMA Status + Package Status. The matched rule is enforced across the entire revision form.

#### Reading the Table

| Column | Meaning |
|--------|---------|
| Reason | The revision reason this rule applies to |
| PCMA Status | Project's current implementation status in PCMA |
| Package Status | Project's current packaging state |
| View Rules | Expand an inline read-only toggle panel |
| Actions | Edit (pencil) and Delete (trash) |

A rule only applies when **all three conditions match**.

#### The Field Rules Panel

The panel is organized into six sections:

| Section | What it affects |
|---------|----------------|
| **Project Details** | Individual fields in the main project information panel |
| **Component Cost** | Fields in component cost rows + Can Add / Can Delete |
| **Component Cost Year** | Fields in per-year cost rows + Can Add / Can Delete |
| **Major Item of Work** | Fields in major work item rows + Can Add / Can Delete |
| **Major Item Location** | Fields in location rows + Can Add / Can Delete |
| **Funding Profile** | Fields in funding source rows + Can Add / Can Delete |

**Toggle meaning:**
- **ON (blue/indigo):** The field is **editable** in the revision form.
- **OFF (gray):** The field is **read-only** / disabled.

**CRUD toggles (all sections except Project Details):**
- **Can Add ON:** The "Add row" button is visible and active.
- **Can Add OFF:** No new rows can be created.
- **Can Delete ON:** Delete buttons are visible on each row.
- **Can Delete OFF:** Existing rows cannot be removed.

#### Editing a Rule

1. Navigate to **Code Tables → Revisions → Rules**.
2. Click the **pencil** icon on the rule row.
3. Click a section header to expand it (shows summary: `X / Y editable`).
4. Toggle individual field switches and CRUD controls as needed.
5. Click **✓ (check)** → review in the Confirmation Dialog → click **Save Changes**.

> Use **Expand All / Collapse All** buttons to review all sections at once.

---

### Admin Areas

The tables are hierarchically related:

```
Region
  └── Province
        ├── City / Municipality
        ├── Legislative District
        └── DEO (District Engineering Office)
```

- When adding/editing a **Province**, a **Region** dropdown selects the parent region.
- When adding/editing a **City**, **Legislative District**, or **DEO**, a **Province** dropdown selects the parent. DEOs also have a **Region** dropdown.
- The **Cities**, **Legislative Districts**, and **DEOs** tables include a **Province filter** dropdown.

---

### Tips and Notes

- **Data updates are live.** After any successful save, the table re-fetches from the server.
- **Loading state.** A "Loading…" placeholder appears while data is being fetched.
- **Error banners.** If the initial load fails, click **Retry** to fetch again.
- **Toast notifications.** A small notification confirms success or reports an error after every save or delete.
- **Validation Dates** (Revisions → Validation Dates) currently uses local sample data. API integration is pending.
- **Legacy tables** (Implementation Mode, Emergency Mode, Row Available, Feasibility, Detailed Design, Region-Wide) exist in the codebase but are not exposed in the current navigation.

---

## 9. User Management (RBAC)

User Management is where system administrators control who can access the application, what groups they belong to, and what application modules and permissions exist.

Navigate to **Settings → User Management**.

> Access is typically restricted to system administrators. If you cannot see this section, contact your administrator.

---

### Overview

User Management is organized into three tabs:

| Tab | Purpose |
|-----|---------|
| **App Modules** | Define and maintain application modules; link backend controllers and frontend routes; sync permissions |
| **Users** | View, add, edit, and delete users; assign users to groups |
| **User Groups** | View, add, edit, and delete user groups; control what each group can access |

---

### How Permissions Work

#### API Permissions

Every backend API endpoint is decorated with a `[PermissionFilter]` attribute. When a request arrives, the server:

1. Reads the calling user's ID from the session token.
2. Confirms the user account is **active**.
3. Checks whether the user's groups grant access to the specific **Controller + Action** pair.
4. If no match is found → **HTTP 403 Forbidden**.

```
Request → [PermissionFilter] → Check vUserActionPermission view
         ControllerName = "UserManagementController"
         ActionName     = "AddUser"
                                   ↓
                     Match found? → Allow
                     No match?   → 403 Forbidden
```

> `[AllowAnonymous]` endpoints (e.g., Login) bypass this check entirely.

- **ControllerName** = ASP.NET controller class name (e.g., `UserManagementController`)
- **ActionName** = method name on that controller (e.g., `AddUser`, `ShowUsers`)

#### Route Permissions (Frontend Pages)

Each frontend page registered in `protectedRoutes` has a `RouteName` property.

On login, the server returns the list of `RouteName` values the user is allowed to access. The frontend then:

1. Filters `protectedRoutes` to only those whose `RouteName` appears in `ViewAccess`.
2. Renders only the permitted routes in the sidebar navigation.
3. Redirects users away from directly accessed denied routes.

```
Login response → ViewAccess: ["Dashboard", "UserManagement", ...]
                                   ↓
usePermittedRoutes()  →  protectedRoutes filtered by ViewAccess
                                   ↓
Sidebar shows only permitted pages
```

---

### App Modules Tab

App Modules define the top-level functional areas of the application. Each module groups related backend API actions and frontend page routes.

#### Viewing Modules

The App Modules table shows:
- **Module Name** — the display name
- **Description** — a short description
- **Controllers** — number of backend API controllers linked
- **Views** — number of frontend routes linked

Click any row (while not in edit mode) to expand it and see linked controllers and routes.

#### Adding a Module

1. Click **Add Module** (top-right).
2. A new blank row appears. Type the **Module Name** (required) and **Description** (optional).
3. Use the toggle switches in the controllers/views panel to link items to this module. Toggling to blue means "linked."
4. Click the **checkmark** to save, or **X** to cancel.

#### Editing a Module

Click the **pencil icon** → update name, description, or linked controllers/views → click the **checkmark** to save.

> Only one module can be edited at a time.

#### Deleting a Module

Click the **trash icon** → an inline confirmation appears ("Confirm" and "Cancel") → click **Confirm**.

> Deleting a module removes its association with all controllers and routes.

#### Syncing Permissions

| Button | What it does | When to run |
|--------|-------------|-------------|
| **Sync API** | Scans the backend for controller actions and registers new ones | After deploying new backend endpoints |
| **Sync Routes** | Registers the current frontend page routes | After adding new pages or routes |

Both buttons are disabled while any module is being edited.

---

### Users Tab

#### Reading the Users Table

| Column | What it shows |
|--------|---------------|
| **User** | Full name (bold), system ID, and email address |
| **User Group** | Blue badges showing groups. `+N more` appears if more than 3 groups — click to expand |
| **Region** | The user's assigned region |
| **Office** | The user's assigned office |
| **Status** | **Active** (green) or **Inactive** (red) |
| **Actions** | Edit (yellow pencil) and Delete (red trash) |

Click any sortable column header to sort. Click again to reverse.

#### Filtering Users

1. Click the **Filter** button (funnel icon).
2. Filter by **Name** (partial match), **User Group**, or **Status** (All, Active, Inactive).
3. Click **Apply**. The Filter button shows an orange badge with the active filter count.
4. Click **Clear Filters** to reset.

#### Adding a User

Users are registered using their government Employee ID from the Personnel Information System (PIS).

1. Click **Add User**.
2. Type the **Employee ID** and click the **search icon** (magnifying glass).
3. If found, the name, system ID, email, region, and office fill in automatically.
4. Select one or more **User Groups** from the checkbox list.
5. The **Status** field defaults to Active.
6. Click **Add User** to save.

> If the Employee ID is not found in PIS, an error message appears. You must complete the PIS lookup before submitting.

#### Editing a User

Click the **pencil icon** → update group assignments and/or active/inactive status → click **Save**.

> The Employee ID, name, email, region, and office come from PIS and cannot be changed here.

#### Deleting a User

Click the **trash icon** → a confirmation dialog shows the user's name → click **Delete** to confirm.

> Consider setting a user to **Inactive** instead of deleting if you want to temporarily disable access without permanently removing the account.

---

### User Groups Tab

User Groups are named sets of permissions. Users inherit all access rights of the groups they belong to.

#### Reading the User Groups Table

| Column | What it shows |
|--------|---------------|
| **Group Name** | The group's name (chevron ▼ = expandable) |
| **Members** | How many users are in this group |
| **Permissions** | Blue `N API` badge + Green `N Routes` badge; or gray "No permissions" badge |
| **Description** | Short description of the group's purpose |
| **Created** | Date the group was created |
| **Actions** | Edit (yellow pencil) and Delete (red trash) |

Click anywhere on a group row (except action buttons) to expand it and see a grid of **module permission cards** showing individual API actions and route permissions granted.

#### Filtering User Groups

Click **Filter Group** → search by **Group Name** → **Apply**. Click **Clear Filter** to reset.

#### Adding a User Group

1. Click **Add Group**.
2. Fill in **Group Name** (required) and **Description** (optional).
3. Click **Create Group**.

> A new group starts with **no permissions**. You must edit the group afterwards to assign permissions.

#### Editing a User Group (Assigning Permissions)

1. Click the **pencil icon** on the group's row.
2. The Edit Group dialog opens with a **Module Permissions** accordion.

**Working with the Module Permissions accordion:**
- Modules with existing permissions are highlighted in blue and expanded automatically.
- The panel header shows: `X/Y API` and `X/Y Routes` (granted out of total).
- Click a module header to expand or collapse.
- Use **Expand All / Collapse All** to manage all panels at once.

Inside each expanded module:
- **API Permissions** — grouped by controller. Check individual actions, or use the **controller-level checkbox** to select/deselect all actions at once. An indeterminate state (partial fill) appears when only some actions are selected.
- **Route Access** — check individual frontend routes to grant page-level access.

3. Click **Save Changes**.

> Permissions take effect immediately. Logged-in users may need to refresh their session.

#### Deleting a User Group

1. Click the **trash icon** on the group's row.
2. The Delete Group dialog shows the group name and current member count.
3. Type **DELETE** (case-insensitive) in the confirmation field.
4. Click **Delete Group**.

> Deleting a group removes all permission assignments and removes all users from the group. Users who were only in this group will lose all system access. This action cannot be undone.

---

### Common Workflows

**Adding a new employee to the system:**
1. App Modules tab → verify the needed modules exist.
2. User Groups tab → confirm the appropriate group exists with the right permissions.
3. Users tab → **Add User** → search by Employee ID → assign group(s) → save.

**Onboarding a new role / department:**
1. User Groups tab → **Add Group** → set name and description → save.
2. Click pencil on the new group → assign module permissions via accordion → save.
3. Users tab → for each user in that role, click pencil → add the new group → save.

**Syncing after a system update (new pages or endpoints deployed):**
1. App Modules tab → **Sync API** (registers new backend actions).
2. App Modules tab → **Sync Routes** (registers new frontend pages).
3. Review App Modules list — new controllers/routes appear as unlinked. Link them.
4. User Groups → update groups that need access to the new permissions.

**Temporarily disabling a user without deleting them:**
1. Users tab → click pencil on the user → set Status to **Inactive** → save.

---

### Tips and Notes

- **Filtering is additive**: all active filters combine with AND logic.
- **Group permissions are inherited, not per-user**: all access flows from group assignments.
- **Module links affect Sync**: Sync only registers items in the permission system. You still need to link them to a module before they can be assigned to groups.
- **Pagination**: each tab shows a limited number of rows per page. Use pagination controls at the bottom.
