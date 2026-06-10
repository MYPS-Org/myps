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
