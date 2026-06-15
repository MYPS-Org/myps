# Web-Based MYPS System
## User Manual
**Version:** 3.9
**Date:** June 14, 2026
**Prepared By:** EPTISA — for DPWH / Asian Development Bank

---

## Document Control Sheet

| Field | Value |
|-------|-------|
| Contracting Authority | DEPARTMENT OF PUBLIC WORKS AND HIGHWAYS – DPWH |
| The Promoter | ASIAN DEVELOPMENT BANK |
| Contract Name | Improving Growth Corridors in Mindanao Road Sector Project (Loan No. 3631-PHI), Consulting Services for ICD-1: Multi-Year Planning |
| Contract Number | 22CS2101 |
| Report Title | Web-Based MYPS User Manual – Deliverable #48 |

### Revision History

| REV. | DATE | AUTHOR | PARTICIPANTS | COMMENTS |
|------|------|--------|--------------|----------|
| 1.0 | April 29, 2026 | RP | RP | Initial release |
| 2.0 | May 4, 2026 | RP | RP | Full manual rewrite — all modules documented from test scripts and source code |
| 2.1 | May 5, 2026 | RP | RP | Added second login error message (Unauthorized); added Add Program name-required validation message |
| 3.0 | May 5, 2026 | RP | RP | Full restructure to PDF v3.0 format; added Field Reference tables, Common Outcomes tables, Purpose / Who / Prerequisites / On Success per screen |
| 3.1 | May 5, 2026 | RP | RP | Section 5.2.1 fully rewritten: added Field Reference tables for toolbar, filter dialog, row actions, and expanded stages sub-table; documented program name click/expand, search with Clear button, filter dialog, View button (both row and stage level), and Delete confirmation dialog |
| 3.2 | May 5, 2026 | RP | RP | Sections 5.3.3–5.3.5 fully rewritten: added Component Cost Dialog field references (Component Type, auto-generated Component ID rules, per-year cost rows, Auto-fill button, budget validation); Major Item Dialog field references (Component filter logic, lock-in-edit behavior, ROW Acquisition restriction, excluded Component IDs, all validation messages); Work Locations fully documented (InfraId logic by type, Road chainage/station auto-fill, Bridge dialog with DEO road section filter, auto-generated IDs for local types, Copy row behavior, coordinate fields, all validation messages) |
| 3.3 | May 6, 2026 | RP | RP | Section 5.2.4 stage progression updated: BP → NEP → NEP-E → HGAB → HGAB-I → GAA → GAA-R with full stage names and notes; Section 5.4 fully restructured into 10 subsections: Revision List columns and status badges documented; Revise Project dropdown (5.4.2) and Revision Dialog Category/Reason (5.4.3) documented with dedicated Field Reference tables; Modification Form sections and field editability rules (5.4.5) added; Specific revision type behaviors documented (Termination dialog, Non-Implementable component selection, Excess Component warning, Copy Major Item dialog); Submit Revision dialog (5.4.7) and Resubmit (5.4.8) separated and field-referenced; old duplicated 5.4.3–5.4.5 sections removed |
| 3.4 | May 6, 2026 | RP | RP | Section 5.7 User Management fully rewritten: App Modules tab (list, inline add/edit/delete, Sync API, Sync Routes, expand Controllers & Views panel) documented with Field Reference tables; Users tab fully documented (list columns, sort, Filter dialog, Add User with PIS lookup, Update User, Delete User — all with Field Reference tables, steps, On Success, and Common Outcomes); User Groups tab fully documented (list with expandable permission summary, Filter, Add Group with Apply Filter flag, Edit Group with Module Permissions accordion per module/controller/action and Route Access per page, Delete Group with typed confirmation) |
| 3.5 | May 6, 2026 | RP | RP | Section 5.8 Infra Management fully rewritten: page layout, hierarchy rule, and common table controls documented; Roads tab (Add/Edit/Delete Road dialogs with Field Reference tables, Filter Roads dialog, Add Road Section from road row with split ID builder); Road Sections tab (Edit/Delete Road Section dialogs, Filter Road Sections dialog with searchable DEO dropdown, Add Bridge from section row); Bridges tab (Edit/Delete Bridge dialogs, Filter Bridges dialog); Import dialog (3 groups — Road Network from RBIA, Admin Areas, Internal Org — with tri-state group checkboxes, active vs. pending item status, Start Import behavior) — all with Field Reference tables, step-by-step, On Success, and Common Outcomes |
| 3.6 | June 2, 2026 | RP | RP | Section 5.2.5 rewritten: "Add Existing Project" button now opens Batch Restore dialog — users enter project IDs to restore deleted projects back to the program; Section 5.2.7 updated: "View AIP Report" renamed to "Generate Reports" throughout; Section 5.6 updated: Toggle Active feature added across all Code Tables sub-tabs — Active column and toggle button added to every table; Section 5.7 updated: Plantilla Office Name field added to Add User and Update User dialogs |
| 3.7 | June 8, 2026 | RP | RP | Section 3.1 updated: login error messages revised — invalid credentials message and session-expired message updated to match current backend responses; Section 5.2.2 updated: Program Type and Program Stage fields now marked required (*) with frontend validation messages added; Section 5.7 updated: "Region Code" field in Add User dialog renamed to "Region" (now shows region name, not code), User ID and Region fields are now always disabled (fully read-only); Users list OFFICE column now displays PlantillaOfficeName (full office name) |
| 3.8 | June 10, 2026 | RP | RP | Gap analysis follow-up: Section 3.1 added "Username is required" / "Password is required" inline validation messages to Common Outcomes and Appendix B; Section 5.3.5 added Auto-generated ID Prefix reference table for all 16 work location infrastructure types; Section 5.4.6 added "Mode of Implementation — New Project Record" behavior (creates a new `-A` suffixed project record) and a note on the remaining revision types relying on standard field-editability rules; Section 5.5.3 added mention of the project group map view |
| 3.9 | June 14, 2026 | RP | RP | `documents/UserManual.md` established as the canonical manual (synced from `FE/UserManual.md` v3.8). Replaced all `UI-UX-XXX-Fnn/Ann` and other prefixed Field Reference IDs (`MIOW-`, `CC-`, `AIP-`, etc.) throughout the manual with plain sequential numbering (1, 2, 3...) per table — see new [`documents/UserManual_Rules.md`](./UserManual_Rules.md); corrected validation messages for native `<select required>` dropdowns in "Add Project Major Item of Works" (Component, Infrastructure Type, Type of Work), "Add New Future Road" (Classification), and "Revise Project" (Category, Reason) to the browser's actual *"Please select an item in the list."* tooltip |

### Consultant

| Role | Detail |
|------|--------|
| **Consultant** | EPTISA |
| Madrid Head Office | C. de Emilio Munoz, 35, San Blas-Canillejas, 28037 Madrid, Spain |
| Philippines Office | Unit 604, Taipan Place, Ortigas Center, Pasig City, 1605 Metro Manila, Philippines |
| **Project Director** | Antonio Alferez Burillo |
| Telephone | +632-881-74200 |
| Email | aalferez@eptisa.com |
| **Team Leader** | Roger Pfeiffer (RP) |
| Telephone | +63 965-491-6853 |
| Email | rp@pfeiffer-online.org |

### Verification and Approval

| | Approved: From the Team Leader | Approved: From the Consulting Firm |
|--|-------------------------------|-------------------------------------|
| **Name** | Roger Roland Pfeiffer, Project Team Leader, ICD-1 Project | Antonio Alferez Burillo, Project Director, Eptisa Servicios de Ingenieria S.L. in the Philippines |
| **Signature** | *(signature)* | *(signature)* |
| **Date** | *(date)* | *(date)* |

---

## Table of Contents

| Section | Title |
|---------|-------|
| — | Document Control Sheet |
| — | Table of Contents |
| — | Abbreviations |
| — | Glossary of Terms |
| 1 | System Overview |
| 2 | System Requirements |
| 3 | Accessing the System |
| 4 | Application Layout |
| 4.1 | Module & Feature Discovery |
| 5 | Features & Functionalities |
| 5.1 | Dashboard |
| 5.2 | Programs |
| 5.3 | Projects |
| 5.4 | Revision |
| 5.4.1 | Revision List |
| 5.4.2 | Initiating a Revision — Revise Project Dropdown |
| 5.4.3 | Revision Dialog — Selecting Category and Reason |
| 5.4.4 | Revision Types |
| 5.4.5 | Modification Form |
| 5.4.6 | Specific Revision Type Behaviors |
| 5.4.7 | Submitting the Revision |
| 5.4.8 | Resubmitting After a Return for Correction |
| 5.4.9 | RO Approval Actions |
| 5.4.10 | PS Admin Approval Actions |
| 5.5 | Project Groups |
| 5.6 | Code Tables |
| 5.7 | User Management |
| 5.8 | Infra Management |
| 5.8.1 | Roads Tab |
| 5.8.2 | Road Sections Tab |
| 5.8.3 | Bridges Tab |
| 5.8.4 | Import Dialog |
| 6 | Workflows |
| 7 | Error Handling |
| 8 | Frequently Asked Questions |
| 9 | Notes & Limitations |
| — | Appendix A: Issue Reporting Checklist |
| — | Appendix B: Consolidated Validation Messages |
| — | Appendix C: Controlled Terminology |

> In the final DOCX, replace this table with a Word auto-generated TOC field using **References → Table of Contents → Automatic**.

---

## Abbreviations

| Abbreviation | Full Description |
|--------------|------------------|
| AIP | Annual Investment Plan |
| API | Application Programming Interface |
| AWS | Amazon Web Services |
| CI/CD | Continuous Integration / Continuous Deployment |
| CTA | Component Technology Architecture |
| DMA | Design Management Application |
| DDL | Data Definition Language |
| DSS | Decision Support System |
| EAS | Enterprise Application Server |
| ERD | Entity–Relationship Diagram |
| GAA | General Appropriations Act |
| GIS | Geographic Information System |
| GKE | Google Kubernetes Engine |
| HGAB | House-Approved General Appropriations Bill |
| IROWMA | Infrastructure Right-of-Way Management Application |
| LDAP | Lightweight Directory Access Protocol |
| MYPS | **Multi-Year Planning and Scheduling** |
| NEP | National Expenditure Program |
| OAT | Operational Acceptance Testing |
| OAuth 2.0 | Open Authorization 2.0 |
| PCMA | Project and Contract Management Application |
| PDM | Physical Data Model |
| PIP | Public Investment Program |
| PPMPA | Project Procurement Management Plan Application |
| PREXC | Program Expenditure Classification |
| RBAC | Role-Based Access Control |
| RBIA | Road and Bridge Inventory Application |
| REST | Representational State Transfer |
| SAML | Security Assertion Markup Language |
| SPA | Single-Page Application |
| SQL | Structured Query Language |
| SSO | Single Sign-On |
| TLS | Transport Layer Security |
| TOR | Terms of Reference |
| UAT | User Acceptance Testing |
| UBP | Unified Budget Proposal |
| UDIP | UPMO Development Investment Program |
| UEFI | Unified Extensible Firmware Interface |

---

## Glossary of Terms

* **AIP (Annual Investment Plan):** DPWH's yearly program of prioritized projects for budget allocation.
* **API (Application Programming Interface):** A defined set of methods that allows software components to communicate. In MYPS, APIs expose Programs, Projects, Funding, and GIS features as HTTP/HTTPS endpoints.
* **DMA (Design Management Application):** DPWH system for managing design activities and approvals.
* **EAS (Enterprise Application Server):** The application server used in the current MYPS deployment.
* **GAA (General Appropriations Act):** Philippine annual law authorizing government spending.
* **GIS (Geographic Information System):** Software for capturing, analyzing, and visualizing spatial data. Used in MYPS to link projects to road, bridge, and boundary data.
* **HGAB (House-Approved General Appropriations Bill):** Philippine budget document prior to bicameral conference.
* **IROWMA (Infrastructure Right-of-Way Management Application):** DPWH system handling land acquisition processes.
* **MYPS (Multi-Year Planning and Scheduling):** DPWH's core application for programming infrastructure projects across multiple budget years.
* **NEP (National Expenditure Program):** The executive branch's proposed annual budget in the Philippines.
* **PCMA (Project and Contract Management Application):** DPWH system for managing project contracts and awards. MYPS publishes program and project data to PCMA.
* **PDM (Physical Data Model):** The database schema diagram for the current MYPS implementation.
* **PIP (Public Investment Program):** National-level multi-year infrastructure program.
* **PREXC (Program Expenditure Classification):** DPWH reporting requirement for obligations before project implementation.
* **RBIA (Road and Bridge Inventory Application):** DPWH system for managing road and bridge asset inventories. MYPS users select infrastructure from RBIA when encoding project locations.
* **RBAC (Role-Based Access Control):** Security model where system access is granted based on a user's assigned role.
* **Revision:** A recorded change to a Program or Project — such as a new implementation mode, Variation Order (VO), scope change, or correction — tracked with history of what changed, when, and why.
* **SPA (Single-Page Application):** A web application where a single HTML page is loaded once and content is updated dynamically. MYPS Web is implemented as an SPA.
* **SSO (Single Sign-On):** Authentication that allows users to access multiple systems with a single set of credentials. MYPS Web integrates with DPWH's SSO/Active Directory.
* **TOR (Terms of Reference):** The formal document defining the scope, objectives, deliverables, and constraints for the Web-based MYPS modernization.
* **UAT (User Acceptance Testing):** Formal testing by business users to confirm the system meets requirements before go-live.
* **UDIP (UPMO Development Investment Program):** A MYPS program stage used by UPMO clusters.

---

## 1. System Overview

**Purpose:**
The Multi-Year Planning and Scheduling (MYPS) system is DPWH's core web application for encoding, programming, and managing infrastructure projects across multiple national budget years. It provides a centralized platform for creating Programs, adding Projects, tracking project Revisions, managing Project Groups, and administering reference data through Code Tables and User Management.

**Key Capabilities:**

* Create and manage multi-year infrastructure programs (Budget Proposal → NEP → GAA → GAA-R)
* Add and encode project details including funding, component costs, major items of work, and work locations
* Submit and process project revisions with a structured approval workflow
* Publish projects to PCMA (Project and Contract Management Application)
* Search for programs, projects, roads, and bridges using the Global Search function
* Organize projects into Project Groups for cross-program tracking
* Maintain supporting reference data: code tables, user accounts, and infrastructure inventory

**Who It Is For:**
MYPS is used by DPWH personnel organized into user groups with specific roles, including:

* **DEO** — District Engineering Office users: project encoding and revision submission
* **RO** — Regional Office users: revision review and approval
* **PS Admin** — Planning Service Administration: final revision approval and program management

Each user sees only the modules and actions permitted for their assigned user group.

---

## 2. System Requirements

| Requirement | Description |
|-------------|-------------|
| Web Browser | Google Chrome (recommended), Microsoft Edge |
| Device | Desktop or laptop computer |
| Internet Connection | Stable broadband connection |
| Screen Resolution | 1280 x 720 or higher recommended |
| PDF Viewer | Required for viewing AIP reports and uploaded documents |

---

## 3. Accessing the System

### 3.1 Logging In

**Purpose:** The Login screen is the entry point to the MYPS system. Users enter their assigned DPWH credentials to authenticate and access the application.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** Valid DPWH user account; system URL provided by the PS Admin.

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | USERNAME | The user's DPWH login identifier | Text input |
| 2 | PASSWORD | The user's account password | Password input (masked) |
| 3 | Sign In | Submit credentials to authenticate | Button |

**Step-by-Step:**

1. Open the MYPS system URL in your web browser.
2. Enter your **USERNAME**.
3. Enter your **PASSWORD**.
4. Click the **Sign In** button.

[Insert Screenshot: Login Screen]

**On Success:** The system redirects the user to the Dashboard.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Username is required"* | The Sign In button was clicked while the USERNAME field was empty. | Enter your username before clicking Sign In. |
| *"Password is required"* | The Sign In button was clicked while the PASSWORD field was empty. | Enter your password before clicking Sign In. |
| *"Invalid credentials. Please check your user ID and password and try again."* | The username or password entered is incorrect. | Re-enter the correct username and password. |
| *"Your session has expired. Please sign in to continue."* | The account is not active or the current session has expired. | Contact your PS Admin to verify the account is active, then log in again. |
| Sign In button has no response | Session or connectivity issue. | Refresh the page and try again; contact support if persistent. |

---

### 3.2 Logging Out

**Step-by-Step:**

1. Click the **MYPS** dropdown in the top-left of the sidebar header.
2. Click **Log out**.

**On Success:** The session is ended and the user is redirected to the Login screen.

---

## 4. Application Layout

**Description:**
MYPS uses a consistent layout across all pages. Understanding the layout helps users navigate efficiently between modules.

**Layout Components:**

* **Sidebar (Left Panel)**
  * Displays the MYPS logo and application name at the top
  * Shows the logged-in user's name and assigned user group below the logo
  * Contains navigation links for all accessible modules
  * Remains visible across all pages

* **Main Content Area**
  * Displays the active module's page (tables, forms, dashboards)
  * Updates dynamically when a sidebar item is selected — no full page reload

* **Global Search (Top Right)**
  * A search icon in the upper-right corner opens a search panel
  * Accessible from any screen in the application
  * See Section 4.2 for usage details

**Navigation Behavior:**

* The sidebar is always visible
* Selecting a sidebar item loads the corresponding module in the main content area
* The active item is highlighted in the sidebar
* Sidebar items are hidden from users who do not have permission to access them

---

### 4.1 Module & Feature Discovery

The following table maps each active sidebar item to its route and source component.

| # | Sidebar Label | Route Path | Route Name | Component File | Section 5 Ref |
|---|---------------|------------|------------|----------------|---------------|
| 1 | Dashboard | /dashboard | Dashboard | pages/Dashboard/Dashboard.tsx | 5.1 |
| 2 | Programs | /programs | ProgramList | pages/Program/Views/Program.tsx | 5.2 |
| 3 | Projects | /projects | ProjectList | pages/Project/Views/Project.tsx | 5.3 |
| 4 | Revision | /revision | RevisionList | pages/Modification/views/ModifcationList.tsx | 5.4 |
| 5 | Project Groups | /project-groups | ProjectGroupList | pages/ProjectGroups/Views/ProjectGroup.tsx | 5.5 |
| 6 | Settings — Code Tables | /code-tables | CodeTables | pages/CodeTables/Views/CodeTables.tsx | 5.6 |
| 7 | Settings — User Management | /user-management | UserManagement | pages/Rbac/Rbac.tsx | 5.7 |
| 8 | Settings — Infra Management | /infrastructure-management | InfraManagement | pages/Rbia/Views/Rbia.tsx | 5.8 |

