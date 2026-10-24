---
name: create-pr-issue
description: 'Open a Gitea pull request for the current branch from one or more UAT issues, using the issue''s test cases as the Acceptance Criteria. Runs pre-flight checks (branch sanity, diff-scoped typecheck/build, SQL migration detection, change-size rating No-op/Low/Medium/High, /code-review offer), maps each test case to evidence in the diff, asks whether the PR is Draft (WIP) or Ready for review and whether to write an e2e test, then pushes and opens the PR after the user approves the title and body. Use when: a fix branch is ready (or nearly ready) and needs a PR, or the user says "create a PR", "open a PR for issue #N", "raise the PR".'
argument-hint: 'Optional: issue number(s), e.g. "423" or "#423 #425". If omitted, the issue is inferred from the branch name and commits.'
---

# Create PR from Issue

## Purpose
Turn a finished fix branch into a Gitea PR whose Acceptance Criteria are the **test cases written in the UAT issue**, not criteria re-invented from the diff. This is the step after `implement-task` / `code-review` in the workflow described in the root `CLAUDE.md`.

The PR is outward-facing: nothing is pushed or posted until the user has approved the final title and body (Step 8).

## Repo facts this skill relies on
- Remote `origin` is **Gitea**: `https://gitea.eptisa-dev.com`, repo `myps/myps_server`. `gh` does not work and there is no `tea` CLI. Use the REST API at `https://gitea.eptisa-dev.com/api/v1/repos/myps/myps_server`.
- PRs target **`main`**. Confirm against the last few merged PRs (`git log --oneline origin/main -15 | grep "Merge pull request"`) and ask if it looks different.
- **Draft = `WIP: ` title prefix.** Gitea has no separate draft flag in this setup; PR #427 is the reference. "Ready for review" = no prefix.
- **Issue linking pattern:** PRs carry the issue's `[UAT][S0x] [TC-IDs]` prefix in the title and mention the issue as a bare `#N` in the body. **Never** use `Closes` / `Fixes` / `Resolves`. Issues stay open after merge so QA can retest. **Do not touch issue labels or post issue comments.** The triage lead manages `has-pr`, `fix-merged`, `forqa` and `uat-state/*` and posts the "Referenced by PR" comment.
- **Auth:** git's credential manager holds the user's Gitea token. Read it only through the helper below, never print it, never put it literally on a command line, and send it to `gitea.eptisa-dev.com` only. Always set `GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0`: a dead credential otherwise opens a GUI prompt and hangs the shell. If auth fails (401), stop and ask the user for a new personal access token (Gitea → Settings → Applications).
- **Python is not installed** (`python` opens the Microsoft Store). Build JSON with `node`.

### API helper (Bash)

```bash
gitea() {  # usage: gitea METHOD PATH [JSON_FILE]   e.g. gitea GET "/issues/423"
  local cred U P B=https://gitea.eptisa-dev.com/api/v1/repos/myps/myps_server
  cred=$(printf "protocol=https\nhost=gitea.eptisa-dev.com\n\n" | GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0 git credential fill 2>/dev/null)
  U=$(printf "%s\n" "$cred" | sed -n 's/^username=//p'); P=$(printf "%s\n" "$cred" | sed -n 's/^password=//p')
  if [ -n "$3" ]; then curl -s -u "$U:$P" -X "$1" -H "Content-Type: application/json" --data-binary @"$3" "$B$2"
  else curl -s -u "$U:$P" -X "$1" "$B$2"; fi
}
```

Pipe the output into `node -e` to pick fields. Each Bash call is a fresh shell, so define the function in every call that uses it.

---

## Procedure

### Step 1 — Resolve the issue(s)

**With arguments:** strip `#`, then `GET /issues/<n>` for each one. Stop if any is a PR, closed, or missing, and say which.

