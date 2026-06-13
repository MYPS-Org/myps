# UserManual.md — Changelog v3.8 → v3.9

**Date:** June 14, 2026
**Branch:** main (uncommitted)
**Source:** User-requested authoring rules change (Field Reference numbering convention + native `<select required>` validation message accuracy)

> **Note on canonical file:** `documents/UserManual.md` had drifted out of sync with
> `FE/UserManual.md` (stuck at v3.7 while `FE/UserManual.md` had already been updated to v3.8 —
> see the "v3.7 → v3.8" entry below, which described changes applied to `FE/UserManual.md` only).
> As of this entry, `documents/UserManual.md` is the **canonical** manual going forward: it has
> been re-synced from `FE/UserManual.md` v3.8 (bringing in those v3.8 changes), and this entry's
> v3.9 changes are layered on top of that synced content.

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
| 2 | `"Please select a reason."` | `"Please select an item in the list."` (with note) | Same — Reason select |

> Source: `FE/src/pages/Project/dialogs/RevisionDialog.tsx:219-252` — applies new Rule 2.

---

## 8. Revision History Table (documents/UserManual.md)

**New row added** for v3.9 summarizing the sync from `FE/UserManual.md` v3.8 plus all changes above.

---

## 9. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| *(uncommitted)* | — | All changes above are uncommitted working-tree edits to `documents/UserManual.md`, `documents/UserManual_Rules.md`, and the `.claude/skills/{generate-user-manual,update-user-manual,gap-analysis}/SKILL.md` files |

---

# UserManual.md — Changelog v3.7 → v3.8

**Date:** June 10, 2026
**Branch:** claude-skill (commit `5e9a098`)
**Source:** Gap analysis follow-up — see `documents/MYPS_Gap_Analysis_Report.md`

---

## 1. Document Header

| Field | v3.7 | v3.8 |
|-------|------|------|
| Version | 3.7 | 3.8 |
| Date | June 8, 2026 | June 10, 2026 |

---

## 2. Section 3.1 — Login Common Outcomes & Appendix B

**New rows added:**

| Area | Message | Trigger | How to Fix |
|------|---------|---------|------------|
| Section 3.1 / Appendix B | `"Username is required"` | Sign In clicked with USERNAME field empty | Enter your username before clicking Sign In |
| Section 3.1 / Appendix B | `"Password is required"` | Sign In clicked with PASSWORD field empty | Enter your password before clicking Sign In |

> Source: `FE/src/pages/login/Page.tsx:75,101` — gap analysis finding "Login — Empty Field Validation" (MEDIUM)

---

## 3. Section 5.3.5 — Work Locations (Infrastructure ID Prefixes)

| # | Old | New | Reason |
|---|-----|-----|--------|
| 1 | InfraId logic table, "All other types" example: `e.g., LR-00001` with parenthetical `(Local Road LR, Local Bridge LB, LFCS, LWW, etc.)` | Example updated to `e.g., LRD00001`; parenthetical simplified to `(Local Road, Local Bridge, etc.)` | Corrected to match actual generated format |
| 2 | Step-by-step "Adding a Work Location for Local / Other Infrastructure Types": `(e.g., LR-00001)` | `(e.g., LRD00001)` with reference to new prefix table | Same correction, consistency |

**New subsection added:** "Auto-generated ID Prefixes by Infrastructure Type" — a 14-row reference table covering all auto-generated infrastructure types (Accessibility Facility, Consultancy, Flood Control Structures, Hospitals, Local Bridges, Local Roads, Local Flood Control Structures, Multi-Purpose Buildings, Non-Infra, Other Buildings, Rain Water Collector, School Buildings, Septage & Sewerage Plants, Water Supply Systems).

> Source: `FE/src/utils/infraIdGenerator.ts:29-91` (`prefixMappings`) — gap analysis finding "Work Location Infrastructure ID Prefixes" (LOW)

---

## 4. Section 5.4.6 — Specific Revision Type Behaviors

**New subsections added** (after "Excess Component Warning", before "Copy Major Item of Work"):

| Subsection | Description |
|------------|--------------|
| "Mode of Implementation — New Project Record" | Documents that submitting a Mode of Implementation revision creates a **new project record** with the original Project ID plus an `-A` suffix (e.g., `P01234567` → `P01234567-A`); includes a Step-by-Step and "On Success" note |
| "Other Revision Types (Additional Funding, Adjustment, Change in Authority to Implement, Change in Funding, Change of Creditor, Expired Funding, For Savings — Partial Unutilized Balance, Multi-Year Costing Changes)" | Brief note that these 8 types have no special dialogs/behaviors and rely on the standard Field Editability Rules (Section 5.4.5) |

> Source: `WebAPI/Controllers/Revision/RevisionController.cs:790,1359` (`RevisionGroupId == 13` → `{ProjectId}-A`) — gap analysis finding "Revision Type Field Editability (9 of 12 types)" (MEDIUM). Per the `update-user-manual` Core Principle, the other 8 types were not itemized individually since their behavior is fully covered by the existing generic Section 5.4.5 rules (server-driven, not special-cased in code).