> Commented-out sidebar items (Lump Sum, Multi-Year Management, Reports) are not accessible to users and are not documented in Section 5.

---

### 4.2 Global Search

**Purpose:** The Global Search feature allows users to look up programs, projects, roads, and bridges from any screen in the application.

**Who uses this:** DEO, RO, PS Admin

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Search By | Category to search across | Dropdown: Project ID, Alternate ID, Description, UACS, Program Name, Roads, Road Section, Bridge — categories loaded dynamically from the server |
| 2 | Value | Keyword or identifier to search for | Text input; enabled only after a category is selected |
| 3 | Search | Execute the search | Button; disabled until both a category and value are entered |

> Results for **Project ID, Alternate ID, Description, UACS**, and **Program Name** include a **View ↗** link that navigates to the record's detail page. **Roads, Road Section**, and **Bridge** results display data only — no navigation link is available for these categories.

**Step-by-Step:**

1. Click the **search icon** in the upper-right corner of any screen.
2. From the **Search By** dropdown, select a category.
3. Enter a keyword or identifier in the **Value** field.
4. Click **Search**.

[Insert Screenshot: Global Search Panel]

**On Success:** Matching records are displayed in the results panel.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"No results found."* | No records match the search criteria. | Review the selected category and value; try a different keyword or category. |

---

## 5. Features & Functionalities

> Before using Section 5, ensure the Module Map Table in Section 4.1 is current. Each subsection corresponds to one active sidebar module, in sidebar order.

---

### 5.1 Dashboard

**Purpose:** The Dashboard is the first screen displayed after login. It provides an overview of the logged-in user's account and system status.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** Successful login (see Section 3.1).

**Dashboard Panels:**

| Panel | Contents |
|-------|----------|
| User Info | Logged-in user's Username, Role, and Phone number |
| Account Status | Current account status (Active) and credit balance |
| Quick Actions | System operational status |

**Step-by-Step:**

1. Log in to the system (see Section 3.1).
2. The Dashboard loads automatically after successful login.
3. Review the panels for user and account information.
4. Use the sidebar to navigate to any module.

[Insert Screenshot: Dashboard Screen]

**On Success:** The Dashboard loads and displays all panels without errors. The sidebar shows only the modules accessible to the logged-in user's role.

---

### 5.2 Programs

**Purpose:** The Programs module is the top-level container for infrastructure projects. A Program represents a budget year planning document (Budget Proposal, NEP, GAA, GAA-R) under which Projects are grouped. The module provides tools to search, filter, add, and manage programs, and to progress them through budget stages.

**Who uses this:** DEO, RO, PS Admin

---

#### 5.2.1 Program List

**Purpose:** View, search, filter, expand, and manage all programs accessible to the user. Each row can be expanded to reveal the program's individual budget stages, and each stage can be opened directly in Program Details.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** Successful login (see Section 3.1).

---

**Program List Table Columns:**

| Column | Description |
|--------|-------------|
| Name | Program name. Clickable — expands or collapses the row to show the program's stages. |
| Status | Current working status of the program (e.g., Working, Approved). |
| Program Type | Classification badge (e.g., Budget Proposal, TF). |
| No. of Projects | Number of projects currently linked to this program. |
| Start Year | Fiscal year the program begins. |
| Actions | **View** button and **Delete** button. |

---

**Field Reference — Toolbar Controls:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Search Programs | Text input to filter the list by program name | Text; press Enter or click Search to apply |
| 2 | Search | Submits the name search and refreshes the list | Button (blue); enabled when input has text |
| 3 | Clear | Clears the active name search and reloads all programs | Button (red); visible only when a search term or name filter is active |
| 4 | Filters | Opens the Filter Programs dialog for Year Start, Program Group, and Program Stage filters | Button (yellow); displays a count badge when any filter is active |
| 5 | Add Program | Opens the Add Program dialog (see Section 5.2.2) | Button (blue) |

---

**Field Reference — Filter Programs Dialog:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Start Year | Filter programs by fiscal start year | Dropdown: All Years, 2000 – (current year + 10) |
| 2 | Program Group | Filter by the program group the program belongs to | Dropdown: All Groups, values from Code Tables |
| 3 | Program Stage | Filter by budget stage | Dropdown: All Stages, values from Code Tables |
| 4 | Apply | Applies the selected filters and refreshes the list | Button |
| 5 | Clear Filters | Resets Year Start, Group, and Stage filters (preserves any active name search) | Button; visible only when at least one filter is active |

---

**Field Reference — Row Actions:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Program Name (link) | Expands or collapses the program row to reveal its budget stages | Click to toggle; chevron icon indicates state |
| 2 | View | Opens the Program Details page for the selected program at its current stage | Button (orange); in the Actions column |
| 3 | Delete (trash icon) | Opens the Delete Program confirmation dialog | Button (red); in the Actions column |

---

**Field Reference — Expanded Stages Sub-Table:**

When a program row is expanded, a nested table lists all budget stages under that program.

| Column | Description |
|--------|-------------|
| Stage Name | Name of the budget stage (e.g., BP 2025, NEP 2025) |
| Type | Program type classification for this stage |
| Start Year | Fiscal year of this stage |
| Projects | Number of projects in this stage |
| Amount | Total estimated cost for projects in this stage (₱) |
| Actions | **View Details** button — navigates to Program Details for this specific stage |

---

**Step-by-Step: Viewing the Program List**

1. Select **Programs** from the sidebar.
2. The Program List loads and displays all available programs in the table.

[Insert Screenshot: Program List Screen]

---

**Step-by-Step: Searching by Program Name**

1. Type a keyword into the **Search Programs** field.
2. Press **Enter** or click the **Search** button.
3. The list refreshes showing only programs whose names match the keyword.
4. To remove the search, click the **Clear** button (appears when a search is active).

---

**Step-by-Step: Filtering Programs**

1. Click the **Filters** button.
2. In the Filter Programs dialog, select any combination of **Start Year**, **Program Group**, and **Program Stage**.
3. Click **Apply** to refresh the list with the selected filters.
4. To remove all filters without closing the dialog, click **Clear Filters**.
5. A count badge on the **Filters** button shows how many filters are currently active.

[Insert Screenshot: Filter Programs Dialog]

---

**Step-by-Step: Expanding a Program Row (View Stages)**

1. Click the **program name** in the Name column.
2. The row expands to reveal a sub-table listing all budget stages under that program.
3. Click the **program name** again to collapse the row.
4. Only one program row can be expanded at a time — expanding a new row collapses the previously expanded row.

[Insert Screenshot: Expanded Program Row with Stages]

---

**Step-by-Step: Opening Program Details (View)**

**Option A — from the main row:**

1. Locate the program in the list.
2. Click the **View** button (orange) in the Actions column.
3. The Program Details page opens for the program's current stage.

**Option B — from an expanded stage row:**

1. Expand the program row by clicking the program name.
2. In the stages sub-table, click **View Details** for the desired stage.
3. The Program Details page opens for that specific stage.

---

**Step-by-Step: Deleting a Program**

1. Locate the program in the list.
2. Click the **Delete** button (red trash icon) in the Actions column.
3. The Delete Program dialog opens and displays the program name and a warning that the action cannot be undone.
4. Type **DELETE** (in capitals) in the confirmation field.
5. Click **Yes, Delete** to confirm, or **Cancel** to abort.

[Insert Screenshot: Delete Program Dialog]

**On Success (Delete):** The program is permanently removed and the list refreshes automatically.

---

**On Success (Program List):** The Programs page loads and displays all programs. Search and filter results update the table without reloading the page. The pagination bar at the bottom shows the current page range and total count.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"No programs found"* | No programs match the current search or filter criteria. | Clear the search or filters and try again with different criteria. |
| Delete button is clicked but the program name is still showing | The confirmation text was not typed correctly. | Re-type **DELETE** exactly (all capitals) in the confirmation field before submitting. |
| Filters badge shows a number | One or more filters are active in addition to (or instead of) a name search. | Open Filters and click Clear Filters to remove them if the result set seems incomplete. |

---

#### 5.2.2 Add Program

**Purpose:** Create a new multi-year budget program under which projects will be organized.

**Who uses this:** DEO, RO, PS Admin

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Program Name | Auto-generated from Stage + Start Year (e.g. "BP 2025") | Read-only; cannot be typed directly |
| 2 | Sub Name | Optional additional label appended to the auto-generated name | Text input; optional |
| 3 | Start Year | Fiscal year of the program | Numeric input; required |
| 4 | Program Type * | Classification of the program | Dropdown (Code Tables → Program → Program Type); required |
| 5 | Program Stage * | Initial budget stage | Dropdown (Code Tables → Program → Program Stage); required; disabled when Type = TF |
| 6 | Skip Reason | Reason for skipping a stage | Text input; required only when the selected stage skips one or more prior stages |
| 7 | User Groups | Groups that can access this program | Multi-select checkbox list; required |
| 8 | Data Security Access | Offices with data visibility access | Multi-select checkbox list; required |
| 9 | Cancel | Discard the form without saving | Button |
| 10 | Submit | Save the new program | Button |

> **TF Programs:** Selecting Program Type = TF automatically locks the Stage to the final stage and sets the Program Name to `TF{Year}` (e.g. "TF2025"). The Stage dropdown is disabled in this case.

**Step-by-Step:**

1. On the Program List screen, click **Add Program**.
2. Select the **Start Year** and **Program Type** — the **Program Name** is auto-generated from these selections and cannot be edited directly.
3. Optionally enter a **Sub Name** — an additional label appended to the auto-generated name (e.g. "Metro Manila").
4. Select the **Program Stage**.
5. If the selected stage skips one or more prior stages, a **Skip Reason** field appears — enter the reason.
6. Select the **User Groups**.
7. Select the **Data Security Access** organizations.
8. Click **Cancel** to discard, or click **Submit** to save.

[Insert Screenshot: Add Program Dialog]

**On Success:** The newly created program appears in the Program List. Projects can then be added under it.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Name: The Name field is required."* | The program name (Sub Name) was left blank. | Enter a program name in the Sub Name field before clicking Submit. |
| *"Program Type is required."* | The Program Type dropdown was left blank when clicking Submit. | Select a Program Type before clicking Submit. |
| *"Program Stage is required."* | The Program Stage dropdown was left blank (and Program Type ≠ TF) when clicking Submit. | Select a Program Stage before clicking Submit. |

---

#### 5.2.3 View Program Details

**Purpose:** View all information for a specific program and access program management actions.

**Who uses this:** DEO, RO, PS Admin

**Program Details Fields:**

| Field | Description |
|-------|-------------|
| Name | Program name |
| Start Year | Fiscal year of the program |
| Program Type | Classification of the program |
| Cost | Total cost (derived from Project Details) |
| Status | Working or Approved |
| User Groups | Groups with access to this program |
| Data Security Access | Data visibility restriction |
| Created Date | Date the program was created |
| Created By | User who created the program |

**Available Actions:**

| Action | Description |
|--------|-------------|
| Next Program Stages | Advance the program to the next budget stage (e.g., NEP → GAA) |
| Add Project | Open the project creation form |
| Add Existing Project | Link an existing project to this program |
| Batch Actions | Batch delete or manage publishing for multiple projects |
| Actions | Download template, import projects, export projects, generate reports |

[Insert Screenshot: Program Details Screen]

**On Success:** The Program Details page loads and displays the program record without errors.

---

#### 5.2.4 Program Stages

**Purpose:** Advance a program through its budget lifecycle stages.

**Who uses this:** DEO, RO, PS Admin

**Stage Progression:**

| From Stage | To Stage | Notes |
|---|---|---|
| Budget Proposal (BP) | NEP | Stages can be skipped if required |
| National Expenditure Program (NEP) | NEP-E | Stages can be skipped if required |
| National Expenditure Program with Errata (NEP-E) | HGAB | Stages can be skipped if required |
| House General Appropriations Bill (HGAB) | HGAB-I | Stages can be skipped if required |
| House General Appropriations Bill with amendments (HGAB-I) | GAA | Stages can be skipped if required |
| General Appropriations Act (GAA) | GAA-R | Allow Publishing becomes available |

**Step-by-Step:**

1. Open a program in Program Details.
2. Click **Next Program Stages**.
3. Advance through each stage as required — stages may be skipped when necessary. Allow Publishing becomes available at GAA-R.

[Insert Screenshot: Program Stages]

**On Success:** The program stage is updated. All stages passed through are recorded and available within the program.

---

#### 5.2.5 Batch Restore Projects

**Purpose:** Restore one or more previously deleted projects back into the current program. Use this when projects were deleted and need to be recovered without re-encoding them from scratch.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** The program must be active and below stage GAA-R (Stage ID < 10).

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Project IDs | The IDs of deleted projects to restore | Text area; enter one or more project IDs separated by commas, spaces, semicolons, or line breaks; required |
| 2 | Restore Projects | Submit the restore request | Button (indigo); opens a confirmation dialog before proceeding |
| 3 | Cancel | Close the dialog without restoring | Button |

**Step-by-Step:**

1. Open a program in Program Details.
2. Click **Add Existing Project**. The Batch Restore Projects dialog opens.
3. In the **Project IDs** text area, enter the IDs of the projects to restore. You may paste a list — the system accepts IDs separated by commas, spaces, semicolons, or line breaks.
4. Click **Restore Projects**. A confirmation dialog shows the program name and the count of project IDs detected.
5. Confirm to proceed.

[Insert Screenshot: Batch Restore Projects Dialog]

**On Success:** A success toast ("Projects restored successfully.") appears and the project list refreshes to show the restored projects.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please enter project IDs before submitting."* | The text area was empty when Restore Projects was clicked. | Enter at least one project ID before submitting. |
| *"Failed to restore projects. Please try again."* | A server error prevented the restore. | Verify the project IDs are correct; retry or contact the administrator. |

---

#### 5.2.6 Batch Actions

**Purpose:** Perform bulk operations on multiple projects within a program.

**Who uses this:** PS Admin (Allow/Restrict Publishing); DEO, RO, PS Admin (Batch Delete)

---

**Allow Publishing** — *PS Admin only; available at GAA-R stage*

**Step-by-Step:**

1. Open a GAA-R program.
2. Click **Batch Action** → **Allow Publishing**.
3. Enter the Project IDs to allow (separate multiple IDs with colons, commas, or spaces).
4. Click the green **Allow Publishing** button.

**On Success:** The selected projects become publishable to PCMA.

---

**Restrict Publishing** — *PS Admin only; available at GAA-R stage*

**Step-by-Step:**

1. Open a GAA-R program.
2. Click **Batch Action** → **Restrict Publishing**.
3. Enter the Project IDs to restrict.
4. Click the orange **Restrict Publishing** button.

**On Success:** The selected projects are excluded from publishing.

---

**Batch Delete**

**Step-by-Step:**

1. Click **Batch Actions** → **Batch Delete**.
2. Enter the Project ID(s) to delete.
3. Type `DELETE` in the confirmation field.
4. Click **Yes, Delete Projects**.

**On Success:** The selected projects are permanently deleted.

> **Warning:** Batch Delete cannot be undone.

---

#### 5.2.7 Program Actions Menu

**Purpose:** Access program-level operations: template download, bulk import/export, and AIP report generation.

**Who uses this:** DEO, RO, PS Admin

---

**Download Template**

**Step-by-Step:**

1. Open a program.
2. Click **Actions** → **Download Template**.

**On Success:** An Excel template file is saved to the download folder.

---

**Import Projects**

**Step-by-Step:**

1. Open a program.
2. Click **Actions** → **Import Projects**.
3. Select the filled-in Excel template file.

**On Success:** Projects from the Excel file are uploaded and appear in the program's project list.

---

**Export Projects**

**Step-by-Step:**

1. Open a program.
2. Click **Actions** → **Export Projects**.

**On Success:** The program's project data is downloaded as an Excel file.

---

**Generate Reports**

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Report Type | Type of report | Dropdown; required |
| 2 | Stage Name | Program stage for the report | Dropdown; required |
| 3 | Category | Project expenditure category | Dropdown; required |
| 4 | Region | Target region | Dropdown; required |
| 5 | District Engineering Office | Target DEO | Dropdown; optional |
| 6 | Implementing Office | Target implementing office | Dropdown; optional |
| 7 | Operating Unit | Target operating unit | Dropdown; optional |
| 8 | Legislative District | Target legislative district | Dropdown; optional |
| 9 | Generate Report | Generate and download the report as a PDF | Button |

**Step-by-Step:**

1. Open a program.
2. Click **Actions** → **Generate Reports**.
3. Fill in the required and optional report parameters.
4. Click **Generate Report**.

[Insert Screenshot: Generate Reports Dialog]

**On Success:** The report is automatically downloaded as a PDF file.

---

### 5.3 Projects

**Purpose:** Create and manage individual infrastructure projects. Each project captures detailed location, organizational, funding, cost, and scope information.

**Who uses this:** DEO, RO, PS Admin

---

#### 5.3.1 Add Project

**Purpose:** Create a new infrastructure project under an existing program, capturing all project details including location, organizational responsibilities, and implementation readiness.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** A program must exist (see Section 5.2.2). Navigate to Program Details and click Add Project.

**Field Reference:**

*Project Details*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Project ID | Auto-generated project identifier | Read-only; system-generated |
| 2 | Multi-Year ID | Multi-year program reference | Text input; optional |
| 3 | Alternate ID | Alternate reference identifier | Text input; optional |
| 4 | External ID | External system reference | Text input; optional |
| 5 | UACS | Unified Accounts Code Structure | Text input; optional |
| 6 | Tier | Project funding tier | Dropdown; optional |
| 7 | Category | Project expenditure category | Dropdown (Code Tables → Project Details → Category); required |
| 8 | Sub Category | Sub-classification under category | Dropdown; required |
| 9 | MYCA Approval Date | Date of MYCA approval | Date input; required |
| 10 | Description | Brief project description | Text area; required |