**Without arguments (auto):**
1. Collect TC IDs from the branch name and from `git log --format=%s%n%b origin/main..HEAD`. Match `S\d{2}-TC\d{3}(-P\d{3})?`. Expand shorthand the way issue titles write it: `[S04-TC020-P001, TC021-P001]` means `S04-TC021-P001`.
2. For each TC ID, search `GET /issues?state=open&type=issues&labels=uat&q=<TC-ID>&limit=20`, and keep issues whose **title or test-case list** contains it.
3. **Decide:**
   - **Obvious:** one candidate set covers every TC ID found, and the diff touches the module the issue names. Proceed without asking, and state the pick in one line, e.g. "Using #383 (S02-TC003-P001, from the branch name and commit 02158dd9)."
   - **Not obvious:** no TC IDs, no match, several partial matches, or the diff looks unrelated to the issue's module. Ask with `AskUserQuestion`, listing up to 4 candidates (number, title, which TC IDs matched) plus "Other" for a typed number.

### Step 2 — Extract the test cases as Acceptance Criteria

UAT issues carry a machine-written block:

```
<!-- uat-backlog:begin key=... -->
**Summary** ...
**Test cases** (latest round 2026-09-23)
- [ ] S04-TC005-P001 · Pending · Settings Code tables (Component Cost) · PS Admin
  > Change "Export to PCMA" header to "Publishable to PCMA".
**Source** ...
<!-- uat-backlog:end -->
```

For every `- [ ] <TC-ID> · <state> · <module> · <role>` line, capture the TC ID, state, module, role, and the `>` remark lines under it. **The remark is the expected behaviour; quote it, don't paraphrase it.**

Also:
- Read the issue's comments (`GET /issues/<n>/comments`). QA often adds or changes expectations there, frequently in Tagalog. Show any comment that changes an expectation, and add it as an extra AC line marked "(from comment by <user>)".
- Attachments (screenshots) can't be read. If the remark depends on one ("see SS13"), say so and flag that TC as "needs visual check".
- If the issue has no `uat-backlog` block or no TC lines, fall back to its Summary as a single AC line and tell the user.
- `type/test-script` issues usually need a test-script change, not code. Mark those TCs "Not code" rather than "Not addressed".

### Step 3 — Pre-flight checks

Run all of these and collect the results. Don't stop at the first problem; report them together at the end of the step.

**a. Branch and base sanity**
- Read the current branch with `git branch --show-current`. **Re-check it right before committing or pushing.** HEAD can change mid-session if the user switches branches in VS Code.
- Refuse to continue from `main` or `dev-trunk`.
- `git rev-parse --abbrev-ref @{u}` must **not** be `origin/main`. A branch tracking main lets VS Code Sync push straight to `main`. If it does, fix it with `git branch --unset-upstream`.
- `git log --oneline origin/main..HEAD` must show at least one commit. `git fetch origin main` first. If the branch is behind main and conflicts, say so.
- Check uncommitted changes with `git status --short`. **Never stage** `FE/.env.development`, `e2e/test-results/**` or `e2e/playwright-report/**` unless the user asks. When committing, stage by explicit path, never `git add -A` or `git add .`.
- Look for an existing open PR for this branch: `GET /pulls?state=open&limit=50`, then match `head.ref`. If one exists, offer to **update** it (`PATCH /pulls/<n>`) instead of creating a duplicate.

**b. Typecheck and build, scoped to the diff**
- List changed files with `git diff --name-only origin/main...HEAD`.
- If any `FE/` file changed, run `cd FE && npx tsc -b`. Keep only the errors in files this branch changed.
  - Errors in changed files **block the PR.** Show them and offer to fix them before going on.
  - Errors in other files are pre-existing. Report only their count, e.g. "22 pre-existing errors in 8 files, none in this diff". As of 2026-10-24, `main` has 22 errors, all in `src/pages/Rbac/*` and `ExportPdfWidget.tsx`. If that baseline reaches 0, the gate can become "the whole project must pass".
