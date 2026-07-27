---
name: update-manual-changelog
description: 'Generate a detailed before/after changelog entry in documents/UserManual_Changelog.md for a recent UserManual.md update. Use when: FE/UserManual.md has just been edited (e.g. after the update-user-manual skill, or a manual edit) and the version number was bumped, and the change history should be recorded with old/new value tables and source commits.'
argument-hint: 'Optional: version range (e.g. "3.8 to 3.9") if it cannot be inferred from the Revision History table'
---

# Update Manual Changelog

## Purpose
Record a detailed, reviewable record of what changed in `FE/UserManual.md` between two versions — old vs new values, which sections were affected, and which commits motivated each change — by adding a new entry to `documents/UserManual_Changelog.md`, following its established format.

This is a separate, optional step from bumping the "Revision History" table inside `UserManual.md` itself (which stays a one-line summary per version). The changelog file is the detailed record for anyone who needs to audit *exactly* what text changed and why.

---

## Procedure

### Step 1 — Determine the Version Range

- Read `FE/UserManual.md`'s header (`**Version:**` / `**Date:**`) and its "Revision History" table.
- The new version = the latest row. The old version = the row immediately before it.
- If the user supplied a version range as an argument, use that instead.

---

### Step 2 — Gather the Diff

- Run `git diff -- FE/UserManual.md` to see uncommitted changes (the typical case right after `update-user-manual` ran).
- If there's no uncommitted diff, find the commit(s) that bumped the version (`git log -p -- FE/UserManual.md` or `git log --oneline -- FE/UserManual.md`) and diff against the commit before the old version was introduced.
- From the diff, identify each distinct change: new/changed table rows, new subsections, reworded sentences, renamed fields, etc. Group changes by the section of `UserManual.md` they belong to (e.g. "Section 3.1 — Login Common Outcomes", "Appendix B — Consolidated Validation Messages").

---

### Step 3 — Identify Source Commits

For each grouped change, find the code commit(s) that motivated it:

- `git log --oneline -10 -- <relevant source file>` for files referenced in the manual change (e.g. a controller, a `.tsx` page, a DTO).
- If the change came from a gap-analysis report rather than a specific commit, note the report and finding instead of a commit hash (e.g. "Gap analysis follow-up — see `documents/MYPS_Gap_Analysis_Report.md`, 'Login — Empty Field Validation'").
- If a change is purely editorial (wording/formatting, no code change), note that explicitly rather than inventing a commit.

---

### Step 4 — Write the Changelog Entry

Read the current `documents/UserManual_Changelog.md` (if it exists) to confirm the established format (see existing `v3.6 → v3.7` entry for the reference structure: numbered sections with before/after tables, then a final "Commits Covered" table).

Compose a new entry using this structure:

```markdown
# UserManual.md — Changelog vOLD → vNEW

**Date:** <today's date>
**Branch:** <current branch> (commits up to `<short hash of HEAD, or "uncommitted">`)

---

## 1. Document Header

| Field | vOLD | vNEW |
|-------|------|------|
| Version | OLD | NEW |
| Date | <old date> | <new date> |

---

## 2. <Section X — Title>

| # | Old | New | Reason |
|---|-----|-----|--------|
| ... |

---

(repeat numbered sections per change group — use before/after tables for value changes,
or a short prose description + "New" marker for additions)

---

## N. Commits Covered

| Commit | Message | Impact |
|--------|---------|--------|
| ... |
```

- Number sections sequentially starting at 1 (Document Header is always first).
- For purely additive content (new subsections, new tables), use a one-row description instead of an old/new table — e.g. "**New subsection added:** ... — see `FE/UserManual.md`, Section 5.4.6".
- Insert the new entry **at the top** of `documents/UserManual_Changelog.md` (most recent first), separated from the previous entry by `---`. If the file doesn't exist yet, create it with just this entry.

---

### Step 5 — Confirm

Report to the user:
- The version range covered and where the entry was written
- A short bullet list of the sections/changes recorded
- Any change groups where the source commit could not be confidently identified (flag for the user to confirm)