*Location Details*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Province | Project province | Dropdown (Code Tables → Admin Areas); required |
| 2 | City / Municipality | Project city or municipality | Dropdown (filtered by Province); required |
| 3 | Legislative District | Legislative district | Dropdown; required |

*Organizational Responsibilities*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | District Engineering Office | Responsible DEO | Dropdown (Code Tables → Admin Areas → DEO); required |
| 2 | Region | Regional office | Dropdown; required |
| 3 | Implementing Office | Office responsible for implementation | Dropdown; required |
| 4 | Operating Unit | UACS operating unit | Dropdown; required |
| 5 | Region Wide | Indicates if project spans entire region | Toggle; required |

*Project Source*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Origin | Source of the project | Dropdown (Code Tables → Project Details → Origin); required |
| 2 | Originating Agency | Agency that originated the project | Dropdown (Code Tables → Project Details → Agency); required |

*Implementation Readiness and Modality*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Implementation Mode | Mode of implementation | Dropdown; required |
| 2 | Emergency Mode | Emergency designation | Dropdown; required |
| 3 | ROW Available | Right-of-way availability status | Dropdown; required |
| 4 | Feasibility Study | Feasibility study completion status | Dropdown (Yes / No); required |
| 5 | Feasibility Date | Date of feasibility study | Date input; required if Feasibility Study = Yes |
| 6 | Detailed Design | Detailed design completion status | Dropdown (Yes / No); required |
| 7 | Detailed Design Date | Date of detailed design | Date input; required if Detailed Design = Yes |
| 8 | Save Project | Save the new project | Button |

**Step-by-Step:**

1. Open a program in Program Details.
2. Click **Add Project**.
3. Complete all **Project Details** fields (Project ID is auto-generated; no input required).
4. Complete all **Location Details** fields.
5. Complete all **Organizational Responsibilities** fields.
6. Complete all **Project Source** fields.
7. Complete all **Implementation Readiness and Modality** fields.
8. Click **Save Project**.

[Insert Screenshot: Add Project Screen]

**On Success:** The newly created project appears in the Projects module and is available for selection within a program.

**Project ID Structure:**

A Project ID is composed of four concatenated segments, each encoding a specific attribute of the project.

**Segment 1 — Stage**

Indicates the current pipeline stage of the project.

| Code | Stage |
|------|-------|
| `BP` | Budget Proposal |
| `P` | NEP (National Expenditure Program) and above |

**Segment 2 — Year**

A numeric code representing the fiscal year. The sequence starts at `01` for 2017 and increments by 1 each year.

| Code | Fiscal Year |
|------|------------|
| `01` | 2017 |
| `02` | 2018 |
| `03` | 2019 |
| `04` | 2020 |
| `05` | 2021 |
| `06` | 2022 |
| `07` | 2023 |
| `08` | 2024 |
| `09` | 2025 |
| `010` | 2026 |

**Segment 3 — Project Sequence**

A 5-digit number representing the unique identifier within the selected project category (e.g., `05001`). Assigned automatically by the system.

**Segment 4 — Island Code**

Identifies the island group or region associated with the project (e.g., `LZ` = Luzon, `VS` = Visayas, `MN` = Mindanao).

> **Special suffixes:** Lump Sum projects append `LS` at the end of the Project ID. Non-Project entries append `NP` at the end.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"(Field Name) is required."* | A mandatory field (red asterisk) was left blank. | Complete all required fields before clicking Save Project. |

---

#### 5.3.2 Funding Profile

**Purpose:** Define the budget allocation for the project by specifying funding sources, agreements, and amounts. Must be completed before Component Cost is available.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** Project Details must be saved first (see Section 5.3.1).

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Source | Funding source organization | Dropdown (Code Tables → Funding Profile → Funding Source); required |
| 2 | Agreement | Loan or grant agreement | Dropdown (Code Tables → Funding Profile → Funding Agreement); required |
| 3 | Amount | Allocated budget amount | Numeric input; required |
| 4 | Add Funding | Add a new funding row | Button (blue) |
| 5 | Delete | Remove a funding row | Button |

**Step-by-Step:**

1. Navigate to the **Funding Profile** section within the project.
2. Click the blue **Add Funding** button.
3. Select the **Source**.
4. Select the **Agreement**.
5. Enter the **Amount**.
6. Repeat for additional funding sources as needed.
7. Click **Delete** to remove a funding row if necessary.

[Insert Screenshot: Funding Profile Section]

**On Success:** The allocated budget is recorded and reflected as available budget in the Component Cost section.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Total funding percentage must equal 100%. Current total: 0.0%."* | No funding amount has been entered or the total does not reach 100%. | Enter valid funding amounts so that the total allocation equals 100% of the project budget. |

---

#### 5.3.3 Component Cost

**Purpose:** Record the project budget breakdown by component, cost year, and amount. Component entries generate Component IDs (e.g., `CW1`, `ROW`, `FS`) that are later referenced by Major Items of Work.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** Funding Profile must be populated (see Section 5.3.2).

---

**Component Cost Table Columns:**

| Column | Description |
|--------|-------------|
| Component Type | Classification of the cost component (e.g., Civil Works, ROW Acquisition) |
| Component ID | Auto-generated identifier derived from the Component Type (e.g., `CW1`, `EAO`) |
| Description | Narrative description of the component |
| Total | Sum of all per-year amounts for this component |
| Actions | **Edit** button (pencil icon) and **Delete** button (trash icon) |

> A running **Total Component Cost** and **Budget Status** indicator is displayed below the table. If the total exceeds the Funding Profile amount, the indicator turns red and a warning is shown.

---

**Field Reference — Component Cost Toolbar:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Add Component | Opens the Add Component Cost dialog | Button (blue); disabled when the project is read-only |
| 2 | Edit (pencil icon) | Opens the Edit Component Cost dialog for the selected row | Per-row button |
| 3 | Delete (trash icon) | Opens the Delete Component confirmation dialog | Per-row button |

---

**Field Reference — Add / Edit Component Cost Dialog:**

The dialog title is **"Add Project Component Cost"** (add mode) or **"Edit Project Component Cost"** (edit mode).

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Component Type | Classification of the component | Dropdown (Code Tables → Component Cost types); required |
| 2 | Component ID | System-generated identifier derived from Component Type | Read-only text field; auto-populated when Component Type is selected |
| 3 | Description | Narrative description of the component | Text area; optional — can be auto-filled using the **Auto-fill** button |
| 4 | Auto-fill | Fetches a suggested description from GIS data for the selected component | Link button (sparkle icon); enabled only when a Component Type is selected |
| 5 | Cost Breakdown by Year | Section containing one or more per-year cost rows | Repeating group |
| 6 | Year | Fiscal year for this cost entry | Numeric input; pre-filled to Program Start Year; required |
| 7 | Amount | Budget amount for this year (₱) | Numeric input; required; must be > 0 |
| 8 | Start Date | Implementation start date for this year | Date input; required |
| 9 | End Date | Implementation end date for this year | Date input; required |
| 10 | Add Year | Add a new per-year cost row to the component | Button (blue); each click adds one row starting from the next year |
| 11 | Delete per-year row | Remove a per-year cost row | Per-row trash icon; new (unsaved) rows are hard-deleted; existing rows are soft-deleted |
| 12 | Total | Sum of all per-year amounts; automatically calculated | Read-only; displayed at the bottom of the dialog |
| 13 | Cancel / ✕ | Discard changes and close the dialog | Button |
| 14 | Save / Submit | Validate and save the component cost | Button (blue) |

**Component ID Auto-generation Rules:**

| Component Type | Generated Component ID | Notes |
|---|---|---|
| Civil Works (first entry) | `CW1` | Increments to `CW2`, `CW3`, etc. for each additional Civil Works entry |
| ROW Acquisition | `ROW` | Fixed; no increment |
| Feasibility Study | `FS` | Fixed |
| Detailed Engineering Design | `DED` | Fixed |
| Lump Sum | `LS` | Fixed |
| Other types | Derived from Code Table `ComponentId` field | As configured in Code Tables |

> **Note:** Component Types `EAO`, `EXC`, `SAV`, `COS`, `FS`, `DED`, `LS`, `OTH3`, `OTH4`, `OTH2`, `EXP`, `CS` are excluded from the Major Items of Work component dropdown to prevent linking invalid cost types.

---

**Step-by-Step: Adding a Component Cost**

1. Navigate to the **Component Cost** section within the project.
2. Click **Add Component**. The Add Component Cost dialog opens.
3. Select the **Component Type** — the **Component ID** is auto-generated and cannot be edited.
4. Optionally enter or auto-fill the **Description**.
5. Click **Add Year** to add a cost row.
6. Enter the **Year**, **Amount** (₱), **Start Date**, and **End Date** for that row.
7. Repeat step 5–6 for each additional fiscal year as needed.
8. Click **Save** to save the component.

**Step-by-Step: Editing a Component Cost**

1. Click the **Edit** (pencil) button on the component row to be changed.
2. Modify the **Description** or any **per-year cost row**.
3. Click **Save** to apply changes.

**Step-by-Step: Deleting a Component Cost**

1. Click the **Delete** (trash) button on the component row to be removed.
2. Confirm the deletion in the Delete Component dialog.
3. Click **Yes, Delete** to confirm or **Cancel** to abort.

> **Warning:** Deleting a Component Cost also removes any Major Items of Work that reference that Component ID.

[Insert Screenshot: Component Cost Section]
[Insert Screenshot: Add Component Cost Dialog]
[Insert Screenshot: Delete Component Dialog]

**On Success:** The Component Cost entry is saved. The **Total Component Cost** updates immediately. The Major Items of Work section can now reference the new Component ID.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please select a Component Type."* | The Component Type dropdown was left blank when clicking Save. | Select a Component Type before clicking Save. |
| *"Please add at least one per-year cost."* | No per-year rows were added before clicking Save. | Click **Add Year** and fill in at least one year entry. |
| *"Please enter a valid year for cost entry N."* | A year row has a blank or zero Year field. | Enter a valid fiscal year for that row. |
| *"Please enter a valid amount for cost entry N."* | A year row has a blank or zero Amount field. | Enter a valid amount greater than zero. |
| *"Please select a Start Date for cost entry N."* | The Start Date field of a year row is empty. | Select a start date. |
| *"Please select an End Date for cost entry N."* | The End Date field of a year row is empty. | Select an end date. |
| *"Total amount must be greater than zero."* | All per-year amounts were zero or blank. | Enter at least one year row with an amount > 0. |
| *"This cost will exceed the maximum budget by ₱X."* (confirmation prompt) | The total component cost would exceed the Funding Profile allocation. | Click **OK** to proceed anyway, or **Cancel** and reduce the amount or increase the Funding Profile allocation. |

---

#### 5.3.4 Major Items of Work

**Purpose:** Link each Component Cost entry to a specific infrastructure type and type of work. Each Major Item can hold one or more Work Location rows that describe the physical scope.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** At least one Component Cost entry must exist (see Section 5.3.3).

---

**Major Items of Work Table Columns:**

| Column | Description |
|--------|-------------|
| Component | Component ID the major item is linked to (e.g., `CW1`) |
| Year of Work | Fiscal year this work is planned |
| Infrastructure Type | Type of infrastructure (e.g., Road, Bridge, Local Road) |
| Type of Work | Specific scope of work (e.g., Asphalt Overlay, Repair) |
| Target Unit | Unit of measure for physical target (derived from Type of Work) |
| Actions | Expand/collapse row, **Edit** button, **Delete** button; expand shows the Work Locations sub-table |

---

**Field Reference — Add / Edit Major Item Dialog:**

The dialog title is **"Add Project Major Item of Works"** (add mode) or **"Edit Project Major Item of Works"** (edit mode).

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Component | Component Cost entry to link this major item to | Dropdown (only non-excluded active components); required; **locked in edit mode** |
| 2 | Year of Work | Fiscal year this work item applies to | Numeric input; defaults to Program Start Year; minimum = Program Start Year; required |
| 3 | Infrastructure Type | Type of infrastructure | Dropdown (Code Tables → Infrastructure Types); filters based on Component — if Component = `ROW`, only shows types that have a **ROW Acquisition** work type; required; **locked in edit mode** |
| 4 | Type of Work | Specific work type, filtered by the selected Infrastructure Type | Dropdown (only work types matching the selected Infrastructure Type); if Component = `ROW`, restricted to **ROW Acquisition** entries only; required; **locked in edit mode** |
| 5 | Cancel | Discard changes and close the dialog | Button |
| 6 | Add Item / Update Item | Save the major item | Button (orange) |

**Add Mode — Component Availability:**

> In **add mode**, each Component ID can only be used once. Components already assigned to an existing major item are excluded from the dropdown. If all components have already been assigned, the Component dropdown is empty and the Add Item button is disabled.

**Excluded Component IDs (cannot be selected in Major Items of Work):**

`EAO`, `EXC`, `SAV`, `COS`, `FS`, `DED`, `LS`, `OTH3`, `OTH4`, `OTH2`, `EXP`, `CS`

---

**Step-by-Step: Adding a Major Item of Work**

1. Navigate to the **Major Items of Work** section within the project.
2. Click **Add Item**. The Add Major Item of Works dialog opens.
3. Select the **Component** — only unassigned, eligible components appear.
4. Enter or confirm the **Year of Work** (defaults to Program Start Year).
5. Select the **Infrastructure Type** — the list is automatically filtered based on the selected Component.
6. Select the **Type of Work** — the list is filtered by the chosen Infrastructure Type.
7. Click **Add Item** to save.

**Step-by-Step: Editing a Major Item of Work**

1. Click the **Edit** (pencil) button on the major item row.
2. The Edit dialog opens. **Component**, **Infrastructure Type**, and **Type of Work** are locked and cannot be changed.
3. Modify the **Year of Work** if needed.
4. Click **Update Item** to save.

**Step-by-Step: Deleting a Major Item of Work**

1. Click the **Delete** (trash) button on the major item row.
2. Confirm deletion in the Delete Major Item dialog.
3. Click **Yes, Delete** to confirm or **Cancel** to abort.

> **Warning:** Deleting a Major Item also removes all Work Locations linked to that item.

[Insert Screenshot: Major Items of Work Section]
[Insert Screenshot: Add Major Item of Works Dialog]

**On Success:** The major item is saved and appears in the table. Clicking the expand arrow on the row opens the Work Locations sub-table for that item.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please select an item in the list."* | Component field is blank on submit. Browser-native validation tooltip on the required dropdown. | Select a component from the dropdown. |
| *"No components available. Please add more components first."* | All eligible components are already assigned to existing major items. | Add a new Component Cost entry (Section 5.3.3) before adding another major item. |
| *"Please select an item in the list."* | Infrastructure Type field is blank on submit. Browser-native validation tooltip on the required dropdown. | Select an Infrastructure Type. |
| *"Please select an item in the list."* | Type of Work field is blank or set to the placeholder value. Browser-native validation tooltip on the required dropdown. | Select a Type of Work. If the list is empty, verify the selected Infrastructure Type is correct. |
| *"Please enter a valid year"* | Year of Work is out of the valid range (< 1900 or > 2100). | Enter a valid fiscal year. |

---

#### 5.3.5 Work Locations

**Purpose:** Enter the physical location, scope, and targets for each Major Item of Work. Each Major Item can have multiple Work Location rows. Required fields and the Infrastructure ID mechanism vary by Infrastructure Type.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:** At least one Major Item of Work must exist (see Section 5.3.4). Work Locations are accessed by expanding a Major Item row.

---

**Infrastructure ID (InfraId) Logic:**

How the **Infrastructure ID** for each Work Location row is determined depends on the Infrastructure Type:

| Infrastructure Type | InfraId Source | How to Set It |
|---|---|---|
| **National Road** (InfraCode = `R`) | Selected from RBIA Road Section inventory | Click the **Search / Edit** icon on the row; the Select Infrastructure dialog opens automatically to the **Road Sections** tab |
| **National Bridge** (InfraCode = `B`) | Selected from RBIA Bridge inventory | Click the **Search / Edit** icon on the row; the Select Infrastructure dialog opens automatically to the **Bridges** tab |
| **All other types** (Local Road, Local Bridge, etc.) | Auto-generated by the system using the Infrastructure Type prefix (e.g., `LRD00001`) | Generated automatically when clicking **Add Work Location**; user does not need to search |

> **Auto-generated IDs** are assigned immediately when the row is created. Copying a row (`Copy` button) generates a new unique ID for the copy.

**Auto-generated ID Prefixes by Infrastructure Type:**

| Infrastructure Type | ID Prefix | Example |
|---|---|---|
| Accessibility Facility | `AF` | `AF00001` |
| Consultancy | `CS` | `CS00001` |
| Flood Control Structures | `FCS` | `FCS00001` |
| Hospitals | `HSP` | `HSP00001` |
| Local Bridges | `LBR` | `LBR00001` |
| Local Roads | `LRD` | `LRD00001` |
| Local Flood Control Structures | `LFCS` | `LFCS00001` |
| Multi-Purpose Buildings | `MPB` | `MPB00001` |
| Non-Infra | `NI` | `NI00001` |
| Other Buildings | `OTB` | `OTB00001` |
| Rain Water Collector | `RWC` | `RWC00001` |
| School Buildings | `SCH` | `SCH00001` |
| Septage & Sewerage Plants | `SPS` | `SPS00001` |
| Water Supply Systems | `WSS` | `WSS00001` |

---

**Work Locations Table Columns (per Major Item):**

| Column | Description |
|--------|-------------|
| Infrastructure ID | The InfraId for this work location row (road section ID, bridge ID, or auto-generated) |
| Detailed Scope of Work | Text description of the scope |
| Physical Target | Numeric target quantity (unit from Type of Work) |
| Start Station Limit | Starting LRP/station reference (Roads only) |
| End Station Limit | Ending LRP/station reference (Roads only) |
| Start Chainage | Start chainage value in meters (Roads only) |
| End Chainage | End chainage value in meters (Roads only) |
| Length | Length of work in the target unit |
| Start X / Start Y | Geographic coordinates of the start point (non-Road types) |
| End X / End Y | Geographic coordinates of the end point (non-Road types; optional) |
| Actions | **Copy** (duplicate row), **Edit** (road/bridge types only), **Delete** |

