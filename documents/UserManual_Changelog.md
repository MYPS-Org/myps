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