- If any `.cs` / `.csproj` file changed, run `dotnet build Main/Main.csproj -o "<scratchpad>/build-check" -nologo -v q`. Building to a scratch folder avoids file locks from a running API.
  - Compile errors block the PR. Warnings don't.
- `e2e/` has no `tsconfig.json`. Playwright type-strips specs at run time, so the e2e run in Step 6 acts as its check.

**c. SQL migrations and deploy steps**
- If the diff adds or changes anything under `Main/Resources/Internal/SQLScripts/` or another `*.sql` file, list each file. They go in a **Deployment** section of the PR body: "Run `<file>` in each environment BEFORE deploying this build". Note when a step is required for the app to work, e.g. a new column the code selects. This applies to permission seeds too: renaming a controller action needs its RBAC grant re-seeded or every user gets a 403.

**d. Change size**

Measure app code only. Leave out tests, docs and Markdown:

`git diff --shortstat origin/main...HEAD -- . ':!e2e' ':!documents' ':!*.md' ':!.claude'`

Then pick the **highest** level that any single factor reaches:

| Size | When |
|---|---|
| **No-op** | Runtime behaviour doesn't change: only docs, comments, tests/e2e specs, or tooling (`.claude/`, scripts) |
| **Low** | ≤ 50 changed lines in ≤ 3 files, one module. Copy, labels, display, or a small isolated fix |
| **Medium** | 51–300 lines or 4–10 files, **or** any of: a behaviour change to an existing flow, an added or changed API endpoint or DTO field, a shared component/hook/helper (e.g. `httpClient`, `usePagination`, `Helpers/*.cs`) |
| **High** | > 300 lines or > 10 files, **or** any of: SQL (migration, stored procedure, view, function), RBAC/auth/permissions, delete or write rules on real data, cross-module changes, a deploy step that must run in order |

Record the level plus the reason that set it. It goes at the bottom of the PR body (Step 7) and in the Step 8 summary line.

**e. Code review**
- If `/code-review` hasn't been run on this branch's diff in this session, offer it via `AskUserQuestion`: "Run /code-review first (Recommended)" or "Skip". If the user accepts, invoke the `code-review` skill, then come back here. Record the outcome (clean, findings fixed, or findings left open) for Steps 5 and 7. For a **High** change, recommend `/code-review` more strongly. Say why: "High: adds a SQL migration".

### Step 4 — Map each test case to evidence

Build a table and show it to the user:

| TC | Expected (remark) | Verdict | Evidence |
|---|---|---|---|
| S04-TC005-P001 | header says "Publishable to PCMA" | Covered | `CostTypeTable.tsx` header + confirm dialogs, commit abc123 |

Use these verdicts:
- **Covered:** the diff clearly makes the stated behaviour true.
- **Partly:** some of it, e.g. Project but not Modification.
- **Not addressed**
- **Not code:** test-script or data issue.
- **Needs visual check**

Ground each verdict in specific files and hunks. Don't infer from the commit message alone.

If any TC is not Covered, **warn** with a list of the gaps. Don't block the PR. The gaps feed the Draft/Ready recommendation, and those TCs stay unchecked in the PR body with a reason.

### Step 5 — Ask the user (one `AskUserQuestion` call)

**Q1 — "Mark this PR as Draft (WIP) or Ready for review?"** Put the recommended option first and add "(Recommended)" to its label.
- Recommend **Ready for review** when `/code-review` ran with no open findings, **or** when every TC is Covered, typecheck/build is clean, and the fix reads as correct.
- Otherwise recommend **Draft (WIP)**, and say why in the option description, e.g. "S02-TC003-P002 not addressed; code review skipped".