---

**Field Reference — All Infrastructure Types (common fields):**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Infrastructure ID | Identifier for the infrastructure asset | Auto-generated for local types; selected from RBIA for road/bridge types |
| 2 | Detailed Scope of Work | Textual description of the specific scope | Text input; must not be a duplicate of another active row with the same Station/Chainage values |
| 3 | Physical Target | Quantity of work (in units from Type of Work) | Numeric input; null/0 is allowed |
| 4 | Length | Length of the work section | Numeric; required for Roads (derived from chainages); optional for length-based types; allowed null for non-length units |
| 5 | Add Work Location | Add a new work location row for this Major Item | Button; auto-generates InfraId for non-road/bridge types |
| 6 | Copy | Duplicate an existing row; generates a new InfraId if auto-generated type | Per-row button |
| 7 | Edit (search icon) | Open the Select Infrastructure dialog to change the road section or bridge (Road and Bridge types only) | Per-row button; not available for auto-generated types |
| 8 | Delete (trash icon) | Open the Delete Work Location dialog | Per-row button |

---

**Field Reference — Road-Specific Fields (InfraCode = `R`):**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Start Station Limit | Starting LRP station reference | Text input; auto-fillable from Start Chainage |
| 2 | End Station Limit | Ending LRP station reference | Text input; auto-fillable from End Chainage |
| 3 | Start Chainage | Starting chainage in meters | Numeric input; required for Roads |
| 4 | End Chainage | Ending chainage in meters; must be > Start Chainage | Numeric input; required for Roads |
| 5 | Auto-fill Station (→ button) | Converts chainage to station limit using the road's LRP data | Button next to Start/End Station Limit field |
| 6 | Auto-fill Chainage (→ button) | Converts station limit to chainage using the road's LRP data | Button next to Start/End Chainage field |

---

**Field Reference — Coordinate Fields (non-Road types, optional):**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Start X | Longitude of the start point | Numeric; valid Philippine range: 116.67 – 126.60 |
| 2 | Start Y | Latitude of the start point | Numeric; valid Philippine range: 4.67 – 21.17 |
| 3 | End X | Longitude of the end point | Numeric; optional |
| 4 | End Y | Latitude of the end point | Numeric; optional |

---

**Field Reference — Select Infrastructure Dialog (Road and Bridge types):**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Tab | Selects the data source | Road Sections (for `R`) or Bridges (for `B`); pre-selected based on Infrastructure Type |
| 2 | Search | Filter term | Text input; searches Road Section ID or Bridge ID |
| 3 | Search button | Executes the search | Button |
| 4 | Filter by Road Section | (Bridge tab only) Narrows bridge list by road section | Dropdown; populated by the user's DEO road sections |
| 5 | Page Size | Records per page | Dropdown: 10, 25, 50, 100 |
| 6 | Select row | Marks a road section or bridge for use | Click any table row; selected row is highlighted |
| 7 | Confirm | Assigns the selected infrastructure to the Work Location row | Button; disabled until a row is selected |
| 8 | Cancel / ✕ | Close the dialog without selecting | Button |

---

**Step-by-Step: Adding a Work Location for a National Road**

1. Expand the Major Item row (click the chevron/arrow).
2. Click **Add Work Location** — a new row appears with an empty Infrastructure ID.
3. Click the **search/edit icon** (Edit button) on the new row. The Select Infrastructure dialog opens to the **Road Sections** tab.
4. Search for and select the road section. Click **Confirm**.
5. Enter **Detailed Scope of Work**.
6. Enter **Physical Target**.
7. Enter **Start Chainage** and **End Chainage** (End must be > Start).
8. Optionally click the **Auto-fill Station** arrows to populate Start/End Station Limits from the chainage values.
9. The **Length** is calculated automatically from the chainage difference.

---

**Step-by-Step: Adding a Work Location for a National Bridge**

