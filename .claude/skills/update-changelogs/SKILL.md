---
name: update-changelogs
description: Add the release note for a change to docs/changelogs, which the app's top-bar Changelogs button shows to every user. Use after any change to app behaviour (FE, API, Hangfire, reports, SQL), when the changelog Stop hook asks for it, or when the user says "update the changelogs" / "log this change".
---

# Update the changelogs

`docs/changelogs/` holds one Markdown file per release. The front end bundles them at build time (`FE/src/components/changelog/changelogs.ts`), and the **Changelogs** button at the top right of every page lists them, newest first. A push that changes these files deploys like any code change.

Every change to app behaviour gets an entry. Internal-only work gets a one-line entry too, so the list stays complete.

## Pick the file

1. Open the newest file (highest `vX.Y.Z`).
2. If its first line ends with `(not yet released)`, add your section to it.
3. Otherwise start the next version: `docs/changelogs/v<next>-<short-slug>.md`, for example `v2.0.10-batch-restore-preview.md`. The slug is lower-case words joined by `-`; the app shows it as the release title, so make it describe the release's main changes. First line:

   ```markdown
   # MYPS changes since <previous file name without .md> (not yet released)
   ```

4. When a release ships, remove ` (not yet released)` from its first line. Nothing else changes.

## Write the section

One `##` section per change, above the `## Test cases by module` block:

```markdown
## <What changed, in plain words> (#<PR number>)

- **<The main effect, as one bold sentence.>** <What the user now sees or does, and how it was before.>
- <One fact per bullet: rules, limits, messages quoted exactly as the app shows them.>
- <Anything that did not change or is still pending, said plainly.>
```

- The heading names the change from the user's side ("Batch action prompts name the program and its current stage"), not the code ("fix ProgramHelper").
- `(#NNN)` is the PR number. A change pushed straight to `main` has no PR: put its test case ID instead, for example `(S01-TC004-P002)`, or nothing if it has neither.
- Write for the people who use MYPS: DPC, RPC, PS Admin and ATA testers. Name screens, buttons and messages exactly as the app shows them. Bold the first sentence of the most important bullets.
- Say what was wrong before when it helps a tester recognise the fix ("Before, the message said the Program ID did not exist.").
- Be honest about limits and what is not done yet ("The RDIP and RBP Components reports from the old dialog are not in the Reports module yet.").
- No internal detail: no class or table names, no hostnames, server addresses, passwords, user e-mails or commit hashes. The file is shown to every user.
- Internal-only work (tooling, CI, refactors with no visible effect): one bullet, `- Internal <what> only. Nothing visible changed.`
- A User Manual-only change: `- User Manual only. The app is unchanged.` followed by what the manual now says.

## Test cases by module

At the end of the file, list each test case the change touches, grouped by workbook sheet, keeping the existing tables:

```markdown
## Test cases by module

### S01 — S01-Login, Global Search & Prog

| TC ID | PR | Screen |
|---|---|---|
| S01-TC004-P002 | — | Programs (Delete) |
```

- Take the sheet title and the Screen text exactly from the ATA workbook (column A holds `<TC ID>` and the screen name).
- PR column: the PR number, or `—` for a direct push to `main`.
- Keep rows sorted by TC ID. A change with no test case adds no row.

## Check

- The file still starts with its `# MYPS changes since …` line.
- Open the app locally and click **Changelogs**: the release shows at the top with your section.