**Q2 — "Create an e2e test for these test cases?"**
- First check `e2e/CLAUDE.md`'s **Coverage map** for a spec that already covers this route or table. If one does, offer "Extend `<spec>`" as an option.
- Recommend **Yes** when the TC describes behaviour a user can see in the browser or API and nothing covers it yet.
- Recommend **No** for test-script-only, docs-only, or report-rendering TCs (Crystal Reports output can't be asserted here).

**Q3 — "Request reviewers?"** Use multi-select. Only applies if Q1 is Ready; ignore it for a WIP PR.
- Suggest reviewers from the last ~50 PRs whose title has the same `[UAT][S0x]` section. Use `GET /pulls?state=all&limit=50`, then collect `requested_reviewers[].login` plus the reviewers from `GET /pulls/<n>/reviews` for the 5 most recent matches.
- Exclude the current user. Up to 3 people, plus "None".

### Step 6 — Write and run the e2e test (only if Q2 = yes)

Follow `e2e/CLAUDE.md` exactly. It holds the selector convention, the helpers (`login`, `apiLogin`, `captureApiCalls`, `narrator`), the cleanup rules, and "ask the database for the rows you need". In addition:
- Name the file `e2e/tests/<feature>.spec.ts`. Write **one `test()` (or one narrated `check()` step) per TC**, with the TC ID at the start of the title: `test('S04-TC005-P001: header reads "Publishable to PCMA"', ...)`. Assert the **remark's own expected behaviour**, so a QA reader can map test → TC.
- Clean up everything the spec creates in `afterEach`/`afterAll`, or through the existing sweeper markers.
- Update the **Coverage map** row in `e2e/CLAUDE.md`, matching the detail level of the rows around it.

**Run it locally, never against the shared database.** `Main/appsettings.Development.json` points at the shared dev server (192.168.50.200), and `ConnectionStrings__*` environment variables do **not** override it: `Program.cs` adds the JSON after the environment variables. To point the API at the local database:
1. Build the API: `dotnet build Main/Main.csproj`.
2. Make a scratch folder holding:
   - a copy of `Main/appsettings.json`;
   - a copy of `appsettings.Development.json` with only `MYPSDb` and `PCMADb` replaced by `Server=localhost;Database=myps_db_dev;Trusted_Connection=True;TrustServerCertificate=True;`;
   - a junction `Resources` → `Main/bin/Debug/net8.0/Resources`.
3. Run `Main/bin/Debug/net8.0/Main.exe` with that folder as its working directory, with `ASPNETCORE_ENVIRONMENT=Development` and `ASPNETCORE_URLS=http://localhost:5099`. Start it in the background.
4. Before any test writes, verify the API is on the local database: `SELECT TOP 1 LastHeartbeat FROM HangFire.Server ORDER BY LastHeartbeat DESC` on local `myps_db_dev` must show a fresh heartbeat. If it doesn't, stop.
5. For UI specs, start Vite against that API without editing the tracked `.env.development`: `cd FE && VITE_API_BASE_URL=http://localhost:5099 npx vite --port 8080 --strictPort` (background).
6. Run the spec: `cd e2e && E2E_API_URL=http://localhost:5099 npx playwright test <spec>`.

**Gate on the result:**
- **Pass:** record "N/N passed on local myps_db_dev" for the PR body and tick the TCs it verifies.
- **Fail:** read the trace or error and decide whether it's a **test bug** or a **product bug**. Fix test bugs and re-run. For a product bug, show the user the failing TC and the evidence, leave that TC unchecked, and re-ask Q1 with Draft recommended.
- **Can't run** (no local DB, API won't start, needs `E2E_SQL_*` that isn't set): say so plainly, write "Written, not run: <reason>" in the PR, and re-ask Q1 with Draft recommended.

Stop the API and Vite background processes when done. Commit the spec and the `e2e/CLAUDE.md` change by explicit path. Never commit `e2e/test-results/` or `e2e/playwright-report/`.

### Step 7 — Compose the title and body

**Title:** `[WIP: ]` + the issue title's bracket prefix copied verbatim + ` <type>(<scope>): <short summary>`.
- Example: `[UAT][S04] [S04-TC005-P001] fix(code-tables): Change "Export to PCMA" header to "Publishable to PCMA"`.
- Take `type(scope)` from the branch's own conventional commits. If there are none, use `fix` for `type/bug` and `feat` for `type/enhancement`.
- Several issues: join the prefixes with ` and `, as PR #441 does.
- Draft: prefix `WIP: `.

**Body:** use this template. Drop any section that would be empty, except Test cases.

```markdown
## Summary
Issue: #<n>   <!-- bare mention only; never Closes/Fixes/Resolves -->

<2-4 sentences: what was wrong / asked, what now happens>

## Changes
- **<area>** (`<file>`): <what changed and why>

## Test cases (Acceptance Criteria)
From issue #<n>. A box is ticked only when the behaviour was actually verified (e2e pass, or a manual run done in this session).

- [x] **S04-TC005-P001** · Settings → Code Tables (Component Cost) · PS Admin
  > <remark quoted from the issue>

  Verified: e2e `code-tables-cost-type-pcma-label.spec.ts`
- [ ] **S04-TC006-P001** · ...
  > <remark>

  Not addressed: <reason> / Needs visual check: <what to look at>

## E2E
`e2e/tests/<spec>.spec.ts`: <what it asserts>. Result: <N/N passed on local myps_db_dev | written, not run: reason>.
Run: `cd e2e && npx playwright test <spec>` (API + Vite on local DB, see e2e/CLAUDE.md).

## Deployment
Run `<migration.sql>` in each environment **before** deploying this build: <consequence if skipped>.

## Verification
- Typecheck (FE, diff-scoped): <clean | N errors fixed>; <M> pre-existing errors elsewhere, untouched.
- Build (API): <clean | not applicable>.
- /code-review: <clean | N findings fixed | skipped>.

## Not changed
- <deliberate scope limits, judgement calls QA should know about>

## Change size
**<No-op | Low | Medium | High>** · <N> files, +<a>/−<d> app code (excl. tests/docs) · <the factor that set the level, e.g. "adds a SQL migration">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Rules:**
- **Never tick a box on assumption.** "Covered" in Step 4 means the code addresses it; a tick means it was observed working.
- Write for the QA reviewers and developers who read these PRs: plain English, short sentences, behaviour first, file names second.

### Step 8 — Approval

Show the final title and body in full, plus a summary line:

> Draft/Ready · change size · base `main` · head `<branch>` · reviewers · "will push N commits".

Wait for an explicit OK. Apply any requested edits and show the result again.

### Step 9 — Publish

1. Re-check `git branch --show-current` matches the branch from Step 3, and that the upstream isn't `origin/main`.
2. Push with `git push -u origin <branch>`.
3. Write the JSON payload with `node -e`. Read the body from a scratch `.md` file, `JSON.stringify` `{title, head: <branch>, base: "main", body}` into a scratch `.json`.
4. Open the PR: `gitea POST "/pulls" <file.json>`. For an existing PR (Step 3a), use `gitea PATCH "/pulls/<n>" <file.json>` with title and body only. Expect HTTP 201 or 200. Read `number` and `html_url` from the response.
5. If Ready and reviewers were chosen: `gitea POST "/pulls/<n>/requested_reviewers"` with `{"reviewers": ["login", ...]}`.
6. Don't edit issue labels or post on the issue (see "Issue linking pattern").

### Step 10 — Report

Tell the user:
- The PR link and number, whether it is Draft (WIP) or Ready, and its change size.
- The AC tally, e.g. "3/4 TCs verified, 1 needs a visual check (S06-TC001: icons vs SS13)".
- The e2e result, or why there isn't one.
- Any deployment steps the merger must run.
- For a WIP PR: what's left before it can lose the `WIP: ` prefix (removing the prefix in Gitea marks it ready).
