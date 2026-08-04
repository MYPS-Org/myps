# UserManual.md — Authoring Rules

These rules govern how `documents/UserManual.md` is written and updated. They apply to the
[generate-user-manual](../.claude/skills/generate-user-manual/SKILL.md),
[update-user-manual](../.claude/skills/update-user-manual/SKILL.md), and
[gap-analysis](../.claude/skills/gap-analysis/SKILL.md) skills.

---

## 1. Field/Action Reference numbering

**Rule:** Every "Field Reference" / "Field/Action Reference" table uses plain sequential numbering
(`1`, `2`, `3`, ...) in the `Field Ref No.` column, restarting at `1` for each new table.

**Do not use** prefixed ID schemes such as `UI-UX-001-F01`, `MIOW-F02`, `CC-A03`, `AIP-F01`, etc.
These prefixes are internal QA/ATP artifacts and are not meaningful to end users reading the
manual.

When adding a new Field Reference table, number its rows `1, 2, 3, ...` in order regardless of
whether the row describes a field, an action/button, a group, or an item. When inserting a new
row into an existing table, renumber the whole table sequentially so the numbering stays
contiguous.

---

## 2. Validation messages for native `<select required>` dropdowns

**Rule:** If a dropdown field is implemented as a plain HTML `<select required>` inside a
`<form>` that does **not** set `noValidate`, the browser's native validation tooltip fires
**before** any `onSubmit`/JS validation runs. In Chrome/Edge this tooltip reads:

> Please select an item in the list.

Any custom JS message (`alert(...)`, `showToast(...)`, or inline error text) written for that
same field is dead code — the user will never see it, because the native tooltip blocks form
submission first.

**How to apply when writing/updating the manual:**

- For a required dropdown implemented as a native `<select required>` with no
  `onInvalid`/`setCustomValidity` override, document the "Message / Situation" as
  *"Please select an item in the list."* — not the custom string that appears in the component's
  source code.
- The "What it Means" / "What You Should Do" columns may still be field-specific (e.g. "Component
  field is blank on submit." / "Select a component from the dropdown.").
- This does **not** apply to:
  - `<select>` elements without `required`, or where validation is handled entirely in JS
    (state-based `errors` object + `showToast`, e.g. `AddProgramDialog`'s Program Type/Stage).
  - `<input required>` text/number/date fields — these trigger a different native message
    ("Please fill out this field.", or a range message for `min`/`max`) and are out of scope for
    this rule.
  - Forms rendered with `noValidate`, where native validation is disabled and the JS message is
    what actually displays.

**Code is not changed by this rule.** This is a documentation-accuracy rule only — it brings
`UserManual.md` in line with what the browser actually shows today. If the team later decides to
remove the native `required` attribute and rely on the JS validation instead (or add
`setCustomValidity` to restore the custom message), update the manual back to the custom message
at that time.

---

## Change log

- 2026-06-14 — Initial version (UserManual.md v3.9). Removed `UI-UX-XXX`/`MIOW`/`CC`/etc. prefixed
  IDs across `UserManual.md` in favor of sequential numbering; corrected "Add Project Major Item
  of Works" (Component / Infrastructure Type / Type of Work), "Add New Future Road"
  (Classification), and "Revise Project" (Category / Reason) validation messages to the native
  *"Please select an item in the list."* tooltip.
