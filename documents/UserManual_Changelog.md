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