1. Expand the Major Item row.
2. Click **Add Work Location**.
3. Click the **search/edit icon**. The Select Infrastructure dialog opens to the **Bridges** tab.
4. Optionally filter by **Road Section** (filtered to the current DEO's road sections).
5. Search for and select the bridge. Click **Confirm**.
6. Enter **Detailed Scope of Work**.
7. Enter **Physical Target** and **Length**.

---

**Step-by-Step: Adding a Work Location for Local / Other Infrastructure Types**

1. Expand the Major Item row.
2. Click **Add Work Location** — the system **auto-generates an Infrastructure ID** (e.g., `LRD00001`) using the Infrastructure Type prefix (see prefix table above). No manual selection is needed.
3. Enter **Detailed Scope of Work**.
4. Enter **Physical Target** and **Length**.
5. Optionally enter **Start X/Y** and **End X/Y** coordinates.

---

**Step-by-Step: Copying a Work Location Row**

1. Click the **Copy** button on an existing row.
2. A new row is created with the same data. For auto-generated types, a new unique Infrastructure ID is assigned. For road/bridge types, the same InfraId is kept.
3. The Detailed Scope is appended with `(Copy)` to indicate it is a duplicate.
4. Edit the copy as needed.

---

**Step-by-Step: Deleting a Work Location**

1. Click the **Delete** (trash) icon on the row.
2. Confirm deletion in the Delete Work Location dialog.
3. Click **Yes, Delete** or **Cancel**.

[Insert Screenshot: Work Locations — Road type with chainage fields]
[Insert Screenshot: Work Locations — Bridge type with Select Infrastructure dialog]
[Insert Screenshot: Work Locations — Local/Other type with auto-generated ID]

**On Success:** Work location data is saved and linked to the selected Major Item of Work. Valid coordinate data is displayed on the Project Location Map (Section 5.3.7).

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Start and End Chainage are required for Roads."* | A Road work location's Start Chainage or End Chainage was cleared (left empty). Both default to `0` and do not trigger this message on their own. | Re-enter both Start Chainage and End Chainage values before saving. |
| *"Length must be greater than or equal to 0."* | Length was entered as a negative number. | Enter a non-negative length value. |
| *"Length must be less than or equal to (max)."* | Length exceeds the maximum allowed for the work type. | Reduce the length value. |
| *"Please select an infrastructure item"* | Confirm was clicked in the Select Infrastructure dialog without selecting a row. | Click on a row in the dialog table to select it before clicking Confirm. |
| Detailed Scope shows a duplicate warning | The same Detailed Scope + Chainage/Station combination already exists on another active row. | Change the Detailed Scope text or chainage values to make this row unique. |

---

#### 5.3.6 Supporting Documents

**Purpose:** Attach PDF supporting documents (approvals, feasibility studies, design documents) to the project record.

**Who uses this:** DEO, RO, PS Admin

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Document Type | Classification of the document | Dropdown; required |
| 2 | Note Description | Brief description of the document | Text input; required |
| 3 | File Upload | PDF file to attach | File picker; PDF only; required |
| 4 | Submit | Upload and save the document | Button |

**Step-by-Step:**

1. Navigate to the **Supporting Documents** section within the project.
2. Select a **Document Type** from the dropdown.
3. Enter a **Note Description**.
4. Click **Upload** and select a PDF file.
5. Click **Submit**.

[Insert Screenshot: Supporting Documents Section]

**On Success:** The uploaded document is saved and accessible within the project record.

---

#### 5.3.7 Project Location Map (GIS)

**Purpose:** Display an interactive geographic map showing all work locations entered for the project, plotted as colored line or point features on a basemap. Provides a spatial overview of where project activities will take place.

**Who uses this:** DEO, RO, PS Admin (read-only view)

**Prerequisites:** At least one Work Location with valid coordinates or chainage data must be saved under a Major Item of Work (see Section 5.3.5).

**How the Map Works:**

The Project Location Map is rendered using **MapLibre GL** as the base map layer and **deck.gl** for the GeoJSON feature overlay. Work location data is fetched from the GIS service and plotted automatically when the project is opened in edit mode.

The map panel appears at the top of the project form. Click the **Project Location Map** header to expand or collapse it.

**Map Controls:**

| Control | Location | Action |
|---------|----------|--------|
| Zoom In / Zoom Out | Top-right | Adjust zoom level |
| Compass / Reset bearing | Top-right | Reset map orientation |
| Fullscreen | Top-right | Expand map to full screen |
| Pan | Click and drag | Move the map view |

**Step-by-Step:**

1. Open an existing project in edit mode.
2. Scroll to the **Project Location Map** section at the top of the form (or click the header to expand it).
3. The map loads automatically and fits the view to include all plotted work locations.
4. Use the zoom and pan controls to explore specific areas.
5. Click any colored feature on the map to view the location details popup.
6. To edit coordinates, navigate to **Major Items of Work → Work Locations** (Section 5.3.5).

[Insert Screenshot: Project Location Map (GIS) Section]

**On Success:** All saved work locations appear on the map as colored features. If no work locations have been saved yet, the map displays "No map data available."

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|--------------------|---------------|--------------------|
| "No map data available" | The project has no saved work locations with coordinate data. | Add at least one Work Location with valid coordinates or chainage values (Section 5.3.5). |
| "Failed to render map data" | A temporary rendering error occurred. | Refresh the page. If the issue persists, check your network connection or contact support. |
| Map loads but features are not visible | Coordinates may be outside the Philippine bounding box. | Verify that Start X/Y and End X/Y values fall within the valid Philippine range (Section 5.3.5). |

---

### 5.4 Revision

**Purpose:** Submit, track, and process revision requests for projects published to PCMA, following a structured multi-level approval workflow.

**Who uses this:** DEO (submit), RO (first-level review), PS Admin (final approval)

---

#### 5.4.1 Revision List

**Purpose:** View and act on all revision requests accessible to the logged-in user.

**Who uses this:** DEO, RO, PS Admin

**Revision List Table Columns:**

| Column | Description |
|--------|-------------|
| Revision Type | The revision type name (e.g., Adjustment, Termination) |
| Project ID | Transaction ID of the revision (format: `ProjectId-RevisionNumber`, e.g., `P00900117LZ-1`) |
| Reason | The reason selected when the revision was initiated |
| Date | Date the revision request was created |
| Status | Current workflow status badge (see Status Badge Colors below) |
| Action | **View** button — opens the revision in read or review mode |

**Status Badge Colors:**

| Color | Status | Meaning |
|-------|--------|---------|
| Yellow | For Approval | Awaiting review at the current approval level |
| Red (light) | For Correction | Returned to the requester with review comments |
| Red (dark) | Disapproved | Rejected; request is closed |
| Green | Approved | Fully approved; changes are published |
| Gray | Other / Pending | No status yet assigned |

> **Status display logic:** When the Region Office has approved (Region Status = Approved), the displayed status reflects the Central Office status. Otherwise, the Region status is shown.

**Field Reference — Toolbar:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Search Projects | Filter the list by Project ID | Text input; press Enter or click Search to apply |
| 2 | Search | Submit the Project ID search | Button |
| 3 | Clear (✕) | Remove the active search and reload the full list | Appears only when a search term is active |
| 4 | View | Open the revision request in detail view | Per-row button (blue) |

**Step-by-Step:**

1. Select **Revision** from the sidebar.
2. The Revision List loads all accessible revision requests.
3. To search: enter a **Project ID** in the search box and click **Search** or press Enter.
4. To clear the search: click the **✕ Clear** button (visible when a search is active).
5. To view a request: click the **View** button on the desired row.

[Insert Screenshot: Revision List Screen]

**On Success:** All revision requests load and display their current status. Search narrows the list to matching Project IDs without reloading the page.

---

#### 5.4.2 Initiating a Revision — Revise Project Dropdown

**Purpose:** Start a revision request for a project that is published to PCMA. The user selects a revision type from the Revise Project dropdown, which opens the Revision Dialog for Category and Reason selection.

**Who uses this:** DEO, RO, PS Admin

**Prerequisites:**
- The project must be at the **GAA-R** program stage.
- The program must be in **Published / Approved** status (Status = 1).
- For most revision types: the project must not be Already Started, Already Packaged, or Terminated.
- For Change of Creditor and Mode of Implementation: project status must be Terminated.

**Field Reference — Revise Project Dropdown:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Revise Project | Opens the revision type dropdown menu | Button (yellow); visible only on projects at GAA-R stage with published status |
| 2 | Revision Type | List of available revision types | Dropdown menu listing all headers from Code Tables → Revision → Headers; loaded dynamically |

**Step-by-Step:**

1. Navigate to **Projects** and open a project at the GAA-R stage that is published to PCMA.
2. Click the yellow **Revise Project** dropdown button in the top-right action bar.
3. The dropdown expands listing all available **Revision Types** (see Section 5.4.4 for the full list).
4. Click the desired **Revision Type** — the **Revision Dialog** opens immediately.

[Insert Screenshot: Revise Project Dropdown]

---

#### 5.4.3 Revision Dialog — Selecting Category and Reason

**Purpose:** Before navigating to the modification form, the user selects a Category (if applicable) and a mandatory Reason that classifies the purpose of the revision. The dialog title shows the selected revision type name.

**Who uses this:** DEO, RO, PS Admin

**Field Reference — Revision Dialog:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Project ID | Read-only display of the project identifier | Shown in the Project Information panel; not editable |
| 2 | Revision Type | Read-only display of the selected revision type name | Shown in the Project Information panel; not editable |
| 3 | Category | Sub-classification for revision types that require it | Dropdown; visible only when the selected revision type has defined categories; selecting a category filters the available Reasons |
| 4 | Reason | Specific reason for the revision | Dropdown; required; filtered by Revision Type and (if shown) by selected Category; disabled until at least a Revision Type is resolved |
| 5 | Submit | Validate selections and navigate to the modification form | Button; disabled while submitting |
| 6 | Cancel / ✕ | Close the dialog without proceeding | Button |

> **Category filtering:** The Category dropdown is only shown when the selected revision type has associated categories defined in Code Tables. If no categories are defined for the type, the dialog shows only the Reason dropdown.

> **Reason filtering:** Reasons are filtered first by the revision type's group ID, then further narrowed to only the reasons compatible with the selected Category. Changing the Category resets the selected Reason.

**Step-by-Step:**

1. After clicking a Revision Type from the dropdown (see Section 5.4.2), the Revision Dialog opens.
2. The dialog title shows the **Revision Type name**. The **Project Information** panel displays the Project ID and Revision Type (read-only).
3. If a **Category** dropdown is shown, select the appropriate category. The Reason list is filtered accordingly.
4. Select the **Reason** from the dropdown.
5. Click **Submit** to proceed.

> Clicking **Cancel** or the **✕** button closes the dialog and returns to the project without initiating a revision.

[Insert Screenshot: Revision Dialog]

**On Success:** The system navigates to the modification form for the selected revision type, pre-loaded with the project's current data. The form title and editable fields depend on the selected type and reason.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please select an item in the list."* | The Category dropdown is visible but no category was selected before clicking Submit. Browser-native validation tooltip on the required dropdown. | Select a category from the dropdown. |
| *"Please select an item in the list."* | The Reason dropdown was left blank. Browser-native validation tooltip on the required dropdown. | Select a reason before clicking Submit. |
| Yellow **Revise Project** button not visible | The project has not been published to PCMA or is not at GAA-R stage. | Use Allow Publishing in a GAA-R program to publish the project first (see Section 5.2.6). |

---

#### 5.4.4 Revision Types

The following revision types are available in MYPS. When initiating a revision, the system presents all configured types from Code Tables — eligibility conditions are enforced at the server level.

Each revision type has one or more associated **Reasons**, selected in the Revision Dialog (Section 5.4.3). Reasons are managed in **Code Tables → Revision → Reasons**. Some revision types also require a **Category** to be selected before the Reason.

| # | Revision Type | Requires Category |
|---|---------------|:-----------------:|
| 1 | Additional Funding | |
| 2 | Adjustment | |
| 3 | Change in Authority to Implement | |
| 4 | Change in Funding | |
| 5 | Change of Creditor | |
| 6 | Expired Funding | |
| 7 | For Savings — Partial Unutilized Balance | |
| 8 | Mode of Implementation | |
| 9 | Modification | ✓ |
| 10 | Multi-Year Costing Changes | |
| 11 | Non-Implementable | ✓ |
| 12 | Termination | |

> **Termination note:** If the Funding Profile total does not match the Component Cost total on submission, the system will prompt that an excess Component Cost will be created automatically.

---

#### 5.4.5 Modification Form

**Purpose:** After the Revision Dialog is submitted, the modification form opens pre-loaded with the project's current data. The user edits only the fields permitted by the selected revision type, category, reason, and the project's PCMA construction status.

**Who uses this:** DEO, RO, PS Admin

**Form Sections:**

| Section | Description |
|---------|-------------|
| Revision Info | Revision type, category, reason, Transaction ID (once saved), attached documents, and any For Correction history |
| Program Details | Program information — read-only in modification context |
| Project Details | Editable project fields; which fields are active depends on the revision type/reason rules and PCMA status |
| Project Location Map | Geographic view of the project — read-only |
| Component Costs | Add, edit, or delete project cost components as allowed by revision rules |
| Major Items of Work | Work items linked to components; add, edit, copy, or delete as allowed |
| Funding Profile | Funding sources and amounts |
| Notes | Free-text notes for this revision |
| Activity Log | Full history of changes and transactions on this project |

**Field Editability Rules:**

Fields in the modification form are controlled by three factors:

1. **Revision Type / Reason** — each combination has a defined set of allowed fields; all others are grayed out.
2. **PCMA Construction Status** — further restricts editing based on whether the project is Not Yet Started, On-going, Completed, or Terminated.
3. **Server-side field rules** — the API delivers exact per-field permissions overriding all defaults.

| PCMA Situation | Editable Fields |
|---|---|
| Not Yet Started and not packaged | All fields allowed by revision type/reason |
| Not Yet Started or On-going and packaged | Limited fields (Description, some cost fields) |
| Completed or Terminated | No fields are editable |

---

#### 5.4.6 Specific Revision Type Behaviors

**Termination — Unfinished Work Dialog**

When a Termination revision is initiated, a mandatory dialog appears before the modification form loads:

> *"Does this project have unfinished work?"*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Has Unfinished Work | Whether the project has incomplete physical work | Radio buttons: **Yes** / **No**; required |
| 2 | Confirm | Submit the selection and proceed | Button |
| 3 | Cancel / ✕ | Abort the termination and return to the project | Button |

**Step-by-Step:**

1. Select **Termination** from the Revise Project dropdown and complete the Revision Dialog (Section 5.4.3).
2. The **Project Termination** dialog opens automatically.
3. Select **Yes** or **No** for *"Does this project have unfinished work?"*
4. Click **Confirm**.

> **Termination — No Disbursement (Reason ID 37):** The system automatically sets all terminated component amounts to zero and creates an EXC (Excess) component for the total terminated amount. No manual action is needed.

---

**Non-Implementable — Component Selection Dialog**

When a Non-Implementable revision is initiated, a component selection dialog opens before the modification form:

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Component checkbox list | Select which components to mark as non-implementable | Checkbox per row; at least one must be selected |
| 2 | Select All / Deselect All | Toggle all component checkboxes | Header checkbox |
| 3 | Confirm | Proceed with the selected components | Button; disabled when no component is selected |
| 4 | Cancel / ✕ | Abort and return to the project | Button |

**Step-by-Step:**

1. Select **Non-Implementable** and complete the Revision Dialog.
2. The component selection dialog opens showing all project components with their PCMA and Construction statuses.
3. Check the components to mark as non-implementable (at least one required).
4. Click **Confirm**.

---

**Excess Component Warning (ExcessPrompt)**

When a component cost is added or edited and the **Project Cost is greater than the total of all component costs**, the system displays the Excess Component warning:

> *"The Project Cost (₱X) is greater than the Total Project Component Cost (₱Y). Is this an intentional reduction of Project Cost?"*

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | OK | Create an EXC component for the difference | Button; system auto-creates a new `EXC` component |
| 2 | Cancel | Do not create the component; return to the form | Button |

> This prompt applies when the revision type is: Adjustment, Change in Authority to Implement, For Savings — Partial Unutilized Balance, Non-Implementable, or Termination.

---

**Mode of Implementation — New Project Record**

When a **Mode of Implementation** revision is submitted, the system creates a **new project record** to represent the project under its new implementation mode, instead of changing the original project in place.

> The new project's ID is the original Project ID with an **`-A`** suffix (e.g., `P01234567` becomes `P01234567-A`). The original project remains in the system for reference.

**Step-by-Step:**

1. Select **Mode of Implementation** and complete the Revision Dialog.
2. Make the required edits in the modification form (e.g., updated Implementation Mode).
3. Submit the revision as described in Section 5.4.7.

**On Success:** A new project record (`<original Project ID>-A`) is created with the updated implementation mode and follows the standard approval routing.

---

**Other Revision Types (Additional Funding, Adjustment, Change in Authority to Implement, Change in Funding, Change of Creditor, Expired Funding, For Savings — Partial Unutilized Balance, Multi-Year Costing Changes)**

These revision types do not have additional dialogs or special behaviors beyond the standard modification form described in Section 5.4.5. Which fields and sections are editable depends on the selected Reason and the project's PCMA Construction Status (Section 5.4.5, Field Editability Rules) — fields that are not applicable to the selected revision type and reason will appear grayed out in the modification form.

---

**Copy Major Item of Work**

In the modification form, major items can be copied to a different component using the Copy dialog. This is available when there are eligible unassigned components.

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Source Major Item | The major item being copied | Read-only display (Infrastructure Type, Type of Work, Year) |
| 2 | Target Component | The component to copy the major item into | Dropdown; shows only unassigned, eligible components (excludes `EAO`, `EXC`, `SAV`, `CoS` and already-used components) |
| 3 | Confirm | Execute the copy to the selected component | Button; disabled until a target component is selected |
| 4 | Cancel / ✕ | Close without copying | Button |

**Step-by-Step:**

1. In the Major Items of Work section, click the **Copy** icon on the row to copy.
2. The Copy Major Item dialog opens showing the source item details.
3. Select a **Target Component** from the dropdown.
4. Click **Confirm**.

**On Success:** A new major item is created under the selected component with the same work type and locations as the source.

---

#### 5.4.7 Submitting the Revision

**Purpose:** Finalize and submit the modification request with a supporting approval document.

**Who uses this:** DEO, RO, PS Admin

**Field Reference — Submit Revision Dialog:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Revision Category | Read-only summary of the revision type and category | Display only |
| 2 | Reason | Read-only summary of the selected reason | Display only |
| 3 | Date of Approval | Official date on the supporting approval document | Date input; required |
| 4 | Approval Document | PDF file of the supporting approval document | File picker; PDF only; required |
| 5 | Certification Checkbox | Confirms that the document is accurate and aligned with the revisions | Checkbox; required for DPC, RPC, and AUC user groups |
| 6 | Submit | Validate and submit the revision request | Button; disabled while submitting |
| 7 | Cancel / ✕ | Close the dialog without submitting | Button |

> **Funding vs. Component Cost validation:** Before submission, the system checks that the Funding Profile total equals the Component Cost total. If they differ by more than ₱0.01, submission is blocked.

**Step-by-Step:**

1. After making all required edits in the modification form, click the **Submit Revision** button in the upper-right action bar.
2. The Submit Revision dialog opens.
3. Review the Revision Category and Reason (read-only).
4. Enter the **Date of Approval**.
5. Click the file picker and upload the **Approval Document** (PDF only).
6. If required for your user group (DPC, RPC, AUC), check the **Certification** checkbox: *"I hereby certify that the attached approval document is accurate, complete, and aligned with the revisions being submitted for this project."*
7. Click **Submit**.

[Insert Screenshot: Submit Revision Dialog]

**On Success:** A Transaction ID is generated and the revision request appears in the Revision List. Review routing:

| Submitting Role | Reviewed By |
|---|---|
| DPC / DEO | RO (Region Office) |
| RPC / RO | CO / PS Admin |
| AUC / PS Admin / CO | Automatically approved |

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please select an approval date."* | The Date of Approval field was left blank. | Enter the date shown on the approval document. |
| *"Please upload an approval document."* | No PDF was uploaded. | Upload a valid PDF approval document before submitting. |
| *"Please certify that the attached document is accurate..."* | Certification checkbox was not checked (applies to DPC, RPC, AUC roles). | Check the certification checkbox before clicking Submit. |
| *"Funding profile total (₱X) must equal component costs total (₱Y)."* | The funding and component cost totals do not match. | Adjust either the Funding Profile or Component Costs so the totals are equal. |

---

#### 5.4.8 Resubmitting After a Return for Correction

**Purpose:** If a revision request was returned by a reviewer with correction comments, the requester must address the comments and resubmit.

**Who uses this:** DEO, RO

**Step-by-Step:**

1. Open the returned revision from the Revision List (Status: *For Correction*).
2. Review the **For Corrections** history in the Revision Info section to see the reviewer's comments.
3. Make the required changes to the project data in the modification form.
4. Click **Resubmit**.
5. The Resubmit dialog opens (same fields as the Submit Revision Dialog — Section 5.4.7).
6. Upload the (possibly updated) approval document, enter the date, check the certification if required, and click **Resubmit**.

**On Success:** The revision is re-submitted and returns to the reviewer's queue with the updated data.

---

#### 5.4.9 RO Approval Actions

**Purpose:** Review revision requests submitted by DEO users and approve, reject, or return for correction.

**Who uses this:** RO

**Approve:**

**Step-by-Step:**

1. Select **Revision** from the sidebar.
2. Find and select the revision request.
3. Click **View**.
4. Proceed with **Approval**.

**On Success:** The project is approved and forwarded to the Central Office (PS Admin) for final review.

---

**Disapprove:**

**Step-by-Step:**

1. Select **Revision** and click **View** on the target request.
2. Click **Disapprove**.
3. Enter a mandatory **Reason for Rejection** explaining why the request is being disapproved.
4. Click **Reject Request**.

**On Success:** The project is disapproved. All input fields become disabled. The requester is notified that they must submit a new revision request if changes are still needed.

---

**Return for Correction:**

**Step-by-Step:**

1. Select **Revision** and click **View** on the target request.
2. Click **Request Changes**.
3. Enter mandatory **Review Comments** describing specifically what changes or additional information is needed.
4. Click **Send for Review**.

**On Success:** The project is marked "For Correction" and returned to the submitting user group. The review comments are visible in the Revision Info section's For Corrections history.

---

#### 5.4.10 PS Admin Approval Actions

**Purpose:** Perform final review and approval of revision requests forwarded from the RO.

**Who uses this:** PS Admin

**Approve:**

**Step-by-Step:**

1. Select **Revision** and click **View** on the target request.
2. Click **Approve** and confirm.

**On Success:** The project is approved and locked — no further edits are possible.

---

**Disapprove:**

**Step-by-Step:**

1. Select **Revision** and click **View** on the target request.
2. Click **Disapprove**.
3. Enter a mandatory **Reason for Rejection**.
4. Click **Reject Request**.

**On Success:** The project is disapproved. All input fields become disabled.

---

**Return for Correction:**

**Step-by-Step:**

1. Select **Revision** and click **View** on the target request.
2. Click **Request Changes**.
3. Enter mandatory **Review Comments**.
4. Click **Send for Review**.

**On Success:** The project is returned to the originating user group for re-submission.

---

### 5.5 Project Groups

**Purpose:** Organize multiple projects from different programs into named groups for cross-program tracking and reporting.

**Who uses this:** DEO, RO, PS Admin

---

#### 5.5.1 Project Groups List

**Purpose:** View, search, and filter all project groups accessible to the user.

**Who uses this:** DEO, RO, PS Admin

**Step-by-Step:**

1. Select **Project Groups** from the sidebar.
2. The Project Groups List loads.
3. To filter: enter a **Name** or select a **User Group**, then click **Apply Filter**. Click **Cancel** to reset.
4. To view details: click the **View** button on the desired row.
5. To delete: click the **Delete** button.

[Insert Screenshot: Project Groups List Screen]

**On Success:** All project groups load correctly. Filters narrow the list to matching records.

---

#### 5.5.2 Create Project Group

**Purpose:** Create a named project group with a description and user group assignment.

**Who uses this:** DEO, RO, PS Admin

**Field Reference:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Project Group Name | Name of the group | Text input; required |
| 2 | Description | Brief description of the group | Text input; required |
| 3 | User Group | User group associated with this project group | Dropdown; required |
| 4 | Cancel | Discard the form | Button |
| 5 | Submit | Save the new project group | Button |

**Step-by-Step:**

1. On the Project Groups screen, click **Add Project Group**.
2. Enter the **Project Group Name**.
3. Enter the **Description**.
4. Select a **User Group**.
5. Click **Cancel** to discard, or **Submit** to save.

[Insert Screenshot: Add Project Group Dialog]

**On Success:** The new project group appears in the Project Groups list.

---

#### 5.5.3 Project Group Details

**Purpose:** View and update a project group's information, and manage the projects within it.

**Who uses this:** DEO, RO, PS Admin

**Group fields:** Name, Description, User Group, Update button

**Map:** A map showing the general geographic location of the projects in the group is displayed alongside the group fields.

**Project table columns:** Project ID, Category, Description, Origin, City, Legislative District, Operating Unit, Implementing Office, DEO, Region, Agency, Created By, Created Date, Add Project

**Step-by-Step:**

1. Open a project group from the list.
2. To update group info: edit the fields and click **Update**.
3. To add a project: click **Add Project** and select the project.

[Insert Screenshot: Project Group Details Screen]

**On Success:** Selected projects are compiled in the group and displayed in the projects table.

---

### 5.6 Code Tables

**Purpose:** Manage all reference data used throughout MYPS. Changes take effect immediately system-wide. Organized into tabs by data domain.

**Who uses this:** PS Admin (full access)

| Tab | Sub-tabs |
|-----|---------|
| Admin Areas | Region, Provinces, City/Municipalities, Legislative Districts, DEO |
| Component Cost | Cost Types |
| Funding Profile | Funding Source, Funding Agreement |
| Major Item | Infrastructure Type, Work Category, Type of Work |
| Program | Program Stage, Program Type, Program Status |
| Project Details | Agency, Category, Origin, Thrust |
| Revision | Categories, Documents, Headers, Reasons, Rules, Statuses, Validation Dates |

**Toggle Active / Inactive**

All Code Tables sub-tabs include an **Active** column showing the current status of each record (green dot = Active; grey dot = Inactive). Inactive records are hidden from dropdown menus throughout the system but remain in the database for historical reference.

To toggle a record's status:
1. Locate the record in the table.
2. Click the **Active** / **Inactive** status button in its row. A confirmation dialog appears showing the action (Activate or Deactivate) and the record's key.
3. Confirm to apply the change. The status badge updates immediately.

---

#### 5.6.1 Admin Areas

**Purpose:** Manage geographic reference data used in project Location Details.

**Step-by-Step:**
1. Select **Code Tables** from the Settings menu in the sidebar.
2. Click the **Admin Areas** tab.
3. Select a sub-category (Region, Provinces, City/Municipalities, Legislative Districts, or DEO).
4. Click **Add**. Enter required fields (e.g., for Provinces: GDB ID, Name, Code, Region).
5. Click the **Check** button to save.

**On Success:** The new entry appears under the selected sub-category with an auto-generated ID.

---

#### 5.6.2 Component Cost

**Purpose:** Manage cost component type codes used in the project Component Cost section.

**Step-by-Step:**
1. Select **Code Tables** → **Component Cost**.
2. Click **Add Cost Type**.
3. Enter **Component ID**, **Name**, and check **Export to PCMA** if applicable.
4. Click **Check**.

**On Success:** The new component cost code appears in the list.

---

#### 5.6.3 Funding Profile

**Purpose:** Manage funding source organizations and loan/grant agreements used in the project Funding Profile section.

**Step-by-Step: Adding a Funding Source**

1. Select **Code Tables** → **Funding Profile** → **Funding Source** sub-tab.
2. Click **Add**.
3. Enter **Organization**, **Description**, and **Nature**.
4. Click **Check** to save.

**Step-by-Step: Adding a Funding Agreement**

1. Select **Code Tables** → **Funding Profile** → **Funding Agreement** sub-tab.
2. Click **Add**.
3. Enter **Source Org**, **Code**, **Name**, and **Financial Segment Code**.
4. Click **Check** to save.

**On Success:** New entries appear under the respective Funding Profile sub-category.

---

#### 5.6.4 Major Item

**Purpose:** Manage infrastructure types, work categories, and types of work used in Major Items of Work.

**Step-by-Step: Adding an Infrastructure Type**

1. Select **Code Tables** → **Major Item** → **Infrastructure Type** sub-tab.
2. Click **Add**.
3. Enter **Infra ID**, **Code**, and **Name**.
4. Click **Check** to save.

**Step-by-Step: Adding a Work Category**

1. Select **Code Tables** → **Major Item** → **Work Category** sub-tab.
2. Click **Add**.
3. Enter **Infrastructure Type** and **Work Category**.
4. Click **Check** to save.

**Step-by-Step: Adding a Type of Work**

1. Select **Code Tables** → **Major Item** → **Type of Work** sub-tab.
2. Click **Add**.
3. Enter **Infrastructure Type** and **Work Category**.
4. Click **Check** to save.

**On Success:** New entries appear under the respective Major Item sub-category.

---

#### 5.6.5 Program

**Purpose:** Manage program stage and program type codes used in the Add Program form.

**Step-by-Step: Adding a Program Stage**

1. Select **Code Tables** → **Program** → **Program Stage** sub-tab.
2. Click **Add**.
3. Enter **Name ID**, **Name**, and **Description**.
4. Click **Check** to save.

**Step-by-Step: Adding a Program Type**

1. Select **Code Tables** → **Program** → **Program Type** sub-tab.
2. Click **Add**.
3. Enter **Name ID**, **Name**, and **Description**.
4. Click **Check** to save.

---

#### 5.6.6 Project Details

**Purpose:** Manage dropdown values (Agency, Category, Origin, Thrust) used in the Add Project form.

**Step-by-Step: Adding an Agency**

1. Select **Code Tables** → **Project Details** → **Agency** sub-tab.
2. Click **Add**.
3. Enter **Name ID**, **Agency Name**, and **Description**.
4. Click **Check** to save.

**Step-by-Step: Adding a Category**

1. Select **Code Tables** → **Project Details** → **Category** sub-tab.
2. Click **Add**.
3. Enter **Category ID**, **Name**, **Min Amount**, **Max Amount**, and **Valid Until**.
4. Click **Check** to save.

**Step-by-Step: Adding an Origin**

1. Select **Code Tables** → **Project Details** → **Origin** sub-tab.
2. Click **Add**.
3. Enter **Name** and **Description**.
4. Click **Check** to save.

**Step-by-Step: Adding a Thrust**

1. Select **Code Tables** → **Project Details** → **Thrust** sub-tab.
2. Click **Add**.
3. Enter **Program Name**, **Sub-Program**, **Activity**, **Seq #**, **Description**, **Infra Type**, **Valid From**, and **Valid To**.
4. Click **Check** to save.

---

#### 5.6.7 Revision Code Tables

**Purpose:** Manage all reference data that drives the revision workflow: categories, reasons, validation date windows, header/document types, statuses, and field-level permission rules.

**Step-by-Step: Adding a Reason**

1. Select **Code Tables** → **Revision** → **Reasons** sub-tab.
2. Click **Add**.
3. Enter **Reason ID** and **Reason**.
4. Click **Check** to save.

**Step-by-Step: Adding a Validation Date**

1. Select **Code Tables** → **Revision** → **Validation Dates** sub-tab.
2. Click **Add**.
3. Enter **Funding Year**, **Start Date**, and **End Date**.
4. Click **Check** to save.

**Step-by-Step: Editing or Deleting Categories, Documents, Headers, or Statuses**

1. Select **Code Tables** → **Revision** → the relevant sub-tab (Categories, Documents, Headers, or Statuses).
2. Select the entry to modify.
3. Click **Edit** to update the entry, or **Delete** to remove it.

**Rules (Field Permissions):**

The **Rules** sub-tab is a standalone table that defines, per revision Reason and per project status combination, exactly which individual project fields become editable and which CRUD operations (Add, Delete) are allowed in each section during a revision.

**How it connects to the Revision module:**
When a user initiates a revision, the system matches the selected Reason plus the project's live PCMA Status and Package Status to a single Rules record. The field permissions encoded in that record are returned by the API and applied immediately to the revision form — enabling specific fields while keeping all others read-only. This matching is done automatically; the user never selects a rule manually.

**Understanding Rule Rows:**
Each row in the Rules table represents one **Reason + PCMA Status + Package Status** combination. A single Reason can have multiple rows — one for each project status combination it applies to. For example, the same Reason may allow different fields to be edited when a project is "Not-Yet Started / Not Packaged" versus when it is "On-Going / Packaged".

| Rules Table Column | Meaning |
|--------------------|---------|
| Reason | The revision reason this rule applies to |
| PCMA Status | The required PCMA construction status (Not-Yet Started, On-Going, Completed, Terminated) |
| Package Status | The required package status (packaged, not packaged) |
| Field Rules | JSON permissions — which fields are editable and CRUD controls per section |

**Field-Level Permissions (inside each rule):**

Each rule stores permissions at the **individual field level**, not just per section. Within Project Details, for example, Description can be enabled while Category remains locked. Sections that support row-level actions also have CRUD controls:

| Section | Individual Fields Controllable | CRUD Controls |
|---------|-------------------------------|---------------|
| Project Details | UACS, Description, Category, Thrust, Origin, Province, City, Legislative District, Operating Unit, Implementing Office, DEO, Region, Agency, Implementation Mode, Emergency Mode, Feasibility, Detailed Design, ROW Available, Tier, and others | — |
| Component Cost | Component Type, Component ID, Description, Total | Can Add, Can Delete |
| Component Cost Per Year | Cost Year, Cost, Start Date, End Date | Can Add, Can Delete |
| Major Item of Work | Component ID, Year of Work, Work Type, Infra Type | Can Add, Can Delete |
| Major Item Location | Infrastructure ID, Detailed Scope, Physical Target, Coordinates, Stations, Chainages, Length | Can Add, Can Delete |
| Funding Profile | Source, Agreement, Amount, Percentage | Can Add, Can Delete |

When **Can Add** is off for a section, the Add button is hidden during the revision. When **Can Delete** is off, the Delete button is hidden.

**Step-by-Step: Configuring a Rule**

1. Select **Code Tables** → **Revision** → **Rules** sub-tab.
2. Locate the row matching the Reason and PCMA/Package Status combination to configure.
3. Click **Edit** on that row to modify Reason, PCMA Status, Package Status, or to open the field-level editor.
4. In the field-level editor, expand each section and toggle individual fields on (editable) or off (locked).
5. For sections with CRUD controls, toggle **Can Add** and **Can Delete** as required.
6. Click **Check** to save.

[Insert Screenshot: Rules Sub-tab — Row List with PCMA/Package Status columns]

[Insert Screenshot: Field Rules Editor — expanded section toggles and CRUD controls]

**On Success:** At runtime, when a user submits a revision under the configured Reason and the project has the matching PCMA and Package status, only the enabled fields become editable in the project form. All other fields remain read-only. Add and Delete buttons appear only in sections where the CRUD permissions allow them.

> **Relationship to Section 5.4.3:** The PCMA Status values used in Rules rows correspond directly to the PCMA project lifecycle statuses described in Section 5.4.3. Rules control *what the user can edit*; the Section 5.4.3 conditions (resolved live from PCMA) control *whether the revision type is available at all*.

---

### 5.7 User Management

**Purpose:** The User Management module is the central administration screen for controlling who can access MYPS and what they can do. It organises all administration into three tabs: **App Modules**, **Users**, and **User Groups**. PS Admins use this screen to register system modules, create user accounts, assign users to groups, and define the API and route-level permissions each group holds.

**Who uses this:** PS Admin

**Prerequisites:** User must be signed in as PS Admin.

---

#### 5.7.1 App Modules

**Purpose:** Define the logical modules of the MYPS application and link each module to its backend API controllers and frontend routes. The App Modules tab is also used to synchronise controller and route definitions between the live application and the database.

**Who uses this:** PS Admin

**Prerequisites:** User must be on the User Management screen.

**Field Reference — App Modules List**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | MODULE NAME | The name of the system module (e.g., Program, Project, Revision) | Text; required |
| 2 | DESCRIPTION | Optional description of the module's purpose | Text; optional |
| 3 | CONTROLLERS | Count of API controllers linked to this module, shown as X / Y linked | Read-only display |
| 4 | VIEWS | Count of frontend routes linked to this module, shown as X / Y linked | Read-only display |
| 5 | Sync Routes | Synchronises the route/view permission list from the live frontend route definitions to the database | Button |
| 6 | Sync API | Synchronises the API controller and action list from the backend to the database | Button |
| 7 | Add Module | Opens an inline add row at the top of the table to create a new module | Button |
| 8 | Edit (pencil icon) | Switches the module row into inline edit mode | Row action |
| 9 | Delete (trash icon) | Triggers an inline delete confirmation on the row | Row action |

**Step-by-Step: Viewing Module Details**

1. Navigate to **Settings → User Management**.
2. Click the **App Modules** tab. The list shows all registered modules with their controller and view link counts.
3. Click any row (outside the Actions column) to expand a read-only **Controllers & Views** panel below the row. Controllers are listed in a collapsible section showing how many are linked. Views are listed separately. Click the row again to collapse.

[Insert Screenshot: App Modules Tab — expanded row]

**Step-by-Step: Adding a Module**

1. Click **Add Module**. An amber-highlighted inline row appears at the top of the table.
2. Enter the **Module Name** (required).
3. Optionally enter a **Description**.
4. The **Controllers & Views** panel opens below the new row. Expand the **Controllers** section by clicking its header, then toggle individual controllers on or off using their switch controls. Repeat for **Views**.
5. Click the **checkmark (✓)** button to save, or the **× button** to cancel.

[Insert Screenshot: App Modules — Add Module inline row]

**On Success:** The new module row appears in the list with the linked controller and view counts updated.

**Common Outcomes & What to Do**

| Message / Situation | What it Means | What You Should Do |
|--------------------|---------------|--------------------|
| "Module name is required." | The Module Name field was left blank | Enter a module name before saving |
| "Failed to save module." | A server-side error prevented the save | Check the error text; retry or contact the system administrator |
| Sync Routes button disabled | Another edit is currently in progress | Save or cancel the open edit row first |

---

**Step-by-Step: Editing a Module**

1. Click the **pencil icon** on the module row you want to edit. The row switches to amber-highlighted inline edit mode.
2. Update **Module Name** or **Description** as needed.
3. Expand the **Controllers & Views** panel to link or unlink controllers and views by toggling their switches.
4. Click **✓** to save, or **×** to cancel.

[Insert Screenshot: App Modules — Edit inline row]

---

**Step-by-Step: Deleting a Module**

1. Click the **trash icon** on the module row. The row changes to show a "Delete?" label with **✓** and **×** buttons.
2. Click **✓** to confirm deletion, or **×** to cancel.

[Insert Screenshot: App Modules — Delete confirmation inline]

**On Success:** The module row is removed from the list and the total count decreases by one.

> A deletion cannot be undone. If a module is accidentally deleted, it must be re-added manually.

---

**Step-by-Step: Syncing API Permissions**

1. Click **Sync API**. The button label changes to "Syncing..." with a spinning icon while the operation runs.
2. A success toast message appears when the sync completes.

> Sync API reads the current API controller and action list from the backend and updates the permission database. Run this after backend code changes that add or remove controllers or actions.

---

**Step-by-Step: Syncing Routes**

1. Click **Sync Routes**. The button label changes to "Syncing..." while the operation runs.
2. A success toast message appears when the sync completes.

> Sync Routes reads the active frontend route list and updates the route permission database. Run this after new pages are added to the application.

---

#### 5.7.2 Users

**Purpose:** View, search, add, update, and deactivate MYPS user accounts. Each user is linked to one or more User Groups which determine their access rights. User data is pulled from the Personnel Information System (PIS) using the employee's Employee ID.

**Who uses this:** PS Admin

**Prerequisites:** User must be on the User Management screen.

**Field Reference — Users List**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | USER | Full name, User ID (login ID), and email address of the user | Display |
| 2 | USER GROUP | Badges showing the groups assigned to the user. If more than 3 groups are assigned, a "+N more" badge appears | Display; click "+N more" to expand |
| 3 | REGION | The user's assigned regional office code | Display |
| 4 | OFFICE | Full name of the plantilla office of the user (PlantillaOfficeName) | Display |
| 5 | STATUS | Active (green badge) or Inactive (red badge) | Display |
| 6 | Filter | Opens the Filter Users dialog | Button |
| 7 | Clear Filters | Clears all active filters and reloads the list; only visible when filters are active | Button (red) |
| 8 | Add User | Opens the Add New User dialog | Button (blue) |
| 9 | Edit (pencil icon) | Opens the Update User dialog for the selected user | Row action |
| 10 | Delete (trash icon) | Opens the Delete User confirmation dialog | Row action |

The column headers **User**, **User Group**, **Region**, **Office**, and **Status** are sortable. Click a column header to sort ascending or descending.

---

**Step-by-Step: Filtering Users**

1. Click the **Filter** button. An orange ring highlights the button when filters are active, and a count badge shows how many filters are applied.
2. In the **Filter Users** dialog, fill in one or more of the following:

**Field Reference — Filter Users Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | NAME | Search by user's full name (partial match) | Text input |
| 2 | USER GROUP | Search by assigned user group name (partial match) | Text input |
| 3 | STATUS | Filter by account status | Dropdown: All / Active / Inactive |
| 4 | Clear Filter | Clears all filter fields and reloads the full list | Button (disabled if all fields are empty) |
| 5 | Cancel | Closes the dialog without applying | Button |
| 6 | Apply Filter | Applies the entered criteria and reloads the list | Button (orange) |

3. Click **Apply Filter**. The dialog closes and the list refreshes to show matching records.
4. To remove all filters at once, click the red **Clear Filters** button in the toolbar.

[Insert Screenshot: Filter Users Dialog]

---

**Step-by-Step: Adding a User**

**Field Reference — Add New User Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | EMPLOYEE ID | The employee's ID number in the Personnel Information System (PIS) | Text input; required |
| 2 | Search icon (magnifying glass) | Triggers a PIS lookup using the entered Employee ID | Button |
| 3 | USER ID | System login identifier — auto-filled from PIS after a successful lookup; always read-only (disabled) | Text; read-only |
| 4 | NAME | Employee's full name — auto-filled from PIS; read-only | Text; read-only |
| 5 | REGION | Regional office name — auto-filled from PIS; always read-only (disabled) | Text; read-only |
| 6 | EMAIL | Work email address — auto-filled from PIS; editable | Email input |
| 7 | PLANTILLA OFFICE | Assigned plantilla office code — auto-filled from PIS; read-only | Text; read-only |
| 8 | PLANTILLA OFFICE NAME | Full name of the assigned plantilla office — auto-filled from PIS; read-only | Text; read-only |
| 9 | USER GROUPS | Checkbox list of all available user groups; select one or more | Multi-select checkbox list |
| 10 | STATUS | Account status | Dropdown: Active (default) / Inactive |
| 11 | Cancel | Closes the dialog without saving | Button |
| 12 | Add User | Submits the form and creates the user account | Button (blue) |

**Step-by-Step:**

1. Click **Add User**. The Add New User dialog opens.
2. In the **Employee ID** field, type the employee's PIS ID number.
3. Click the **magnifying glass icon** next to the field. The system queries PIS and auto-fills **User ID**, **Name**, **Region**, **Email**, **Plantilla Office**, and **Plantilla Office Name**. A loading indicator appears while the lookup runs.
4. Review the auto-filled data. You may edit the **Email** field if needed; all other auto-filled fields are read-only.
5. In the **User Groups** section, tick one or more checkboxes to assign the user to group(s). The list shows all available groups with optional descriptions.
6. Set the **Status** (defaults to Active).
7. Click **Add User** to save. The dialog closes and the user list refreshes.

[Insert Screenshot: Add New User Dialog]

**On Success:** The new user appears in the Users list with their assigned group badges visible.

**Common Outcomes & What to Do**

| Message / Situation | What it Means | What You Should Do |
|--------------------|---------------|--------------------|
| "Loading user data..." | PIS lookup is in progress | Wait for the lookup to complete |
| "Employee ID not found" | No PIS record matches the entered ID | Verify the ID is correct; contact HR if the employee is not yet registered in PIS |
| "Please enter a valid Employee ID first" | The submit button was clicked before a successful PIS lookup | Complete the PIS lookup first by entering the ID and clicking the search icon |
| "Failed to fetch user data" | PIS service is unavailable or returned an error | Retry; if the problem persists, contact the system administrator |
| "Failed to add user" | A server-side error prevented the save | Check for duplicate User ID; retry or contact the administrator |

---

**Step-by-Step: Editing a User**

**Field Reference — Update User Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | EMPLOYEE ID | Employee ID — editable in update mode | Text input; required |
| 2 | USER ID | System login identifier — editable in update mode | Text input; required |
| 3 | NAME | Employee's full name — editable in update mode | Text input; required |
| 4 | EMAIL | Work email address | Email input |
| 5 | PLANTILLA OFFICE | Assigned plantilla office code | Text input |
| 6 | PLANTILLA OFFICE NAME | Full name of the assigned plantilla office | Text input |
| 7 | USER GROUP | Checkbox list of all available groups; current assignments pre-ticked | Multi-select checkbox list |
| 8 | STATUS | Account status | Dropdown: Active / Inactive |
| 9 | Cancel | Closes the dialog without saving | Button |
| 10 | Update User | Submits the updated user data | Button (blue) |

**Step-by-Step:**

1. On the user row, click the **pencil (Edit) icon**. The Update User dialog opens, pre-filled with the user's existing data.
2. Modify any field as required. Unlike Add User, all fields are directly editable — there is no PIS lookup step.
3. To change user group assignments, tick or untick checkboxes in the **User Group** list.
4. Change the **Status** to Inactive to deactivate the account without deleting it.
5. Click **Update User** to save. The dialog closes and the list row reflects the changes immediately.

[Insert Screenshot: Update User Dialog]

**On Success:** A success toast ("User updated successfully.") appears and the list row updates.

---

**Step-by-Step: Deleting a User**

1. On the user row, click the **trash (Delete) icon**. The Delete User dialog opens showing the user's name for confirmation.
2. Click **Delete User** to confirm permanent deletion, or **Cancel** to abort.

[Insert Screenshot: Delete User Dialog]

**On Success:** A success toast ("User deleted successfully.") appears and the user is removed from the list.

> Deletion is permanent and cannot be undone. If a user account must be disabled temporarily, use the Update User dialog and set Status to **Inactive** instead.

---

#### 5.7.3 User Groups

**Purpose:** Create and manage named user groups. Each group holds a set of permissions — both API-level actions (which backend controller endpoints the group can call) and route-level access (which frontend pages the group can navigate to). Assigning a user to a group automatically grants them all permissions in that group.

**Who uses this:** PS Admin

**Prerequisites:** User must be on the User Management screen.

**Field Reference — User Groups List**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | GROUP NAME | Name of the user group; click the row to expand permissions detail | Display; row is clickable |
| 2 | MEMBERS | Number of users currently assigned to this group (with user icon) | Display |
| 3 | PERMISSIONS | Summary badges: "X API" (blue) for granted API actions, "Y Routes" (green) for granted route access | Display |
| 4 | DESCRIPTION | Optional description text | Display |
| 5 | CREATED | Date the group was created | Display |
| 6 | Filter Group | Opens the Filter User Group dialog | Button |
| 7 | Clear Filter | Removes active filters and reloads the list; visible only when a filter is active | Button (red) |
| 8 | Add Group | Opens the Add New Group dialog | Button (blue) |
| 9 | Edit (pencil icon) | Opens the Update Group dialog | Row action |
| 10 | Delete (trash icon) | Opens the Delete Group confirmation dialog | Row action |

The column headers **Group Name**, **Members**, **Permissions**, **Description**, and **Created** are sortable.

**Expanding a Group Row:**
Click anywhere on a group row (not on the action buttons) to expand a permissions summary panel below the row. The panel shows each module the group has access to, with the granted API action count and route count per module. Click the row again to collapse. A row highlighted in blue indicates the group currently has granted permissions.

[Insert Screenshot: User Groups Tab — expanded row]

---

**Step-by-Step: Filtering User Groups**

1. Click **Filter Group**.
2. In the **Filter User Group** dialog, fill in one or more fields:

**Field Reference — Filter User Group Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | GROUP NAME | Search by group name (partial match) | Text input |
| 2 | PERMISSION NAME | Search by a permission name associated with the group | Text input |
| 3 | Clear Filters | Clears all fields; disabled if fields are already empty | Button |
| 4 | Cancel | Closes without applying | Button |
| 5 | Filter Group | Applies the filter and reloads the list | Button (orange) |

3. Click **Filter Group**. The list refreshes to show matching groups.

[Insert Screenshot: Filter User Group Dialog]

---

**Step-by-Step: Creating a User Group**

**Field Reference — Add New Group Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | GROUP NAME | The name of the new group | Text input; required (marked with *) |
| 2 | DESCRIPTION | Optional explanation of the group's role | Textarea; optional |
| 3 | APPLY FILTER | When checked, this group applies a data filter (restricts data visible to its members to their own region/office only) | Checkbox; defaults to unchecked |
| 4 | Cancel | Closes the dialog without creating the group | Button |
| 5 | Create Group | Submits the form and creates the group | Button (blue); disabled if Group Name is empty |

**Step-by-Step:**

1. Click **Add Group**. The Add New Group dialog opens.
2. Enter the **Group Name** (required).
3. Optionally enter a **Description** to describe the group's purpose.
4. Tick **Apply Filter** if this group's members should only see records from their own regional office. Leave unchecked for groups that need system-wide data access.
5. Click **Create Group**.

> Permissions are not configured during group creation. After the group is created, use the **Edit** action to assign module permissions.

[Insert Screenshot: Add New Group Dialog]

**On Success:** A toast ("Group 'GroupName' created successfully.") appears and the group appears in the list. The new group starts with zero members and no permissions.

**Common Outcomes & What to Do**

| Message / Situation | What it Means | What You Should Do |
|--------------------|---------------|--------------------|
| "Group name is required." | The Group Name field was left blank | Enter a name before clicking Create Group |
| "Failed to create group." | A server-side error occurred | Check for duplicate group names; retry or contact the administrator |

---

**Step-by-Step: Editing a User Group and Assigning Permissions**

The Edit Group dialog is the primary screen for managing what a user group can access. Permissions are organised by application module, with each module containing API permissions (backend actions) and route access (frontend pages).

**Field Reference — Update Group Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | GROUP NAME | Name of the group — editable | Text input; required |
| 2 | DESCRIPTION | Group description — editable | Textarea; optional |
| 3 | APPLY FILTER | Restricts members' data view to their own region/office | Checkbox |
| 4 | MODULE PERMISSIONS | Accordion-style list of all system modules with their API and route permissions | Interactive accordion |
| 5 | Expand All | Expands all module accordions simultaneously | Link button |
| 6 | Collapse All | Collapses all module accordions | Link button |
| 7 | Module header row | Click to expand or collapse that module's permissions | Clickable header |
| 8 | API PERMISSIONS section | Lists backend controllers, each with their individual actions as checkboxes | Per module |
| 9 | Controller row checkbox | Indeterminate checkbox that selects or deselects all actions in that controller at once | Checkbox (tri-state) |
| 10 | Action row checkbox | Grants or revokes a single API endpoint action for this group | Checkbox |
| 11 | ROUTE ACCESS section | Lists frontend routes (page names and paths) accessible to this group | Per module |
| 12 | Route row checkbox | Grants or revokes access to a specific frontend page for this group | Checkbox |
| 13 | Cancel | Closes the dialog without saving changes | Button |
| 14 | Save Changes | Submits all permission changes to the server | Button (blue) |

**Step-by-Step:**

1. On the group row, click the **pencil (Edit) icon**. The Update Group dialog opens pre-filled with the group's current settings. All modules that already have granted permissions are automatically expanded.
2. Edit **Group Name**, **Description**, or the **Apply Filter** checkbox if needed.
3. In the **Module Permissions** section, use **Expand All** or **Collapse All** to control visibility, or click individual module headers to open them one by one.
4. **To grant/revoke API permissions:**
   - Expand a module to see its API Permissions section.
   - Each controller (e.g., `ProgramController`) shows its actions in a sub-list with a count badge (e.g., `2/5`).
   - Click the **controller row checkbox** to select or deselect all actions in that controller at once. The checkbox shows an indeterminate state (−) when some but not all actions are selected.
   - Click individual **action row checkboxes** to grant or revoke specific endpoint access.
5. **To grant/revoke route access:**
   - Expand a module and scroll to the **Route Access** section.
   - Each row shows a route name (e.g., `Programs`) and its path (e.g., `/programs`).
   - Tick or untick the checkbox to grant or revoke access to that page.
6. Click **Save Changes** when done.

[Insert Screenshot: Update Group Dialog — Module Permissions accordion expanded]

**On Success:** A success toast ("Group updated successfully.") appears. All users in this group immediately inherit the updated permission set.

> Module headers highlighted in blue indicate at least one permission is currently granted in that module. Headers in grey indicate no permissions are set. Use the count badges (e.g., "3/10 API", "2/5 Routes") on module headers to quickly verify how much access is granted per module.

---

**Step-by-Step: Deleting a User Group**

**Field Reference — Delete Group Dialog**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Group info panel | Displays Group Name, Members count, and total Permissions count of the group to be deleted | Read-only |
| 2 | Member impact warning | Shown if the group has one or more members; warns that their access may be affected | Warning block |
| 3 | CONFIRMATION INPUT | Must type the word **DELETE** (case-insensitive) to enable the delete button | Text input; required |
| 4 | Cancel | Closes the dialog without deleting | Button |
| 5 | Delete Group | Submits the deletion; enabled only when the confirmation word has been typed | Button (red) |

**Step-by-Step:**

1. Click the **trash (Delete) icon** on the group row. The Delete Group dialog opens, showing a warning panel and the group's details (name, member count, permission count).
2. If the group has members, an additional yellow warning block appears noting the impact on those users' access.
3. In the confirmation field, type **DELETE** exactly.
4. Click **Delete Group**. The dialog closes and the group is removed.

[Insert Screenshot: Delete Group Dialog]

**On Success:** A toast ("Group deleted successfully.") appears and the group is removed from the list.

**Common Outcomes & What to Do**

| Message / Situation | What it Means | What You Should Do |
|--------------------|---------------|--------------------|
| Delete Group button remains disabled | The confirmation text has not been typed correctly | Type the word DELETE in the confirmation field |
| "Failed to delete group." | A server-side error prevented deletion | Check whether the group still has active members or linked dependencies; retry or contact the administrator |

> Deletion is permanent and cannot be undone. If the group should be retained but emptied, remove all users from the group using the Update User dialog for each affected user, rather than deleting the group.

---

### 5.8 Infra Management

**Purpose:** Manage the future road network inventory — roads, road sections, and bridges — used as reference data when encoding Work Locations in projects. The module is organized around a three-level hierarchy: Road → Road Section → Bridge.

**Who uses this:** PS Admin

**Prerequisites:** User must be signed in as PS Admin.

**Page Layout:**

The **Infrastructure Administration** page (header: "Infrastructure Administration", subtitle: "Manage future roads, road sections, and bridges") displays three tabs and a global **Import** button.

| Tab | Icon | What it shows |
|-----|------|---------------|
| Roads | Stack | All future national roads |
| Road Sections | Building | All future road sections linked to those roads |
| Bridges | Arrows-pointing-out | All future bridges linked to road sections |

Each tab shows a count badge with the current total number of records. The counts are loaded once when the page opens.

**Hierarchy Rule:**

| Entity | Parent Required | Created From |
|--------|----------------|--------------|
| Road | — | Roads tab → **Add Road** button |
| Road Section | A road must exist | Roads tab → **+ Add Section** row button |
| Bridge | A road section must exist | Road Sections tab → **+ Add Bridge** row button |

> Road sections cannot be added from the Road Sections tab directly. Bridges cannot be added from the Bridges tab directly. The standalone Add buttons for those entities are disabled; use the parent-row action buttons instead.

---

**Common Table Controls (all three tabs):**

| Control | Description |
|---------|-------------|
| Search input + **Search** button | Filters the list by the tab's primary identifier. Press Enter or click Search. |
| **Clear Filter** button (red) | Appears only when a search or filter is active. Resets the table to show all records. |
| **Filter** button | Opens a filter dialog for advanced multi-field filtering. Turns orange with a count badge when filters are active. |
| Column header (sortable) | Click to sort ascending; click again to sort descending. Applies to: Road ID, Road Name, Classification (Roads); Section Road ID, Road ID, Length (m), Engineering District (Road Sections); Section Road ID, Bridge Name, Bridge ID, From (m), Length (m), Carriage Way (Bridges). |
| Pagination | **First** / page number buttons / **Last**. Shows current page range and total count at the bottom of the table. |

---

#### 5.8.1 Roads Tab

**Purpose:** View, search, filter, add, edit, and delete future national roads. Also the only location where road sections can be created.

**Roads Table Columns:**

| Column | Description |
|--------|-------------|
| Road ID | Unique road identifier (blue badge) |
| Road Name | Name of the road |
| Classification | Road class (green badge): Primary, Secondary, Tertiary, or Quaternary |
| Actions | Yellow **Edit** (pencil) icon, red **Delete** (trash) icon, blue **+ Add Section** button |

**Field Reference — Roads Tab Toolbar:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Search input | Filter by road name | Text; press Enter or click Search |
| 2 | Search | Executes the name search | Button (blue) |
| 3 | Clear Filter | Removes active filter and reloads all roads | Button (red); visible only when a filter is active |
| 4 | Filter | Opens the Filter Roads dialog | Button (white/orange when active); shows count badge |
| 5 | Add Road | Opens the Add New Future Road dialog | Button (blue) |

---

**Step-by-Step: Adding a Road**

**Field Reference — Add New Future Road Dialog:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | ROAD ID | Unique identifier for the road | Text input; required; format: `FR{5digits}{IslandCode}` (e.g., `FR00001LZ`) |
| 2 | ROAD NAME | Name of the road | Text input; required |
| 3 | CLASSIFICATION | Road classification | Dropdown: Primary (1), Secondary (2), Tertiary (3), Quaternary (4); required |
| 4 | ✕ (close) | Dismiss the dialog without saving | Button |
| 5 | Save | Validate and save the new road | Button (blue) |

1. Click **Add Road**. The **Add New Future Road** dialog opens.
2. Enter the **Road ID** following the format `FR{5digits}{IslandCode}` (e.g., `FR00001LZ` for Luzon, `FR00002VS` for Visayas).
3. Enter the **Road Name**.
4. Select the **Classification** from the dropdown.
5. Click **Save**.

[Insert Screenshot: Add New Future Road Dialog]

**On Success:** The road appears in the Roads table.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please fill in all required fields"* | Road ID or Road Name was left blank | Complete all required fields before clicking Save |
| *"Please select an item in the list."* | Classification dropdown was left at the placeholder. Browser-native validation tooltip on the required dropdown. | Select a Classification before clicking Save. |

---

**Step-by-Step: Editing a Road**

The **Edit Future Road** dialog uses the same fields as the Add dialog. All fields are editable.

1. Click the yellow **pencil icon** on the road's row.
2. The **Edit Future Road** dialog opens, pre-filled with the road's current data.
3. Modify any field as needed.
4. Click **Save**.

[Insert Screenshot: Edit Future Road Dialog]

**On Success:** The road record is updated and the table refreshes.

---

**Step-by-Step: Deleting a Road**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Road info panel | Displays Road ID, Name, and Classification of the road to be deleted | Read-only |
| 2 | CONFIRMATION INPUT | Must type **DELETE** to enable the delete button | Text input; required; case-insensitive |
| 3 | Cancel | Closes the dialog without deleting | Button |
| 4 | Delete Road | Permanently removes the road | Button (red); disabled until confirmation text is typed |

1. Click the red **trash icon** on the road's row.
2. The **Delete Future Road** dialog opens, displaying the road's ID, name, and classification, along with a warning that the action cannot be undone.
3. Type **DELETE** in the confirmation field.
4. Click **Delete Road**.

[Insert Screenshot: Delete Future Road Dialog]

**On Success:** A success toast ("Road deleted successfully.") appears and the road is removed from the table.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| Delete Road button remains disabled | The confirmation text has not been typed | Type the word DELETE in the confirmation field |
| *"Failed to delete road. Please try again."* | A server-side error prevented the deletion | Retry; if persistent, verify there are no active road sections linked to this road |

> **Warning:** Deleting a road permanently removes it from the system and may affect linked road sections and bridges.

---

**Step-by-Step: Filtering Roads**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | ROAD ID | Filter by road identifier (partial match) | Text input |
| 2 | ROAD NAME | Filter by road name (partial match) | Text input |
| 3 | CLASSIFICATION | Filter by road class | Dropdown: All / Primary / Secondary / Tertiary / Quaternary |
| 4 | Clear Filter | Resets all filter fields and reloads all roads | Button (zinc); disabled when all fields are empty |
| 5 | Cancel | Closes the dialog without applying | Button (zinc) |
| 6 | Apply Filter | Applies the filter criteria and refreshes the table | Button (orange) |

1. Click the **Filter** button in the toolbar.
2. In the **Filter Roads** dialog, enter any combination of Road ID, Road Name, or Classification. Leave a field empty to include all values for that field.
3. Click **Apply Filter**.
4. To remove all filters: click **Clear Filter** inside the dialog, or click the red **Clear Filter** button in the toolbar.

[Insert Screenshot: Filter Roads Dialog]

---

**Step-by-Step: Adding a Road Section from a Road Row**

Each road row has a blue **+ Add Section** button. This is the only way to create new road sections.

**Field Reference — Add Road Section Dialog (launched from road row):**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | PARENT ROAD ID | The road this section belongs to | Read-only text field; pre-filled with `{RoadId} - {RoadName}` |
| 2 | SECTION ROAD ID | Section identifier, assembled from three parts | Split input: prefix `FS` (fixed) + 5-digit number (user-entered, digits only, max 5 chars) + island code suffix (auto-derived from parent Road ID) |
| 3 | ENGINEERING DISTRICT | DEO responsible for this section | Dropdown (loaded from DEO list); required |
| 4 | ROAD LENGTH | Length of the road section in metres | Numeric input; required |
| 5 | ✕ (close) | Dismiss the dialog without saving | Button |
| 6 | Save | Validate and save the road section | Button (blue) |

> The **Section Road ID** is composed in real time as the user types. When the 5-digit number is entered, the full ID is assembled as `FS{00000}{IslandCode}`. The island code is extracted automatically from the parent road's Road ID (e.g., if the road is `FR00001LZ`, the island code is `LZ`).

1. Locate the road in the Roads table.
2. Click the blue **+ Add Section** button on that road's row.
3. The **Add Road Section** dialog opens. The **Parent Road ID** field is pre-filled and read-only.
4. In the **Section Road ID** field, type the 5-digit section number (e.g., `00001`). The system automatically assembles the full ID and displays it as a preview.
5. Select the **Engineering District** (DEO) from the dropdown.
6. Enter the **Road Length** in metres.
7. Click **Save**.

[Insert Screenshot: Add Road Section Dialog]

**On Success:** The road section is created with an auto-generated Section Road ID (`FS{5digits}{IslandCode}`). It appears in the **Road Sections** tab.

---

#### 5.8.2 Road Sections Tab

**Purpose:** View, search, filter, edit, and delete road sections. Also the only location where bridges can be created.

> **Note:** There is no standalone "Add Road Section" button in this tab. Road sections must be created from the **Roads tab** using the **+ Add Section** row action.

**Road Sections Table Columns:**

| Column | Description |
|--------|-------------|
| Section Road ID | Unique section identifier (purple badge) |
| Road ID | Parent road identifier (blue badge) |
| Length (m) | Section length in metres |
| Engineering District | DEO responsible for this section (orange badge showing DEO name) |
| Actions | Yellow **Edit** (pencil) icon, red **Delete** (trash) icon, blue **+ Add Bridge** button |

**Field Reference — Road Sections Tab Toolbar:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| UI-UX-0128-RS-T01 | Search input | Filter by section road ID | Text; press Enter or click Search |
| 1 | Search | Executes the section ID search | Button (blue) |
| 2 | Clear Filter | Removes active filter and reloads all sections | Button (red); visible only when a filter is active |
| 3 | Filter | Opens the Filter Road Sections dialog | Button (white/orange when active); shows count badge |

---

**Step-by-Step: Editing a Road Section**

The **Edit Future Road Section** dialog opens when the pencil icon is clicked directly in the Road Sections tab.

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | PARENT ROAD ID | The parent road | Dropdown of all roads; required |
| 2 | SECTION ROAD ID | Section identifier | Split input: `FS` prefix + 5-digit number + island code suffix |
| 3 | ENGINEERING DISTRICT | DEO responsible | Dropdown; required |
| 4 | ROAD LENGTH | Length in metres | Numeric; required |
| 5 | ✕ (close) | Dismiss without saving | Button |
| 6 | Save | Validate and save | Button (blue) |

1. Click the yellow **pencil icon** on the road section's row.
2. The **Edit Future Road Section** dialog opens, pre-filled with the section's current data.
3. Modify any field as needed.
4. Click **Save**.

[Insert Screenshot: Edit Future Road Section Dialog]

**On Success:** The road section record is updated and the table refreshes.

---

**Step-by-Step: Deleting a Road Section**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Section info panel | Displays Section Road ID, Parent Road ID, Length, and Engineering District of the section to be deleted | Read-only |
| 2 | CONFIRMATION INPUT | Must type **DELETE** to enable the delete button | Text input; required; case-insensitive |
| 3 | Cancel | Closes the dialog without deleting | Button |
| 4 | Delete Road Section | Permanently removes the section | Button (red); disabled until confirmation text is typed |

1. Click the red **trash icon** on the section's row.
2. The **Delete Road Section** dialog opens showing the Section Road ID, Parent Road ID, Length, and Engineering District, with a warning that the action cannot be undone.
3. Type **DELETE** in the confirmation field.
4. Click **Delete Road Section**.

[Insert Screenshot: Delete Road Section Dialog]

**On Success:** A success toast ("Road section deleted successfully.") appears and the record is removed.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| Delete Road Section button remains disabled | Confirmation text not typed | Type DELETE in the confirmation field |
| *"Failed to delete road section. Please try again."* | Server-side error | Retry; verify no active bridges are linked to this section |

> **Warning:** Deleting a road section permanently removes it and may affect linked bridges.

---

**Step-by-Step: Filtering Road Sections**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | ROAD ID | Filter by parent road identifier (partial match) | Text input |
| 2 | SECTION ROAD ID | Filter by section road identifier (partial match) | Text input |
| 3 | ENGINEERING DISTRICT (DEO) | Filter by assigned engineering district | Searchable dropdown: All Districts / individual DEO names |
| 4 | Clear Filter | Resets all fields and reloads all sections | Button (zinc); disabled when all fields are empty |
| 5 | Cancel | Closes the dialog without applying | Button (zinc) |
| 6 | Apply Filter | Applies filter criteria and refreshes the table | Button (orange) |

1. Click the **Filter** button.
2. In the **Filter Road Sections** dialog, enter any combination of Road ID, Section Road ID, or select an Engineering District. Leave a field empty to include all values.
3. Click **Apply Filter**.
4. To remove all filters: click **Clear Filter** inside the dialog, or click the red **Clear Filter** toolbar button.

[Insert Screenshot: Filter Road Sections Dialog]

---

**Step-by-Step: Adding a Bridge from a Road Section Row**

Each road section row has a blue **+ Add Bridge** button. This is the only way to create new bridges.

**Field Reference — Add Bridge Dialog (launched from road section row):**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | SECTION ROAD ID | The road section this bridge belongs to | Read-only; pre-filled with the parent section's ID |
| 2 | BRIDGE ID | Bridge identifier, assembled from three parts | Split input: prefix `FB` (fixed) + 5-digit number (user-entered, digits only, max 5 chars) + island code suffix (auto-derived from parent section ID) |
| 3 | BRIDGE NAME | Name of the bridge | Text input; required |
| 4 | FROM CHAINAGE (km) | Starting position of the bridge along the road section, in kilometres | Numeric input (step 0.01, min 0); required |
| 5 | BRIDGE LENGTH (m) | Total length of the bridge structure, in metres | Numeric input (step 0.01, min 0.01); required |
| 6 | WEIGHT OF CARRIAGE WAYS (Kg) | Load capacity of the bridge's carriageway(s) in kilograms | Numeric input (step 1, min 0); required |
| 7 | ✕ (close) | Dismiss the dialog without saving | Button |
| 8 | Save | Validate and save the bridge | Button (blue) |

> The **Bridge ID** is assembled in real time: `FB{00000}{IslandCode}`. The island code is derived automatically from the parent section's Section Road ID. A preview of the full ID is displayed below the input as soon as the number is entered.

1. Locate the road section in the Road Sections table.
2. Click the blue **+ Add Bridge** button on that section's row.
3. The **Add New Future Bridge** dialog opens. The **Section Road ID** is pre-filled and read-only.
4. Enter the 5-digit **Bridge number** in the Bridge ID field (e.g., `00001`). The full ID preview updates automatically.
5. Enter the **Bridge Name**.
6. Enter the **From Chainage** (starting position in kilometres along the road section).
7. Enter the **Bridge Length** in metres.
8. Enter the **Weight of Carriage Ways** in kilograms.
9. Click **Save**.

[Insert Screenshot: Add New Future Bridge Dialog]

**On Success:** The bridge is created with an auto-generated Bridge ID (`FB{5digits}{IslandCode}`) and appears in the **Bridges** tab.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| *"Please fill in all required fields with valid values"* | One or more of Section Road ID, Bridge Name, From Chainage, Bridge Length, or Weight of Carriage Ways was left blank or zero | Complete all required fields with valid values before clicking Save |

---

#### 5.8.3 Bridges Tab

**Purpose:** View, search, filter, edit, and delete future bridges.

> **Note:** There is no standalone "Add Bridge" button in this tab. Bridges must be created from the **Road Sections tab** using the **+ Add Bridge** row action.

**Bridges Table Columns:**

| Column | Description |
|--------|-------------|
| Section Road ID | Parent road section identifier (blue badge) |
| Bridge Name | Name of the bridge |
| Bridge ID | Unique bridge identifier (purple badge) |
| From (m) | Starting chainage of the bridge from the section start, displayed in metres |
| Length (m) | Bridge length in metres |
| Carriage Way | Load capacity badge (blue, displayed as "{value} Way") |
| Actions | Yellow **Edit** (pencil) icon, red **Delete** (trash) icon |

**Field Reference — Bridges Tab Toolbar:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| UI-UX-0128-B-T01 | Search input | Filter by bridge name | Text; press Enter or click Search |
| 1 | Search | Executes the bridge name search | Button (blue) |
| 2 | Clear Filter | Removes active filter and reloads all bridges | Button (red); visible only when a filter is active |
| 3 | Filter | Opens the Filter Bridges dialog | Button (white/orange when active); shows count badge |

---

**Step-by-Step: Editing a Bridge**

The **Edit Future Bridge** dialog uses the same fields as the Add dialog. All fields are editable.

1. Click the yellow **pencil icon** on the bridge's row.
2. The **Edit Future Bridge** dialog opens, pre-filled with the bridge's current data.
3. Modify any field as needed.
4. Click **Save**.

[Insert Screenshot: Edit Future Bridge Dialog]

**On Success:** The bridge record is updated and the table refreshes.

---

**Step-by-Step: Deleting a Bridge**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | Bridge info panel | Displays Bridge Name, Section Road ID, From Chainage, Length, and Carriage Ways | Read-only |
| 2 | CONFIRMATION INPUT | Must type **DELETE** to enable the delete button | Text input; required; case-insensitive |
| 3 | Cancel | Closes the dialog without deleting | Button |
| 4 | Delete Bridge | Permanently removes the bridge | Button (red); disabled until confirmation text is typed |

1. Click the red **trash icon** on the bridge's row.
2. The **Delete Bridge** dialog opens showing the Bridge Name, Section Road ID, From Chainage, Length, and Carriage Ways, along with a warning that the action cannot be undone.
3. Type **DELETE** in the confirmation field.
4. Click **Delete Bridge**.

[Insert Screenshot: Delete Bridge Dialog]

**On Success:** A success toast ("Bridge deleted successfully.") appears and the record is removed.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| Delete Bridge button remains disabled | Confirmation text not typed | Type DELETE in the confirmation field |
| *"Failed to delete bridge. Please try again."* | Server-side error | Retry; contact the system administrator if the error persists |

> **Warning:** Deleting a bridge permanently removes it and all related infrastructure data.

---

**Step-by-Step: Filtering Bridges**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | SECTION ROAD ID | Filter by parent road section identifier (partial match) | Text input |
| 2 | BRIDGE ID | Filter by bridge identifier (partial match) | Text input |
| 3 | BRIDGE NAME | Filter by bridge name (partial match) | Text input |
| 4 | Clear Filter | Resets all fields and reloads all bridges | Button (zinc); disabled when all fields are empty |
| 5 | Cancel | Closes the dialog without applying | Button (zinc) |
| 6 | Apply Filter | Applies filter criteria and refreshes the table | Button (orange) |

1. Click the **Filter** button.
2. In the **Filter Bridges** dialog, enter any combination of Section Road ID, Bridge ID, or Bridge Name. Leave a field empty to include all values.
3. Click **Apply Filter**.
4. To remove all filters: click **Clear Filter** inside the dialog, or click the red **Clear Filter** toolbar button.

[Insert Screenshot: Filter Bridges Dialog]

---

#### 5.8.4 Import Dialog

**Purpose:** Pull infrastructure data from external systems (the RBIA Geographic Information System and administrative reference tables) into the MYPS database in bulk.

**Who uses this:** PS Admin

**When to use:** During initial system setup, or when the external GIS has been updated with new roads, sections, or bridges that must be synchronized into MYPS.

**Field Reference — Import Road Network Dialog:**

| Field Ref No. | Fields / Blocks / Objects | Description | Values / Actions |
|---|---|---|---|
| 1 | ✕ (close) | Close the dialog and discard all selections | Button |
| UI-UX-0128-IMP-G01 | **Import Road Network Data from RBIA** (group) | Group header checkbox — selects or deselects all items in this group at once; shows a dash (−) when only some items are checked | Tri-state checkbox |
| UI-UX-0128-IMP-I01 | Roads | Import national road records from the GIS | Item checkbox; **active** — connected to GIS |
| UI-UX-0128-IMP-I02 | Road Section | Import road section records from the GIS | Item checkbox; **active** — connected to GIS |
| UI-UX-0128-IMP-I03 | Bridges | Import bridge records from the GIS | Item checkbox; **active** — connected to GIS |
| UI-UX-0128-IMP-I04 | Region | Import region reference data | Item checkbox; **pending** — present in UI but not yet connected to GIS |
| UI-UX-0128-IMP-G02 | **Import Lookup tables from Admin Areas** (group) | Group header checkbox | Tri-state checkbox |
| UI-UX-0128-IMP-I05 | City/Municipality, Legislative District | Import administrative division lookup data | Item checkbox; **pending** — not yet connected |
| UI-UX-0128-IMP-G03 | **Import Lookup tables from Internal Org** (group) | Group header checkbox | Tri-state checkbox |
| UI-UX-0128-IMP-I06 | DEO, Implementing Office | Import internal organizational unit lookup data | Item checkbox; **pending** — not yet connected |
| 1 | Start Import | Execute the import for all checked items | Button (blue); disabled when no items are selected; shows "Importing..." while running |

**Import Status Summary:**

| Item | Connected to External Source | Effect when selected |
|------|------------------------------|---------------------|
| Roads | Yes (RBIA GIS) | Pulls all national road records from GIS into MYPS |
| Road Section | Yes (RBIA GIS) | Pulls all road section records from GIS into MYPS |
| Bridges | Yes (RBIA GIS) | Pulls all bridge records from GIS into MYPS |
| Region | No (pending) | Checkbox is displayed but no import will occur |
| City/Municipality, Legislative District | No (pending) | Checkbox is displayed but no import will occur |
| DEO, Implementing Office | No (pending) | Checkbox is displayed but no import will occur |

**Step-by-Step: Importing Road Network Data**

1. Click the blue **Import** button (top-right of the Infrastructure Administration page, with an upload icon).
2. The **Import Road Network** dialog opens, showing the three groups and their items.
3. To select all items in a group, click the **group-level checkbox**. The checkbox turns to a dash (−) when only some items in the group are checked.
4. To select individual items, click each item's checkbox independently.
5. Select **Roads**, **Road Section**, and/or **Bridges** as needed (these are the currently active import sources).
6. Click **Start Import**. The button label changes to "Importing..." while the operation runs. All selected items are processed in parallel.
7. The dialog closes automatically when all imports complete.

[Insert Screenshot: Import Road Network Dialog]

**On Success:** The imported records appear in the respective tabs (Roads, Road Sections, Bridges) and the tab count badges update on the next page load or navigation.

**Common Outcomes & What to Do:**

| Message / Situation | What it Means | What You Should Do |
|---|---|---|
| Start Import button is disabled | No items are selected | Tick at least one item checkbox before clicking Start Import |
| Dialog closes but tab counts did not update | Counts are loaded once on page open | Navigate away and back to the Infrastructure Administration page to refresh the counts |
| Region / City-Municipality / DEO items selected but no new data appears | These import sources are not yet connected | This is expected; these items show in the dialog but are pending implementation |

---

## 6. Workflows

### Workflow 1: Create a Program and Encode a Project

1. Log in to MYPS.
2. Navigate to **Programs** → click **Add Program** → fill in details → click **Submit**.
3. Open the new program → click **Add Project**.
4. Complete all required Project Details fields → click **Save Project**.
5. Navigate to **Funding Profile** → add funding source and amount.
6. Navigate to **Component Cost** → add component, year, and amount.
7. Navigate to **Major Items of Work** → link component to infrastructure type.
8. Navigate to **Work Locations** → enter location details.
9. Attach supporting documents if required.

---

### Workflow 2: Advance Program Through Budget Stages

1. Navigate to **Programs** and open a program.
2. Confirm all required projects are encoded.
3. Click **Next Program Stages** to advance (Budget Proposal → NEP → GAA → GAA-R).

---

### Workflow 3: Submit a Project Revision

1. Open the project in **Projects** and confirm it is published to PCMA.
2. Click the yellow **Revise Project** button.
3. Select the revision type and reason → click **Submit**.
4. Update the required project fields.
5. Click **Submit Revision** → select approval date → upload PDF document → check certification → click **Submit**.

---

### Workflow 4: Review and Approve a Revision (RO Level)

1. Select **Revision** from the sidebar.
2. Find the revision request submitted by a DEO.
3. Click **View** → review the changes.
4. Select **Approve**, **Reject**, or **For Correction**.

---

### Workflow 5: Final Approval of a Revision (PS Admin Level)

1. Select **Revision** from the sidebar.
2. Find the revision request forwarded from the RO.
3. Click **View** → review the changes.
4. Select **Approve**, **Disapprove**, or **For Correction**.

---

## 7. Error Handling

| Error / Condition | Module | Cause | User Action |
|-------------------|--------|-------|-------------|
| "Invalid credentials. Please check your user ID and password and try again." | Login | The username or password entered is incorrect | Re-enter the correct username and password |
| "Your session has expired. Please sign in to continue." | Login | The account is not active or the current session has expired | Contact your PS Admin to verify the account is active, then log in again |
| "(Field Name) is required." | Add Project | Required field left blank | Complete all fields marked with a red asterisk |
| "Total funding percentage must equal 100%. Current total: 0.0%." | Funding Profile | No amount entered | Enter valid funding amounts |
| "Please enter a valid year for cost entry." | Component Cost | Year field left blank | Enter a valid year in the cost row |
| "Please enter a valid amount for cost entry." | Component Cost | Amount field left blank | Enter a valid amount in the cost row |
| "This cost will exceed the maximum budget by (amount)." | Component Cost | Cost exceeds Funding Profile | Reduce component cost or increase the Funding Profile |
| Update Project does not proceed | Work Locations (Roads) | Station or Chainage fields missing | Fill in Start/End Station and Start/End Chainage |
| Excess component cost prompt | Revision (Termination) | Funding Profile total differs from Component Cost | Review and confirm the auto-created excess cost entry |
| Revise Project button not visible | Projects | Project not yet published to PCMA | Publish the project using Allow Publishing in the GAA-R program |
| Potential duplicate warning | Add Project | System detects a similar project | Cancel to review existing projects, or proceed if confirmed not a duplicate |

---

## 8. Frequently Asked Questions

**Q: Why can I not see a module in the sidebar?**
**A:** Module visibility depends on your user group permissions. Contact your PS Admin to verify that the required module permissions are enabled for your user group.

**Q: Why is the "Revise Project" button not showing?**
**A:** The project must be published to PCMA before it is eligible for revision. If the button is still not visible, verify that the project's status meets the conditions for the selected revision type (see Section 5.4.3).

**Q: What happens when an approver returns a revision for correction?**
**A:** The revision is returned to the submitting user group with a "For Correction" status. The user can update the project details and re-submit.

**Q: Can Program Stages be skipped?**
**A:** Yes. Program stages can be skipped when advancing from one stage to another.

**Q: How is the Project ID generated?**
**A:** Project IDs are auto-generated by the system. The format encodes the budget stage, fiscal year, project sequence number, and island code. You do not enter a Project ID manually.

**Q: Why does Update Project not proceed for a Roads project?**
**A:** For Road infrastructure type, Start Station, End Station, Start Chainage, and End Chainage are all mandatory. Provide all four values before saving.

**Q: What does "Allow Publishing" do?**
**A:** It marks selected projects as eligible to be published to PCMA. This action is only available on GAA-R stage programs and is performed by PS Admin.

---

## 9. Notes & Limitations

* **Inactive modules:** Lump Sum, Multi-Year Management, and Reports are currently disabled in the sidebar and are not accessible to users.
* **Code Tables dependency:** Program Types, Program Stages, Categories, Infrastructure Types, Funding Sources, and all other dropdown options are sourced from Code Tables. Ensure all required reference data is configured in Code Tables before users begin encoding.
* **PCMA publishing prerequisite:** A project must be published to PCMA before revisions are possible. Publishing is controlled by PS Admin using the Allow Publishing batch action on a GAA-R program.
* **Role-based visibility:** Features and modules visible to each user depend on their assigned User Group permissions. Contact your PS Admin if expected features are not visible.
* **Excel import format:** When importing projects, the Excel file must match the downloaded template exactly. Changes to the template structure may cause import failures.
* **PDF requirement:** Revision submissions require an uploaded PDF approval document. Other file formats are not accepted.

---

## Appendix A: Issue Reporting Checklist

When reporting an issue to support, include the following information:

| Information to Capture | Example / Notes |
|------------------------|-----------------|
| Screen name and section | Example: Component Cost section inside Project Details |
| Time of issue | Date and time when the issue occurred |
| Program, project, revision, or transaction ID | Use the relevant identifier for the affected record |
| Button or action clicked | Example: Submit Revision, Add Component, Import Projects |
| On-screen message | Copy the exact validation or error message displayed |
| Browser and environment | Example: Chrome 124 / UAT |
| Screenshot | Attach if available and permitted |

---

## Appendix B: Consolidated Validation Messages

| Area | Message or Condition | User Action |
|------|----------------------|-------------|
| Login | Username is required | Enter your username before clicking Sign In |
| Login | Password is required | Enter your password before clicking Sign In |
| Login | Invalid credentials. Please check your user ID and password and try again. | Re-enter the correct username and password |
| Login | Your session has expired. Please sign in to continue. | Contact your PS Admin to verify the account is active, then log in again |
| Add Program | Name: The Name field is required | Enter a program name in the Sub Name field before clicking Submit |
| Add Program | Program Type is required. | Select a Program Type from the dropdown before clicking Submit |
| Add Program | Program Stage is required. | Select a Program Stage from the dropdown before clicking Submit (not required when Program Type = TF) |
| Global Search | No results found | Review the selected category and search value, then try again |
| Add Project | (Field Name) is required | Complete all fields marked with a red asterisk before saving |
| Funding Profile | Total funding percentage must equal 100%. Current total: 0.0% | Enter valid funding amounts |
| Component Cost | Please enter a valid year for cost entry | Enter a valid year value before clicking Add |
| Component Cost | Please enter a valid amount for cost entry | Enter a valid amount before clicking Add |
| Component Cost | This cost will exceed the maximum budget by (excess amount) | Reduce the component cost or increase the Funding Profile amount |
| Work Locations (Roads) | Update Project does not proceed | Provide Start Station, End Station, Start Chainage, and End Chainage |
| Revision (Termination) | Excess component cost prompt on submission | Review the auto-created excess component cost before confirming |
| Revision Submission | Approval document required | Upload a valid PDF approval document |
| Revision Submission | Certification checkbox required | Check the certification checkbox before clicking Submit |
| Add Project | Potential duplicate / Proceed with Caution | Cancel to review existing records, or proceed if confirmed not a duplicate |

---

## Appendix C: Controlled Terminology

| Preferred Manual Term | UI / Alias Labels to Reconcile |
|-----------------------|---------------------------------|
| Global Search | Search modal, Search dialog, Search panel |
| Generate Reports | Generate AIP Report, View AIP Report, AIP Download, View Report |
| Infra Management | Infrastructure Administration, Infrastructure Management, Settings — Infra Management |
| Revise Project | Modify Project, Request Revision, Edit Revision |
| View Revision | View Revisions, Revision Detail |
| Batch Actions | Batch Action, Bulk Action |
| Submit Revision | Save Revision, Submit Modification |
| Return for Correction | For Correction, Send Back, Request Correction |
| HGAB | House-Approved General Appropriations Bill — do NOT use "High Government Assistance Budget" |
| MYPS | Multi-Year Planning and Scheduling — always spell out on first use in each section |
| DEO | District Engineering Office — spell out on first use in each section |
| PS Admin | Planning Service Administration — spell out on first use in each section |