---

## 5. Section 5.5.3 — Project Group Details

**New line added:** "**Map:** A map showing the general geographic location of the projects in the group is displayed alongside the group fields."

> Source: ATP S05-TC002 — gap analysis finding "Project Group Details — Map Section" (LOW)

---

## 6. Revision History Table (FE/UserManual.md)

**New row added** for v3.8 summarizing all changes above.

---

## Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| `5e9a098` | Add User Manual Changelog for version 3.7 | Working-tree commit that also carries the v3.7 → v3.8 edits described above (made directly to `FE/UserManual.md`, not yet a separate commit) |

---

# UserManual.md — Changelog v3.6 → v3.7

**Date:** June 8, 2026
**Branch:** main (commits up to `d692dc9`)

---

## 1. Document Header

| Field | v3.6 | v3.7 |
|-------|------|------|
| Version | 3.6 | 3.7 |
| Date | June 2, 2026 | June 8, 2026 |

---

## 2. Section 3.1 — Login Common Outcomes

| # | Old Message | New Message | Reason |
|---|-------------|-------------|--------|
| 1 | `"Invalid username or password."` | `"Invalid credentials. Please check your user ID and password and try again."` | Backend response updated in `AuthenticationController.cs` (`LoginLog.IsValid = false` path) |
| 2 | `"Unauthorized."` | `"Your session has expired. Please sign in to continue."` | Backend now returns a descriptive session-expired message from `CoreController.cs` and the inactive-account path in `AuthenticationController.cs` |

---

## 3. Section 5.2.2 — Add Program

### 3a. Field Reference table

| Field Ref No. | Change |
|---------------|--------|
| UI-UX-005-F04 | Label updated: `Program Type` → `Program Type *` (required marker added) |
| UI-UX-005-F05 | Label updated: `Program Stage` → `Program Stage *` (required marker added) |

### 3b. Common Outcomes — new rows added

| Message | Trigger | Source commit |
|---------|---------|---------------|
| `"Program Type is required."` | Submit clicked with Program Type blank | `4877303` |
| `"Program Stage is required."` | Submit clicked with Program Stage blank (Type ≠ TF) | `4877303` |

---

## 4. Section 5.7.2 — Users

### 4a. Users List — Field Reference

| Field Ref No. | Column | Change |
|---------------|--------|--------|
| UI-UX-0116-F04 | OFFICE | Description updated from `"Plantilla office of the user"` → `"Full name of the plantilla office of the user (PlantillaOfficeName)"` — the column now renders `PlantillaOfficeName` (full name) instead of `PlantillaOffice` (code) |

> Source commit: `ce6d826` — `UsersTab.tsx` changed `user.PlantillaOffice` → `user.PlantillaOfficeName`

### 4b. Add New User Dialog — Field Reference

| Field Ref No. | Field | Change |
|---------------|-------|--------|
| UI-UX-0117-F02 | USER ID | Description updated: field is now always disabled (not just read-only after PIS lookup) |
| UI-UX-0117-F04 | REGION CODE → **REGION** | Label renamed; description changed from "Regional office code" to "Regional office name — always read-only (disabled)" |

> Source commits: `d619e6e` (disabled User ID and Region Code), `d386064` (renamed field label, switched from `regCode` to `regName`)

### 4c. Step-by-Step: Adding a User

| Step | Change |
|------|--------|
| Step 3 | "Region Code" → "Region" in the list of PIS auto-filled fields |

---

## 5. Appendix B — Consolidated Validation Messages

### 5a. Updated rows

| Area | Old | New |
|------|-----|-----|
| Login | `Invalid username or password` | `Invalid credentials. Please check your user ID and password and try again.` |
| Login | `Unauthorized` | `Your session has expired. Please sign in to continue.` |

### 5b. New rows added

| Area | Message |
|------|---------|
| Add Program | `Program Type is required.` |
| Add Program | `Program Stage is required.` |

---

## Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| `9438642` | Update user authentication message | Login error messages (Section 3.1, Appendix B) |
| `4877303` | Add validation for Program Type and Stage in AddProgramDialog | Section 5.2.2 field reference + Common Outcomes |
| `d619e6e` | Add disable for userid and region code | Section 5.7.2 Add User dialog field reference |
| `d386064` | Update region code to region name | Section 5.7.2 field label + step-by-step |
| `7c90eb6` | Fix issues in showing region code instead of plantilla office | Related to `d386064` |
| `ce6d826` | Update UsersTab to use PlantillaOfficeName | Section 5.7.2 Users list OFFICE column |
| `eedddd4` | Enhance UsersTab for improved user data display | UI-only truncation/tooltip changes — no manual text change needed |
| `d692dc9` | Fix getting cut off | CSS line-height fix — no manual text change needed |
| `13342bd` | Error handling in add existing project | Backend-only fix — existing Section 5.2.5 error messages already accurate |
| `feb1572` | Added required sub name | Frontend `required` attribute — already documented in Section 5.2.2 |
