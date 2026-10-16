# UserManual.md — Changelog v3.13 → v3.14 (FE/UserManual.md)

**Date:** October 15, 2026
**Branch:** fix/dashboard-qa-concerns-v2.0.2 (uncommitted, on top of `2473f03d`)
**Source:** User report: with Program Stage = GAA, the FY Infrastructure Budget details showed "GAA 2025 OO-1 · GAA-R · 2 of 6,449 projects", while Program Details `:GAA` has 513 pages and the Programs list shows 5,121 projects for that stage. With NEP chosen, the Program Budget panel showed "GAA 2025 …" programs and the details showed a GAA-R program whose projects were "at NEP". The Dashboard counted each project once, at its own latest stage. It now reads each program at one program stage, as Program Details does (user decision: with no stage chosen, the program's current stage). Implemented under `documents/plans/dashboard-stage-reads-program-stage.md`; verified against `myps_db_dev`.

---

## 1. Document Header

| Field | v3.13 | v3.14 |
|-------|-------|-------|
| Version | 3.13 | 3.14 |
| Date | October 14, 2026 | October 15, 2026 |

A v3.14 row was added to the Revision History table.

---

## 2. Section 5.1 — Title and Header Controls

| # | Item | Old | New | Reason |
|---|------|-----|-----|--------|
| 1 | Title | "...or **All budget stages** when none is chosen." | "...or **Current program stages** when none is chosen: each program at its current stage." | With no stage chosen, each program is now read at its current stage (user decision), so "All budget stages" no longer described the figures. Demo Data keeps "All budget stages". |
| 2 | Program Stage Name | "Narrows every section to the projects at one budget stage ... Choose **All stages** to return to all." | "Reads every program at one budget stage, the way Program Details shows that stage: the projects in the program's stage, their amounts at that stage, and the program's name there (for example *NEP 2025 OO-1* at NEP, *GAA 2025 OO-1 as Approved* at GAA) ... Choose **Current stages** to read each program at its current stage again." | The filter used to keep only projects whose own latest stage was the one chosen (2 of GAA 2025 OO-1's 6,449 at GAA). Each program stage is its own project set with its own revisions, costs and program name; Program Details and the Programs list read it that way. The dropdown's first choice is renamed to match. |

---

## 3. Section 5.1 — What counts toward a fiscal year

| # | Old | New |
|---|-----|-----|
| 1 | "Only projects at a **budget stage** are counted: BP, NEP, ... TF-R. Planning proposals (**RBP, RDIP, PIP**) are not budget and are not counted." | New first bullet: each program is read at **one stage**, the chosen one or else its **current stage** (the stage the Programs list opens with **View**); its projects are the ones Program Details lists for that stage, each with its cost at that stage; a project that stopped at an earlier stage than its program's current stage counts only when that stage is chosen. The budget-stage bullet follows, reworded to "Only **budget stages** are counted". |
| 2 | "...is counted at its revised amount, the same amount Program Details shows." | "...is counted at its revised amount at the stage it revises, the same amount Program Details shows." |

Effect on the figures (FY 2025, no filter): ₱1,333.06B across 34,010 projects becomes ₱1,152.91B across 30,425. The 3,585 projects (₱180B) that stopped at BP, NEP, NEP-E or HGAB, and never reached their program's GAA, now count only under their own stage. GAA 2025 OO-1 at GAA reads 5,121 projects and ₱295,301,759,000.05, the Programs list's GAA figures exactly.

---

## 4. Section 5.1 — Dashboard Sections table

| # | Section | Old | New | Reason |
|---|---------|-----|-----|--------|
| 1 | Summary cards | "one row per program with its stage, how many of its projects count (for example *14 of 22 projects*)... A project at a different stage than its program is marked **at \<stage\>**. Select a project to open its details page" | "one row per program, under its name at the stage it is read at, with that stage, how many of its projects count (for example *5,121 of 5,121 projects*; the second number is the program's project count at that stage, the list Program Details pages through)... All of a program's projects are at the program's stage. Select a project to open its details page at that stage" | The second number was the program's count across all stages (6,449), which matched no stage. The **at \<stage\>** marker can no longer occur and was removed. |
| 2 | Distribution of Budget by Region | "...or *All budget stages*." | "...or *Current program stages*." | Follows the title line. |
| 3 | Summary cards | *(no sentence)* | Adds: "Select a program's name to open its Program Details, at the stage shown, in a new tab." | User request: open a program's details from a card's details. The link is `/programs/programdetails/<ProgramPK>:<stage>`, what the Programs list's **View** opens; the rest of the row still expands the program. Demo Data program names are not links. |
| 4 | Project Categories | "...each with its number of projects, share and amount..." | "...share (to two decimal places, for example *16.86%*)..." | User request: whole-number shares hid small categories' differences. |
| 5 | Summary cards | "...to open it in a new tab. **Project Repository** opens the Projects list." | The last sentence is removed. | User request: the button was redundant now that each program and project in the list opens itself. |
| 6 | FY Regional Infrastructure Portfolio | "The fiscal year's projects, largest budget first, with their region, stage, island group and budget... select **View** for a project's summary." | "...largest FY amount first, with their region, stage and island group... select **View** for a project's summary (stage, program, region, category and implementing office, as on its details page), where **Project Repository** opens the project's details page in a new tab. No amount is shown per project, as in the cards' project lists." | User report: the summary's "FY Regional Allocation Outlay" (P00968001LZ: ₱17,312,133,000, its FY 2025 share) contradicted the ₱58,472,375,000 Total Cost on its details page. User decision: no per-project amount, as in the cards' lists. The FY Regional Outlay column and the Page Total were removed with it, and Project Repository now opens the project itself instead of the Projects list. |

---

## 5. Section 5.1 — Common Outcomes

| # | Old | New |
|---|-----|-----|
| 1 | *(no row)* | **New:** "The Programs list shows a slightly different project count or amount for a program's stage than the Dashboard". Expected in three cases: the Programs list counts projects removed from the stage (GAA 2025 OO-1 at GAA-R: 5,121 there, 5,119 in Program Details and on the Dashboard); it adds the program's Lump Sum allocation to every stage row, even where the Lump Sum did not exist yet (GAA 2025 OO-1 at NEP: ₱254.56B there, ₱253.76B on the Dashboard); and for a single-year project it counts that year's cost even when it is not the fiscal year. |

---

## 6. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| *(uncommitted)* | Dashboard: read each program at one program stage, as Program Details does (plan `dashboard-stage-reads-program-stage.md`) | Sections 2–5 above |
| *(uncommitted)* | Dashboard: program names in a card's details open Program Details in a new tab; category shares to two decimals | Section 4 rows 3–4 |
| *(uncommitted)* | Dashboard: no per-project amount in the Regional Portfolio; Project Repository opens the project in a new tab; KPI details footer button removed | Section 4 rows 5–6 |

---

# UserManual.md — Changelog v3.12 → v3.13 (FE/UserManual.md)

**Date:** October 14, 2026
**Branch:** fix/dashboard-qa-concerns-v2.0.2 (uncommitted, on top of `fbd5d2f5`, the merge of `origin/main`)
**Source:** The user's request to rename the Dashboard title "National Expenditure Program & Portfolio Matrix" to "Program Stage", to add Program Type and Program Stage Name filters beside Category, and to show the chosen stage under the title. Implemented under `documents/plans/dashboard-program-stage-type-filters.md`. The manual text describes the behaviour as built and verified against `myps_db_dev`.

---

## 1. Document Header

| Field | v3.12 | v3.13 |
|-------|-------|-------|
| Version | 3.12 | 3.13 |
| Date | October 14, 2026 | October 14, 2026 |

A v3.13 row was added to the Revision History table.

---

## 2. Section 5.1 — Dashboard: new "Title" paragraph

**New:** "The header is titled **Program Stage**. The line under the title names the stage the figures cover: the stage chosen in **Program Stage Name**, shown as its code and full name (for example *NEP-E · National Expenditure Program with Errata*), or **All budget stages** when none is chosen."

The manual did not name the old title ("National Expenditure Program & Portfolio Matrix"), so there is no old text to replace. The wording follows the user's choices: code plus full name, and "All budget stages" with no stage chosen.

---

## 3. Section 5.1 — Header Controls table

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | *(no row)* | **Program Type**: narrows every section to the projects in one type of program (Regular Infrastructure, External Infrastructure, Trust Fund, Automatic Appropriation); **All program types** returns to all; Live DB only. | New filter (user request). The four types are `tOptionProgramType`. |
| 2 | *(no row)* | **Program Stage Name**: narrows every section to one budget stage, listed BP to TF-R with full names; RBP, RDIP and PIP are not listed because the Dashboard never counts them; the chosen stage appears under the title; **All stages** returns to all; Live DB only. | New filter (user request). Only the nine budget stages the Dashboard counts are offered. |
| 3 | "...all show the same amount for the same year and category." | "...for the same year and filters. Category, Program Type and Program Stage Name combine: a project must match every one that is chosen." | The three filters are ANDed in every section. Verified: the per-stage and per-type totals add up to the unfiltered FY2024 total. |

---

## 4. Section 5.1 — Dashboard Sections table

| # | Section | Old | New | Reason |
|---|---------|-----|-----|--------|
| 1 | Summary cards | "...Select a card to open its details, including how the figure is calculated." | Adds: the FY Infrastructure Budget, Active Portfolio Projects and Publication Compliance details list their projects **per program**. Each program row shows its stage, "*N of M projects*" and its FY amount, largest first; the program amounts add up to the card. A program expands to its projects, 10 per page, in Program Details' columns (Project ID, Description, Category, SubProgram, Implementing Office, Operating Unit, Publishable, Published); a project at another stage than its program is marked **at \<stage\>**. Selecting a project opens its details page (a Lump Sum Project opens in Lump Sum Projects, Section 5.10). Its Project ID can be opened in a new tab (right-click, or Ctrl+click / middle-click the row). **Project Repository** opens the Projects list. | User requests, in order. (1) A project clicked in a card's details opened the Projects list rather than that project; it now opens by the Project List's rules: `/projects/project-details/<ID>:<stage>`, or `/lumpsum/<id>` for a Lump Sum Project. (2) The flat list showed each project's FY-scheduled amount, which users compared with the larger multi-year total on the project's page (P00968001LZ: ₱17.31B vs ₱58.47B), so the user asked for the projects per program, as on Program Details, with no per-project amount (plan `dashboard-kpi-modal-projects-per-program.md`). (3) Open a project in a new tab. |
| 2 | Distribution of Budget by Region | "...Select a region to zoom to it." | Adds: "Its badge names the fiscal year and the chosen stage, for example *FY 2027 General Appropriations Act*, or *All budget stages*." | The badge always read "National Expenditure Program". On Live DB it now follows the stage filter (user decision). |
| 3 | Distribution of Budget by Region | "...on an interactive map or as pie analytics." | Adds: the tables beside the map list each group's regions in DPWH's order (Southern Luzon IV-A, MIMAROPA, V; Northern Luzon CAR, I, II, III; Visayas NIR, VI, VII, VIII; Mindanao IX–XIII, BARMM), and every group header shows its share and amount. NCR / Northern / Southern Luzon are the Dashboard's own grouping, since the database records only the island group. | User request: the tables were in budget order, and Northern/Southern Luzon showed only their %. The order is `tOptionAdminAreaRegion.Hierarchy` (NCR 10101 … BARMM 10317), which matches the requested order exactly (plan `dashboard-regions-trend-categories.md`). |
| 4 | Annual Budget & Lump Sum Itemization Trend | "Each year's infrastructure budget and itemized Lump Sum amount. Point to a year to see both amounts; select it to switch the Dashboard to that year." | Both amounts printed under each year's bars and repeated for the selected year below the chart. Selecting a year keeps the chart as it is; a filter change keeps it on screen marked **Updating…**. | User request: the amounts showed only on hover, and selecting a year made the chart disappear and come back. The trend does not depend on the selected year, so it is no longer reloaded. |
| 5 | Project Stages → **Project Categories** | "The number of projects at each budget stage. Select a stage to filter the project list below. Choosing a different **Program Stage Name** in the header clears the stage selected here." | "The fiscal year's projects per project category ... Select a category to filter the whole Dashboard by it, as the **Category** filter does; select it again, or **Clear Filter**, to remove it." | User request: show the breakdown per category, as in the Category filter. The stage breakdown and its project-list stage filter are gone; the header's Program Stage Name filter remains. |
| 6 | *(new paragraph after the Sections table)* | *(none)* | **New:** "Changing the year or a filter: the page stays where you are…": sections keep their previous figures, dimmed and marked **Updating…**, until the new ones arrive, and the part of the page clicked stays in place; scrolling yourself takes over. | User report: selecting a trend bar or a category sent the page down to the next section and back. Sections above collapsed to shorter loading placeholders while they reloaded (plan `dashboard-keep-scroll-position.md`). |

---

## 5. Section 5.1 — Step-by-Step

| # | Old | New |
|---|-----|-----|
| 4 | "*(Optional)* Click in **Category** and pick a category..." | Same, plus "Choose a **Program Type** and/or a **Program Stage Name** from their lists; the chosen stage appears under the **Program Stage** title." |
| 6 | "To list one island group's or stage's projects, select its card. Select **Reset Filter** in the project list to clear it." | "To list one island group's projects, select its card; select **Reset Filter** in the project list to clear it. To narrow the whole Dashboard to one category, select it under *Project Categories*." |
| 7 | "...the header stays pinned at the top of the page as a single row (**Viewing FY \<year\>**, the data source, Category, the fiscal years and Refresh)..." | "...in a compact form (**Viewing FY \<year\>**, the data source, Category, Program Type, Program Stage Name, the fiscal years and Refresh)..." |

Step 7: with two more controls, the pinned header wraps to two lines at a 1440 px wide window, so "single row" is no longer accurate.

---

## 6. Section 5.1 — On Success and Common Outcomes

| # | Old | New |
|---|-----|-----|
| 1 | On Success: "...the selected fiscal year (and category, if chosen)..." | "...the selected fiscal year (and the category, program type and stage, if chosen)..." |
| 2 | "A category with no projects in the fiscal year" | "A category, program type or stage (or a combination of them) with no projects in the fiscal year". The outcome text is unchanged. |
| 3 | Demo Data: "...The Category control is unavailable." | "...The Category, Program Type and Program Stage Name controls are unavailable, the line under the title reads **All budget stages**, and choosing Demo Data clears any category, program type or stage chosen in Live DB." |
| 4 | *(no row)* | **New:** "A project's details page shows a larger total cost than the Dashboard counts for it". It is expected: the page shows the whole multi-year cost, and the Dashboard only the cost scheduled in the fiscal year. Yearly amounts that add up to less than the Total mean part of the cost was never scheduled to a year (619 imported components on `myps_db_dev`, ₱297B in all). |

---

## 7. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| *(uncommitted)* | Dashboard: "Program Stage" title with Program Type and Program Stage Name filters (plan `dashboard-program-stage-type-filters.md`) | Sections 2–6 above |
| *(uncommitted)* | Dashboard: KPI details list projects per program, linked to each project (plan `dashboard-kpi-modal-projects-per-program.md`) | Section 4 row 1, Section 6 row 4 |
| *(uncommitted)* | Dashboard: region order and Luzon sub-group amounts, trend values, category breakdown (plan `dashboard-regions-trend-categories.md`) | Section 4 rows 3–5, Section 5 row 6 |
| *(uncommitted)* | Dashboard: the page stays in place when a year or category is selected (plan `dashboard-keep-scroll-position.md`) | Section 4 row 6 |

---

# UserManual.md — Changelog v3.11 → v3.12 (FE/UserManual.md)

**Date:** October 14, 2026
**Branch:** main (uncommitted, on top of `966de3eb`)
**Source:** QA concerns document `myps_concerns.docx` (seven Dashboard findings, screenshots SS1–SS5) and the user's request to add a Category filter beside the year switcher. Implemented under `documents/plans/dashboard-tester-concerns-fy-scope-category-filter.md`. The manual text describes the behaviour as built and verified against `myps_db_dev`, not the plan wording.

---

## 1. Document Header

| Field | v3.11 | v3.12 |
|-------|-------|-------|
| Version | 3.11 | 3.12 |
| Date | September 10, 2026 | October 14, 2026 |

A v3.12 row was added to the Revision History table.

---

## 2. Section 5.1 — Dashboard: Purpose

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | "It provides an overview of the logged-in user's account and system status." | "It summarizes the infrastructure budget of one fiscal year: the total budget, the programs it is spread across, where it goes by region and island group, how it moved over the years, and the projects behind it." | The old text described a user-info dashboard that no longer exists. |
| 2 | Prerequisites: "Successful login (see Section 3.1)." | Same, plus "The figures cover only the projects your user group is allowed to see." | The dashboard applies the user's project visibility (`fUserVisibleProjects`). |

---

## 3. Section 5.1 — "Dashboard Panels" table replaced

| Old | New |
|-----|-----|
| Three panels: **User Info** (username, role, phone), **Account Status** (status, credit balance), **Quick Actions** (system status) | Two tables. **Header Controls**: Live DB / Demo Data, Light / Dark, **Category**, fiscal year buttons, Refresh, Project Repository. **Dashboard Sections**: Summary cards, Total Program Outlays, No. of Infrastructure Projects, Distribution of Budget by Region, Annual Budget & Lump Sum Itemization Trend, Project Stages, Island-Group Allocation, FY Regional Infrastructure Portfolio. |

None of the three old panels exist on the current screen. Within the new tables, these entries record behaviour introduced in this release:

| Item | Documented behaviour | Concern / request |
|------|----------------------|-------------------|
| Category control | **New.** Clicking the box lists every project category; typing any part of a name shortens the list; retired categories are marked Inactive. The choice narrows every section and shows as "Category: \<name\>" with × to clear. Live DB only. | User requests: a Category filter beside the year switcher, and the full list on click |
| Pinned header | **New.** While scrolling, the header stays at the top of the page as one row (Viewing FY, data source, Category, years, Refresh). New step 7 describes it. | User request: keep the filters visible while scrolling |
| No. of Infrastructure Projects | The comparison bars are labelled **Relative Project Count**. | Concern 3 ("Relative Volume Density has a different meaning") |
| Annual Budget & Lump Sum Itemization Trend | A year's bars can be **selected** to switch the Dashboard to that year, like the project-count chart. LS Itemized now shows real per-year amounts in Live DB. | Concern 5 ("The bar is not interactive") |
| FY Regional Infrastructure Portfolio | "The count shown is a number of **projects**." | Concern 7 ("8460 Regions?") |
| (Live Audit Feed) | **Removed.** It is not listed among the sections. | Concern 7 ("What is the Live Audit Feed for?"); removal was the user's decision |

---

## 4. Section 5.1 — New block "What counts toward a fiscal year (Live DB)"

**New:** five rules plus a sentence stating that every section agrees:
- only the fiscal year's own programs;
- only cost scheduled in that year;
- budget stages only (BP, NEP, NEP-E, HGAB, HGAB-I, GAA, GAA-R, TF, TF-R), with RBP, RDIP and PIP planning proposals excluded;
- approved formal revisions counted at the revised amount;
- region and island group taken from the project's Province, and "Unassigned" when there is none.

| Rule | Concern it answers |
|------|--------------------|
| Fiscal year's programs and cost year only | Concern 2 (FY2025 listed 2024 programs at ₱0 / 0%) |
| Budget stages only, RBP/RDIP/PIP excluded | Concern 2 note ("RBPs, RDIP, PIP should not be displayed here"), applied to the whole dashboard by user decision; the stage allow-list was confirmed by the user |
| Approved formal revision at its revised amount | Concern 1 (FY2026 card showed ₱10M for a project revised to ₱30M) |
| Region and island from Province | Concerns 4 and 6 (map and island cards showed Luzon/Visayas at 0% and 92% "Unassigned"). The user specified `tProjectRevisions.Province` → `tOptionAdminAreaProvince.Code` → region. |

---

## 5. Section 5.1 — Step-by-Step

| Old | New |
|-----|-----|
| 4 steps: log in, Dashboard loads, review user/account panels, use the sidebar | 7 steps: log in; select Live DB; select a fiscal year; *(optional)* click in Category and pick one; review sections, switching years from the header, the project-count chart or the Annual Budget bars; select an island-group or stage card to filter the project list, with **Reset Filter** to clear; scroll with the header pinned |

---

## 6. Section 5.1 — On Success and Common Outcomes

| # | Old | New |
|---|-----|-----|
| 1 | On Success: "The Dashboard loads and displays all panels without errors. The sidebar shows only the modules accessible to the logged-in user's role." | "Every section shows the selected fiscal year (and category, if chosen), and their totals agree." |
| 2 | *(no Common Outcomes table)* | **New** table with four rows: no category matches what was typed; a category with no projects that year (₱0); Demo Data selected (Category unavailable); a project with no province (Unassigned / "Not recorded"). |

---

## 7. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| *(uncommitted)* | Dashboard tester concerns: FY scope, region resolution, category filter (plan `dashboard-tester-concerns-fy-scope-category-filter.md`) | Category filter, fiscal-year scoping rule, revised-amount costing, province-based regions, Relative Project Count label, clickable Annual Budget bars, project-count wording, Live Audit Feed removal — Sections 3–6 above |
| `7b04f69f` | feat: implement Lump Sum data summary in Dashboard with real-time integration | Lump Sum (LS) Itemized summary card, now documented in the Sections table |
| `8a1c7a2c` | Unpin dashboard from FY2027 and aggregate per year in SQL | Fiscal year buttons offering multiple years, now documented in Header Controls |
| `5b38fcaf` | Rewire Dashboard.tsx onto the split endpoints and lazy loading | The per-section layout the Sections table describes |

---

# UserManual.md — Changelog v3.10 → v3.11 (FE/UserManual.md)

**Date:** September 10, 2026
**Branch:** dev-trunk (uncommitted manual edits, on top of `0f3d9bda`)
**Source:** User-supplied reference document — `C:\Users\User\Downloads\Deliverable 48 User Manual (Web-based MYPS)_V5_27August2026.docx` (the consultant's own Deliverable #48, Revision 5, dated 27 Aug 2026) — converted via pandoc and diffed section-by-section against `FE/UserManual.md`. Full diff recorded at `documents/UserManual_DocxDiff_V5.md`. Two structural additions (Reports, Lump Sum Projects) were cross-checked against `FE/src/components/Routes.tsx` to confirm both are live, routed modules before writing them up as shipped, rather than trusting the docx wording alone.

---

## 1. Document Header

| Field | v3.10 | v3.11 |
|-------|-------|-------|
| Version | 3.10 | 3.11 |
| Date | August 25, 2026 | September 10, 2026 |

---

## 2. New Section 5.6 — Reports (5.6.1 Report Filters, 5.6.2 Programs Selection Panel)

**New:** The Reports module (`/reports`, `RPT-*` field refs) was entirely undocumented in `FE/UserManual.md` despite being a live sidebar module. Added: Purpose/Who-uses-this/Prerequisites, an Access-by-Role table (RPC: own-region reports; PS Admin: all-region reports), and two subsections — Report Filters (Report Type, Year, Program Stage, Regional Office, Planning Engineer/Approved By/Reviewed By signature fields, Generate Report) and the Programs Selection Panel (search/select/select-all/clear-all, the "Selected: n items" counter, and empty/no-match states) — each with Field Reference, Step-by-Step, and Common Outcomes tables adapted from docx §5.6/§5.6.1/§5.6.2.

> Source: docx §5.6. Verified live via `Routes.tsx` (`{ RouteName: 'Reports', path: '/reports', element: <Reports /> }`) and source commits `01950eb4` (Add AIP and Extract PCMIOW report support to the Reports page, #114), `a12cf443` (Fix region dropdown & major SQL deduplication in reports), `0f65fe51` (Refactor report UI for multiple families & validation), `80b39f3d` (Add ExtractPcmiowFields component for PCMIOW report filtering, merged via PR #180).

---

## 3. New Section 5.10 — Lump Sum Projects (5.10.1–5.10.8)

**New:** The Lump Sum Projects module (`/lumpsum`, `LS-*` field refs) was entirely undocumented in `FE/UserManual.md`. Note: an unrelated, separate in-app help doc at `FE/src/pages/LSWallet/UserManual.md` still opens with a "demo and preview feature... not connected to real DPWH records" disclaimer — per user decision, the manual documents Lump Sum Projects as a shipped, production workflow (matching the docx and the live `/lumpsum` routes), not as a preview feature. Added the full 8-subsection workflow: Finding a Lump Sum Project, Add Lump Sum Project, Lump Sum Overview (Financial Position: Original Allocation / Itemized / Remaining / Allocation Utilization), Import Itemized Projects (template download, 4-sheet workbook, Balance Check, Errors tab), Viewing an Itemized Project, Deleting a Lump Sum Project, Deleting an Itemized Project, and Editing a Lump Sum Project — each with Field Reference and Step-by-Step tables adapted from docx §5.10–§5.10.8. Two docx source paragraphs (§5.10.6/§5.10.7 on deletion) were grammatically malformed in the source and were rewritten for clarity rather than copied verbatim; the underlying meaning (deletion may be blocked, allowed, or retained-for-audit depending on record history) was preserved.

> Source: docx §5.10. Verified live via `Routes.tsx` (`LumpSumList` / `AddWallet` / `LumpSumDetails` routes under `/lumpsum`) and source commits `9777dc39` (Implement normalized LS Wallet schema with header, revision, funding, and component tables), `8a0cf355` (refactor(wallet): program selection logic to self-fetch program list in add mode), `8bab21ee` (refactor: WalletDetailsSection/ProjectDetailsForm enum consistency).

---

## 4. Section renumbering: former 5.6–5.8 → 5.7–5.9

**Mechanical renumbering**, not a content change: inserting Reports as the new §5.6 pushed Code Tables (5.6 → **5.7**, subsections 5.6.1–5.6.7 → 5.7.1–5.7.7), User Management (5.7 → **5.8**, subsections 5.7.1–5.7.3 → 5.8.1–5.8.3), and Infra Management (5.8 → **5.9**, subsections 5.8.1–5.8.4 → 5.9.1–5.9.4) down by one; Lump Sum Projects was appended as the new §5.10. Table of Contents and the Section 4.1 module map's "Section 5 Ref" column were updated to match. Verified no other in-body cross-references to "Section 5.6/5.7/5.8" existed outside this renumbered range and the (untouched, historical) Revision History table.

---

## 5. Section 4.1 — Module & Feature Discovery table and stale "commented-out" note

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | Table listed 8 modules, ending at row 8 (Infra Management, ref 5.8) | Added row 6 (Reports, `/reports`, ref 5.6) and row 10 (Lump Sum Projects, `/lumpsum`, ref 5.10); existing rows renumbered #6–8 → #7–9 | Reports and Lump Sum are live routes in `Routes.tsx`, not placeholders |
| 2 | "Commented-out sidebar items (Lump Sum, Multi-Year Management, Reports) are not accessible to users and are not documented in Section 5." | "Multi-Year Management remains commented out in the sidebar and is not accessible to users; it is not documented in Section 5." | Only Multi-Year Management is still inactive; the other two claims were stale |

> Source: `Routes.tsx` inspection (see §2/§3 above).

---

## 6. Section 9 — Notes & Limitations, stale "Inactive modules" bullet

| Old | New |
|-----|-----|
| "**Inactive modules:** Lump Sum, Multi-Year Management, and Reports are currently disabled in the sidebar and are not accessible to users." | "**Inactive modules:** Multi-Year Management is currently disabled in the sidebar and is not accessible to users. Reports (Section 5.6) and Lump Sum Projects (Section 5.10) are live modules." |

---

## 7. User-group terminology standardized: DEO / RO / AUC → DPC / RPC / PS Admin

**Systemic rename**, not confined to one section. The docx V5 has fully standardized on **DPC** (District Planning Coordinator), **RPC** (Regional Planning Coordinator), and **PS Admin**, retiring **DEO**/**RO**/**AUC** as role names. `FE/UserManual.md` was mid-migration and inconsistent (mostly DEO/RO, with a few stray DPC/RPC/AUC mentions already present around Section 5.4). Checked the codebase first: role names are RBAC config/data, not hardcoded in `FE/src` (the only hardcoded "DEO" is the unrelated District Engineering Office admin-area concept in `DEOTable.tsx`), so nothing in code contradicts adopting the docx's terminology.

| # | Old | New | Where |
|---|-----|-----|-------|
| 1 | `**Who uses this:** DEO, RO, PS Admin` (~30 occurrences) | `**Who uses this:** DPC, RPC, PS Admin` | Throughout Sections 3–5.9 |
| 2 | `PS Admin (Allow/Restrict Publishing); DEO, RO, PS Admin (Batch Delete)` | `...; DPC, RPC, PS Admin (Batch Delete)` | 5.2.6 |
| 3 | `DEO (submit), RO (first-level review), PS Admin (final approval)` | `DPC (submit), RPC (first-level review), PS Admin (final approval)` | 5.4 intro |
| 4 | `**Who uses this:** DEO, RO` | `**Who uses this:** DPC, RPC` | 5.4.8 |
| 5 | Section title "5.4.9 RO Approval Actions"; purpose "submitted by DEO users... approve..."; sub-heading "**Approve:**"; step "Proceed with **Approval**."; success text "approved and forwarded..." | Retitled "**5.4.9 RPC Endorsement Actions**"; "submitted by DPC users... endorse..."; "**Endorse:**"; "Proceed with **Endorsement**."; "The revision is endorsed and forwarded..." | 5.4.9 — action renamed Approve→Endorse to match the pre-existing Terminology note in 5.4.1 ("RPC's review is called an *Endorsement*, not an *Approval*"), which the section body had never actually been updated to match |
| 6 | "...forwarded from the RO." | "...forwarded from the RPC." | 5.4.10 purpose |
| 7 | `SR-F05` \| "...required for DPC, RPC, and AUC user groups" | "...required for DPC, RPC, and PS Admin user groups" | 5.4.7 field reference |
| 8 | Step 6: "(DPC, RPC, AUC)" | "(DPC, RPC, PS Admin)" | 5.4.7 step-by-step |
| 9 | Routing table: "DPC / DEO → RO (Region Office)", "RPC / RO → CO / PS Admin", "AUC / PS Admin / CO → Automatically approved" | Replaced with docx's cleaner routing table: DPC → endorsed by RPC then approved by PS Admin; RPC → approved by PS Admin; PS Admin → automatically approved | 5.4.7 On Success |
| 10 | "(applies to DPC, RPC, AUC roles)" | "(applies to DPC, RPC, PS Admin roles)" | 5.4.7 Common Outcomes |
| 11 | `* **DEO** — District Engineering Office users: project encoding and revision submission` / `* **RO** — Regional Office users: revision review and approval` | `* **DPC** — District Planning Coordinator: ...` / `* **RPC** — Regional Planning Coordinator: region-level management of projects and programs, revision review and endorsement` | Section 1, "Who It Is For" |
| 12 | "Review and Approve a Revision (RO Level)" / "Find the revision request submitted by a DEO." / "Select **Approve**, **Reject**, or **For Correction**." | "Review and Endorse a Revision (RPC Level)" / "...submitted by a DPC." / "Select **Endorse**, **Reject**, or **For Correction**." | Workflow 4 |
| 13 | "Find the revision request forwarded from the RO." | "...forwarded from the RPC." | Workflow 5 |
| 14 | *(not present)* | **New:** "Status Tracking: RPCStatus / PSStatus" subsection after Workflow 5 — a 7-row status-pair reference table (0/0 = Pending RPC Endorsement, through 1/1 = Approved, 2/any and 1/2 = terminal rejections) | New, adapted from docx §6.3 |
| 15 | Appendix C: only `DEO` and `PS Admin` rows | Added `DPC` and `RPC` rows; reworded the `DEO` row to clarify it is now an admin-area term only, not a user-group term | Appendix C |

**Left unchanged (confirmed as legitimate "District Engineering Office" org-unit usages, not the role):** Admin Areas Code Table sub-tab lists, the Project Details / Add Project / Revision Rules field lists, Road Section "Engineering District" fields and filters, the Import Dialog's AAMS/IOMS description, and the two historical Revision-History rows (3.2, 3.5) describing past work — these were deliberately left untouched since they describe DEO-the-org-unit or are a historical record of what was true at the time they were written.

> Note: this rename does **not** touch the underlying `RPCStatus`/`PSStatus` API field names (see docx §6.3) — those are unaffected by the role-label rename. (The docx itself contained a stray, chat-response-like sentence at this point — "Note that the underlying field names remain RPCStatus and PSStatus — I've left those as-is... say the word and I'll adjust them throughout" — which was not carried into the manual; flagged to the user as likely leftover content from whoever produced the docx.)

---

## 8. Section 5.3.6 Component Targets — retained, not removed

**No change to manual content.** Flagged only: docx V5 (dated 27 Aug 2026) omits Section 5.3.6 Component Targets, which `FE/UserManual.md` has carried since v3.9 (23 Aug 2026, updated in v3.10). Since the feature is live and predates the docx's own date, this reads as an omission on the docx author's side rather than an intentional removal — the manual keeps the section as-is. Recommend flagging to whoever produces the next docx revision.

---

## 9. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| `01950eb4` | Add AIP and Extract PCMIOW report support to the Reports page (#114) | Confirms Reports module existence — Section 5.6 |
| `a12cf443` | Fix region dropdown & major SQL deduplication in reports | Section 5.6.1 Regional Office filter behavior |
| `0f65fe51` | Refactor report UI for multiple families & validation | Section 5.6.1 field behavior |
| `80b39f3d` | Add ExtractPcmiowFields component for PCMIOW report filtering (PR #180) | Confirms Reports module is current/live as of this branch |
| `9777dc39` | feat: Implement normalized LS Wallet schema with header, revision, funding, and component tables | Confirms Lump Sum Projects module existence — Section 5.10 |
| `8a0cf355` | feat(wallet): refactor program selection logic to self-fetch program list in add mode | Section 5.10.2 Add Lump Sum Project |
| `8bab21ee` | refactor: update projectEnums to use 'Code' instead of 'GdbId'... in WalletDetailsSection and ProjectDetailsForm | Section 5.10.3 Lump Sum Overview field naming |

---

# UserManual.md — Changelog v3.8 → v3.10 (FE/UserManual.md)

**Date:** August 24, 2026
**Branch:** merging-branch-import-to-revision (commits up to `96a4f9e5`, plus uncommitted manual edits)
**Source:** User request — "update our user manual base on the big changes we have here" (scope: entire application), following the `report-importing` → `merging-branch-import-to-revision` merge

> **Target file note:** This entry covers `FE/UserManual.md` — the file `generate-user-manual`,
> `update-user-manual`, and this skill's own instructions name as canonical. All prior entries in
> this changelog (below) tracked `documents/UserManual.md` instead, which had independently
> reached **v3.9** (June 14, 2026) while `FE/UserManual.md` was still at v3.8. To avoid two
> different manuals both claiming "v3.9," this update bumps `FE/UserManual.md` straight to
> **v3.10** and adds a placeholder v3.9 row to its Revision History table pointing back to this
> note, rather than silently reusing "3.9" for unrelated content. **The two files remain
> unreconciled** — `documents/UserManual.md` v3.9 and `FE/UserManual.md` v3.10 now have diverging
> content and neither has been merged into the other. Flagged for the user to decide which file
> should be treated as canonical going forward.

---

## 1. Document Header

| Field | v3.8 | v3.10 |
|-------|------|-------|
| Version | 3.8 | 3.10 |
| Date | June 10, 2026 | August 24, 2026 |

---

## 2. Section 5.2.7 — Import Projects (fully rewritten) + new Update Projects action

**Old:** A 3-line stub — "Open a program → Actions → Import Projects → select the Excel template file" — with a single "On Success" line, no Field Reference, no Common Outcomes.

**New:** Rewritten to describe the current asynchronous, job-based flow:
- Added a Field Reference table for the drag-and-drop upload dialog (`.xlsx`/`.xlsm` only).
- Documented that the dialog uploads and closes immediately, and the import runs as a Hangfire background job.
- Documented the queued-confirmation toast and the three possible completion toasts (success / completed-with-issues / failed), including the **View Report** (text summary) and **View Errors** (Excel workbook of failed rows) action links shown on a completed-with-issues result.
- Added a Common Outcomes table covering the wrong-file-extension message and the single-import-at-a-time lock message (*"Import is currently in use by &lt;user&gt;. Please try again later."*).
- **New subsection added:** "Update Projects" — a second Actions-menu entry that replaces (rather than adds to) the existing project set for the program's current stage from a file, with its own warning banner and step-by-step. Also added to the Actions row of the 5.2.3 "Available Actions" table.

> Source commits: `5732ef88` (Implement async job-based import for projects), `00e347dc` (Refactor project import flow to multipart/form-data direct upload), `b9dbed0f` (Refactor import job handling with SignalR notifications and toast actions), `d292afab` (Add update project functionality and enhance import dialog), `2517c76b` (Importing Project: Update projects thru importing), `554d39d0` (Remove programId from ExportConfirmDialog/ActionsDropdown). Also read directly from `FE/src/pages/Program/dialogs/ImportProjectsJobDialog.tsx`, `FE/src/components/ImportJobNotifier.tsx`, `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx`, and `WebAPI/Controllers/Importing/ImportingController.cs` (lock message, `TextFileUrl`/`ExcelFileUrl` semantics) to verify exact toast/error text. See also `documents/plans/program-import-job-dialog.md` and `documents/plans/merge-report-importing-into-revision.md`.

---

## 3. Section 5.2.1 — Filter Programs Dialog ("Program Group" → "Program Type") and Active Filters chips

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | Toolbar row: "Opens the Filter Programs dialog for Year Start, **Program Group**, and Program Stage filters" | "...for Start Year, **Program Type**, and Program Stage filters" | The filter dialog's second field was renamed from a program-group filter to a program-type filter in code |
| 2 | `UI-UX-004-F03` \| Program Group \| "Filter by the program group the program belongs to" \| Dropdown: All Groups | `UI-UX-004-F03` \| Program Type \| "Filter by the program's type classification" \| Dropdown: All Types | Same — field renamed `GroupName`/`Group` → `Type` in `ProgramFilter`, dropdown now lists Program Types, not Groups |
| 3 | `UI-UX-004-A05` \| Apply | `UI-UX-004-A05` \| **Apply Filters** | Button label in code is "Apply Filters," not "Apply" |
| 4 | Step-by-step: "Click **Apply** to refresh the list..." | "Click **Apply Filters** to refresh the list..." | Matches corrected button label |
| 5 | *(not documented)* | **New:** an "Active Filters" chip panel appears in the dialog once any filter is set, listing each active value (Start Year / Type / Stage) as a chip | New UI element added to the dialog |

> Source commits: `a67dfdf2` (add filter dialog for program list), `2a7eadaf` (enhance program management with new dialogs and batch tagging), `9b839dd0` (refactor code structure), `4a027116` (implement shared pagination hook and update Program list), `dce1723d` (enhance pagination and filtering in Program and Project components). Verified against current `FE/src/pages/Program/dialogs/FilterDialogProgramList.tsx`.

---

## 4. Section 5.8.4 — Import Dialog (Infra Management) fully rewritten

**Old:** A 3-group / 6-item checkbox tree with tri-state group checkboxes — "Import Road Network Data from RBIA" (Roads, Road Section, Bridges — active; Region — pending), "Import Lookup tables from Admin Areas" (City/Municipality, Legislative District — pending), "Import Lookup tables from Internal Org" (DEO, Implementing Office — pending). Included an "Import Status Summary" table and a Common Outcomes row explaining the pending items produce no data.

**New:** Replaced with the current flat, 2-option list, both fully connected (no more pending items):
- "Import Infrastructure Inventory from RBIA" — now imports Roads, Road Sections, Bridges, **and** Region in one combined GIS call.
- "Import Admin Areas from AAMS and Internal Org Units from IOMS" — now imports City/Municipality, Legislative District, DEO, and Implementing Office in one combined call.

The "Start Import" button was also renamed to "Import" (still shows "Importing..." while running). The "Import Status Summary" table and the now-inapplicable "pending items" Common Outcomes row were removed, since there are no longer any inactive items in the dialog.

> Source commits: `3cdbb032` (update API endpoints for future road/bridge operations, enhance import dialog), `81fa1606` (add `importAdminOrgLookups`, PUT requests for road/bridge imports), `a7f20373` (consolidate infrastructure imports into a single endpoint), `eec85968` (use `UserId` instead of `UserName`), `4d90d5ba` (simplify ImportDialog by removing unused import types and groups). Verified against current `FE/src/pages/Rbia/Dialogs/ImportDialog.tsx` and `FE/src/pages/Rbia/Service.ts` (`importAllInfrastructure`, `importAdminOrgLookups` — both now hit live `gisClient.put` endpoints).

---

## 5. Revision History Table (FE/UserManual.md)

**New rows added:**
- v3.9 — placeholder row noting the version-number collision with `documents/UserManual.md` (see target-file note above); not applicable to this file's content.
- v3.10 — one-line summary of all changes in sections 2–4 above.

---

## 6. Scope note — other frontend changes reviewed but not documented

As part of this global-scope pass, the following areas were also reviewed against `FE/UserManual.md`'s existing content and found to require **no manual change**:

- **Pagination refactor** (`usePagination` hook, `PaginationBar` component) across Program, Project, and Modification list/picker views — internal keyset-pagination rework; same on-screen controls and behavior the manual already describes (e.g. Section 5.3.5's "Page Size" field for the Select Infrastructure dialog was already accurate).
- **AddInfraDialog** (Project module) — internal refactor to the shared pagination hook; no new fields or controls beyond what Section 5.3.5 already documents.
- **AddProgramDialog** Trust-Fund auto-stage logic — internal `NameId` values changed (11→12 for TF, plus a new non-selectable TF-R stage), but the user-visible behavior (Type = TF auto-locks Stage and computes the name) is unchanged from what Section 5.2.2 already documents.
- Not reviewed in this pass (deferred — large, mostly backend/internal-refactor diffs not obviously user-facing): Modification/Revision list internals, Project form components (`ProjectForm.tsx`, `ProjectDetailsForm.tsx`, `ProgramDetailsForm.tsx`, `ComponentCostDialog.tsx`, `MajorItemOfWorksForm.tsx`), and the Excel-import flow added for LS Wallet (`bd2aba99`), which is not yet covered by any existing manual section.

---

## 7. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| `5732ef88` | feat: Implement async job-based import for projects | Section 2 |
| `00e347dc` | feat: Refactor project import flow to use multipart/form-data | Section 2 |
| `b9dbed0f` | feat: Refactor import job handling with SignalR notifications and toast actions | Section 2 |
| `d292afab` | Add update project functionality and enhance import dialog | Section 2 |
| `2517c76b` | Importing Project: Update projects thru importing | Section 2 |
| `554d39d0` | refactor: Remove programId from ExportConfirmDialog and ActionsDropdown components | Section 2 |
| `a67dfdf2` | feat: add filter dialog for program list and update program pagination handling | Section 3 |
| `2a7eadaf` | feat: enhance program management with new dialogs and batch tagging functionality | Section 3 |
| `9b839dd0` | Refactor code structure for improved readability and maintainability | Section 3 |
| `4a027116` | feat: implement shared pagination hook and update Program list | Section 3 |
| `dce1723d` | feat: enhance pagination and filtering in Program and Project components | Section 3 |
| `3cdbb032` | refactor: update API endpoints for future road and bridge operations, enhance import dialog functionality | Section 4 |
| `81fa1606` | Add importAdminOrgLookups function and update import methods to use PUT requests | Section 4 |
| `a7f20373` | Refactor import functions to consolidate infrastructure imports into a single endpoint | Section 4 |
| `eec85968` | Update user identification in handleImport function to use UserId instead of UserName | Section 4 |
| `4d90d5ba` | refactor: Simplify ImportDialog by removing unused import types and groups | Section 4 |

---

# UserManual.md — Changelog v3.8 → v3.9 (documents/UserManual.md)

**Date:** June 14, 2026
**Branch:** main (uncommitted)
**Source:** User-requested authoring rules change (Field Reference numbering convention + native `<select required>` validation message accuracy)

> **Note on canonical file:** `documents/UserManual.md` had drifted out of sync with
> `FE/UserManual.md` (stuck at v3.7 while `FE/UserManual.md` had already been updated to v3.8 —
> see the "v3.7 → v3.8" entry below, which described changes applied to `FE/UserManual.md` only).
> As of this entry, `documents/UserManual.md` is the **canonical** manual going forward: it has
> been re-synced from `FE/UserManual.md` v3.8 (bringing in those v3.8 changes), and this entry's
> v3.9 changes are layered on top of that synced content.
>
> **2026-08-24 update:** This "canonical going forward" claim was not followed through —
> `FE/UserManual.md` continued to be the file actively maintained by the `generate-user-manual`
> and `update-user-manual` skills, and has since been updated independently to v3.10 (see the
> entry above). The two files are unreconciled as of this changelog entry.

---

## 1. Document Header

| Field | v3.8 | v3.9 |
|-------|------|------|
| Version | 3.8 | 3.9 |
| Date | June 10, 2026 | June 14, 2026 |

---

## 2. Sync `documents/UserManual.md` from `FE/UserManual.md` (v3.8)

**Changed:** `documents/UserManual.md` (previously stuck at v3.7) was replaced with the content of
`FE/UserManual.md` v3.8, bringing in: Section 3.1 "Username is required" / "Password is required"
validation messages; Section 5.3.5 Auto-generated ID Prefix reference table (16 infrastructure
types, e.g. Local Roads `LRD00001`); Section 5.4.6 "Mode of Implementation — New Project Record"
behavior (`-A` suffixed project record); Section 5.5.3 project group map mention.

> Source: `FE/UserManual.md` v3.8 (see "v3.7 → v3.8" entry below for full detail).

---

## 3. New file — `documents/UserManual_Rules.md`

**New file added** defining two standing authoring rules for `UserManual.md`:

1. Field/Action Reference tables use plain sequential numbering (`1, 2, 3...`, restarting per
   table) instead of prefixed IDs (`UI-UX-XXX-Fnn/Ann`, `MIOW-`, `CC-`, `AIP-`, `BR-`, etc.).
2. Validation messages for native `<select required>` dropdowns (in forms without `noValidate`)
   must be documented as the browser's actual *"Please select an item in the list."* tooltip, not
   the dead-code JS `alert`/`showToast` message.

> Source: user request — "remove the UI-UX-XXX and use normal numbering" + "dialogs that use
> required in native html ... use the 'Please select an item in the list.'" message.

---

## 4. Field Reference ID renumbering (all sections)

**Changed:** All 222 `UI-UX-XXX-Fnn/Ann` IDs and 107 other prefixed IDs (`MIOW-`, `CC-`, `AIP-`,
`BR-`, `CMI-`, `EXC-`, `FP-`, `NI-`, `PG-`, `RD-`, `REV-`, `RL-`, `SD-`, `SR-`, `TRM-`, `WL-`,
`WL-DLG-`) across 56 Field/Action Reference tables were replaced with plain sequential numbering
(`1, 2, 3...`), restarting at `1` for each table. No row content, ordering, or table structure
changed — only the leftmost `Field Ref No.` column values.

> Source: editorial — applies new Rule 1 from `documents/UserManual_Rules.md`.

---

## 5. Section 5.3.5 — Add Project Major Item of Works (Common Outcomes)

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | `"Please select a component"` | `"Please select an item in the list."` (with note: "Browser-native validation tooltip on the required dropdown.") | Component is a native `<select required>` in a form without `noValidate` — the browser tooltip fires before the `alert('Please select a component')` in `AddMajorItemDialog.tsx` can run |
| 2 | `"Please select an infrastructure type"` | `"Please select an item in the list."` (same note) | Same — Infrastructure Type select |
| 3 | `"Please select a type of work"` | `"Please select an item in the list."` (same note) | Same — Type of Work select |

> Source: `FE/src/pages/Project/dialogs/AddMajorItemDialog.tsx:203-281` (also mirrored in
> `FE/src/pages/Modification/dialogs/AddMajorItemDialog.tsx:220-300`) — applies new Rule 2.

---

## 6. Section 5.8.1 — Add New Future Road (Common Outcomes)

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | `"Please fill in all required fields"` (covering Road ID, Road Name, or Classification) | Split into two rows: `"Please fill in all required fields"` (Road ID / Road Name only) + new row `"Please select an item in the list."` (Classification) | Classification is a native `<select required>`; its empty-submit message is the browser tooltip, distinct from the Road ID/Road Name text-input message |

> Source: `FE/src/pages/Rbia/Dialogs/FutureRoadDialog.tsx` — applies new Rule 2.

---

## 7. Section 5.4.2 — Revise Project (Common Outcomes)

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | `"Please select a category."` | `"Please select an item in the list."` (with note) | Category is a native `<select required>` — `showToast('Please select a category.')` in `RevisionDialog.tsx` is dead code |
| 2 | `"Please select a reason."` | `"Please select an item in the list."` (same note) | Same — Reason select |

> Source: `FE/src/pages/Project/dialogs/RevisionDialog.tsx:219-252` — applies new Rule 2.

---

## 8. Revision History Table (documents/UserManual.md)

**New row added** for v3.9 summarizing the sync from `FE/UserManual.md` v3.8 plus all changes above.

---

## 9. Section 5.3.3 — Component Cost (Component ID examples)

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | Purpose text: "...generate Component IDs (e.g., `DR1`, `ROW`, `FS`)..." | "...generate Component IDs (e.g., `CW1`, `ROW`, `FS`)..." | `DR1` is not a generated Component ID — Civil Works entries auto-generate `CW1`, `CW2`, etc. |
| 2 | Component Cost table, "Component ID" row: "Auto-generated identifier... (e.g., `DR1`, `ROW`)" | "...(e.g., `CW1`, `EAO`)" | Same correction; `EAO` added as a second real example (a fixed component type code) |
| 3 | "Auto-generated Component IDs" table: "Civil Works (first entry) → `DR1`, increments to `DR2`, `DR3`..." | "Civil Works (first entry) → `CW1`, increments to `CW2`, `CW3`..." | Matches the actual increment logic in code |
| 4 | Section 5.4 Major Items of Work table, "Component" row: "Component ID the major item is linked to (e.g., `DR1`)" | "...(e.g., `CW1`)" | Same correction for consistency |

> Source: `FE/src/pages/Project/dialogs/ComponentCostDialog.tsx:243-350` (Civil Works `CW1`/`CW2`... increment logic) and `FE/src/pages/Project/dialogs/AddMajorItemDialog.tsx:161-162` (`EAO` as a fixed component type code) — editorial correction, no version bump (still v3.9).
