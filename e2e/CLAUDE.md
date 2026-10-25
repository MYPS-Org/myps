# e2e — Claude Code Guide

Playwright end-to-end tests against the FE app. This file exists so a Claude session can write new specs without re-exploring `FE/src` from scratch — keep it current as specs are added.

## Running tests

The FE dev server is **not** auto-started by Playwright (no `webServer` block in `playwright.config.ts`) — start it manually first:

```bash
cd FE && npm run dev        # serves on http://localhost:8080 (playwright.config.ts baseURL)
```

Then, from `e2e/`:

```bash
npm install                 # first time only
npm run install:playwright  # first time only — installs browser binaries
cp .env.example .env        # first time only — fill in real credentials if not using the defaults
npm test                    # headless run
npm run test:headed         # headed (visible browser)
npm run test:report         # opens the last HTML report
```

Config: `playwright.config.ts` — 120s test timeout, 10s expect timeout, trace/video/screenshot captured `on` failure only, HTML report to `playwright-report/`. `import 'dotenv/config'` at the top of `playwright.config.ts` loads `e2e/.env` into `process.env` before tests run; `.env` is gitignored, `.env.example` is the committed template.

Two opt-in flags, both off by default because each one writes something a run cannot undo:

- **`E2E_RUN_MANUAL=1`** — includes `tests/zz-manual-*.spec.ts`, which `testIgnore` otherwise excludes. These are one-off scripts in a `test()` wrapper, not tests (e.g. `zz-manual-cleanup` fires `DeleteProgram` at hard-coded names). Until 2026-10-06 nothing excluded them and every plain `npx playwright test` ran them.
- **`E2E_ALLOW_ORPHANS=1`** — runs tests that must strand a program, because they advance one past BP and nothing can delete it afterwards. Today that is the three opt-in tests in `batch-delete-restore-cross-stage.spec.ts` (rule #2, the two-hop delete, and the all-deleted advance). Each program is named `e2e-crossstage-orphan-<ISO>`.

## Login flow

Use `login()` from `tests/helpers/auth.ts` — don't re-implement it inline in a spec:

```ts
import { login } from './helpers/auth';

await login(page); // uses E2E_USERNAME/E2E_PASSWORD env vars, falls back to testuser/password
```

It navigates to `/login`, fills `input#username` / `input#password`, clicks `Sign In`, and waits for the redirect to `/dashboard`. Credentials come from `E2E_USERNAME`/`E2E_PASSWORD` — set them in `e2e/.env` (see `.env.example`) or export them in the shell before running tests. Falls back to `testuser`/`password` if unset. Can also be overridden per-call: `login(page, user, pass)`.

**Never call both `apiLogin()` and `login()` in the same test.** `apiLogin` signs the BROWSER in, not just an API client — `page.request` shares the context's cookie jar — so once fixtures are built the session already exists. `login()` then goes to `/login`, the app redirects an authenticated visitor straight to `/dashboard`, and the `fill()` on a username box that never renders hangs until the test budget runs out. It surfaces as a bare 120s timeout with the dashboard in the screenshot and a stack pointing at whatever teardown was pending, which looks nothing like its cause; the trace is what shows the truth (`fill` pending for the whole run). A spec that builds fixtures through `apiLogin` should just `page.goto()` the route it wants.

## Selector convention

**No `data-testid` attributes exist anywhere in `FE/src`** (verified by grep across the whole tree). Specs therefore rely on text and role-based locators — e.g. `page.locator('text=Project Details')`, `button:has-text("Save")`. This is a known fragility: these break silently if UI copy changes. If `data-testid` attributes get added to FE components in the future, prefer them over text selectors for new specs.

## Capturing API calls

Use `captureApiCalls()` from `tests/helpers/networkCapture.ts` instead of hand-rolling a `page.on('requestfinished', ...)` listener:

```ts
import { captureApiCalls } from './helpers/networkCapture';

const apiCalls = captureApiCalls(page, ['/api/Project/showprojects']); // url substring match, registers listener immediately
await page.goto('/projects');
// apiCalls is populated as matching requests finish
```

Attach captured calls to the test report for debugging with `test.info().attach(name, { body: JSON.stringify(apiCalls, null, 2), contentType: 'application/json' })` — see existing specs for the pattern.

## Narrating a run

`narrator(page, { total })` from `tests/helpers/narrate.ts` gives a spec `check()` for a
verified step and `say()` for a branch it deliberately did not take. Both log to stdout and
push a test annotation, so a narrated run reads as a sequence in the HTML report rather than
only in the terminal scrollback. `total` is reported, never enforced.

## Route inventory

Full route table, from `FE/src/components/Routes.tsx` (source of truth — this table is a manually-maintained snapshot and will drift; re-check `Routes.tsx` if a route 404s):

| RouteName | Path | Page component |
|---|---|---|
| Dashboard | `/dashboard` | `pages/Dashboard/Dashboard` |
| UserManagement | `/user-management` | `pages/Rbac/Rbac` |
| InfraManagement | `/infrastructure-management` | `pages/Rbia/Views/Rbia` |
| ProgramList | `/programs` | `pages/Program/Views/Program` |
| ProgramDetails | `/programs/programdetails/:program` | `pages/Program/Views/ProgramDetail` |
| ProjectList | `/projects` | `pages/Project/Views/Project` |
| AddProject | `/projects/addproject` | `pages/Project/Views/AddProject` |
| ProjectDetails | `/projects/project-details/:project` | `pages/Project/Views/EditProject` |
| RevisionList | `/revision` | `pages/Modification/views/ModifcationList` |
| RevisionView | `/revision/view/:modificationType/:transactionId` | `pages/Modification/views/ViewRevision` |
| RevisionDetails | `/revision/:modificationType/:project` | `pages/Modification/views/ModificationDetails` |
| ProjectGroupList | `/project-groups` | `pages/ProjectGroups/Views/ProjectGroup` |
| ProjectGroupDetails | `/project-groups/:groupId` | `pages/ProjectGroups/Views/ProjectGroupDetails` |
| Reports | `/reports` | `pages/Reports/Reports` |
| Settings | `/settings` | `pages/Settings/Settings` |
| CodeTables | `/code-tables` | `pages/CodeTables/Views/CodeTables` |
| LumpSumList | `/lumpsum` | `pages/LumpSum/Views/LumpSumList` |
| AddWallet | `/lumpsum/add` | `pages/LumpSum/Views/AddLumpSum` — the RouteName keeps the wallet-era spelling because it is a `dbo.tAppViews` row |
| LumpSumDetails | `/lumpsum/:lumpSumId` | `pages/LumpSum/Views/LumpSumDetail` |

All routes above are behind login (protected routes) — every spec needs `login(page)` before navigating to one.

## Coverage map

Update this table whenever a spec is added, removed, or renamed — it's the fastest way for a future session to see what still needs coverage.

| Route | Spec file | Covered? |
|---|---|---|
| ProjectList (`/projects`) | `tests/project-list.spec.ts` | Yes — asserts the list request came back **200** with rows, and that the first ProjectId is on screen. It previously died on `text=Projects` (three matches) and never ran past line 14 |
| ProjectList paging — poisoned cursor plan | `tests/project-list-cursor-paging.spec.ts` | Yes — API level, as `E2E_USERNAME` and e2eauc (skipped if missing). A cursor of 0 is rejected for Next / Previous / Page (it used to poison SQL Server's cached Next plan so every later Next timed out at 90 s); First → Next → Next → Previous → Page are all 200, each under max(1.5 × first page, 10 s), pages consistent. Opt-in (`E2E_ALLOW_PLAN_EVICTION=1` + `E2E_SQL_*`): injects the cursor-0 plan into the plan cache, then a real Next must still be fast (fails with a 90 s timeout without the fix). See `documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md` |
| AddProject (`/projects/addproject`) | `tests/project-form.spec.ts` | Yes — both dropdown endpoints must answer 200, not merely be requested |
| Dashboard | `tests/dashboard-real-data.spec.ts` | Yes — the demo path asserts the page issues **no `/api/Dashboard/` request at all**; the live path (skipped against `LIVE_DB_ENABLED`) asserts eager KPIs, lazy per-section loading on scroll, and that the split endpoints reconcile with each other. See *The dashboard's Live DB switch* |
| UserManagement | — | No |
| InfraManagement — Roads pagination | `tests/rbia-road-pagination.spec.ts` | **Partly.** Covers only the pager: Next/Previous keyset hops carry `Navigation`+cursor and land on genuinely different rows; First/Last are one-shot jumps; a numbered page button walks hop-by-hop the first time it's visited and becomes a single `Navigation: Page` request once cached. Written against the exact bug the BE's keyset-only `ShowFutureRoads` has — a bare `{ page, limit }` silently defaults to `Navigation.First` and re-renders page 1 forever; confirmed to fail against the pre-fix hook. Road Sections / Bridges pagers and the search box are still uncovered; add/edit/delete and the filter are in `rbia-infra-crud.spec.ts`. Asks the server for the road total first and **skips, naming the count, on a database with fewer than 41 future roads** (three pages of 20); every read of the captured calls waits via `expect.poll`, since `captureApiCalls` records a call only after its body is read |
| InfraManagement — Roads / Road Sections / Bridges CRUD | `tests/rbia-infra-crud.spec.ts` | **Yes**, through the UI, in the order QA runs S06 (2026-10-20, UAT remarks 2026-10-21): RBIA rows show an RBIA badge and no Edit/Delete, add a road with a **generated** Road ID (picks an island; the ID is read from the toast; section and bridge IDs are generated the same way), edit it (Road ID read-only), filter by name + classification (the BE ignored Classification; the options come from `tFutureRoadsClassification`, so no Quaternary), Add Section from the road row **right after an edit** (the dialogs treated any shared selection as Edit and posted Id 0), section list shows Length and the DEO **name** (BE returns `LengthM`/`DEOParticipantId`), edit the section, Add Bridge from the section row, edit the bridge, then delete bridge, section and road (UI-added rows used to be refused as RBIA-migrated, and bridge delete called a non-existent route). Every add/edit asserts its toast and that the row shows **without a reload**. A second test clicks the Road Name header: the request carries `sortField`/`sortDirection`, the table shows the server's order, Next keeps it (page 2, different rows), and a second click goes descending back on page 1. Creates one `FR` road, `FS` section and `FB` bridge (generated IDs, read from the toasts), and deletes them again in `afterEach` (children first). Confirmed to fail on the pre-fix build at the first step |
| ProgramList | — | No |
| ProgramDetails — Batch Actions | `tests/program-detail-batch-actions.spec.ts` | **Partly** — the batch menu only. Batch Delete removes the row from the table **with no page reload**, which is the assertion the pre-fix build fails; Batch Restore (S01-TC008-P001, #376) is in the menu and brings a soft-deleted row back with no reload, on the cross-stage fixture program (delete set up through the API, put back in a `finally`); the publish actions are asserted hidden until the program is Approved, and Restrict Publishing is asserted to re-query the table after its own call. Uses the approval fixture program, the only one the suite may approve. The rest of the page (header form, stage advance, publish to PCMA) is still uncovered |
| ProgramDetails — Batch Delete / Restore across stages | `tests/batch-delete-restore-cross-stage.spec.ts` | **Partly** — API level. Default test: on the cross-stage fixture program, a delete at NEP leaves the project listed at BP (rule #1), a restore lists it at NEP again, and a second restore is refused. Three tests are **opt-in** (`E2E_ALLOW_ORPHANS=1`): the true rule #2 test (restore after the program moved on), which caught the "advance resurrects a deleted project" defect; a two-hop test (delete at NEP, advance to NEP-E and again to HGAB: the project is absent from both); and an all-deleted test (a program whose every project was deleted at the current stage still advances, spec AT-STG-007). All three pass since the 2026-10-20 fix; see *The cross-stage fixture program* |
| Project / program delete — the single deletion rule | `tests/program-hard-delete-policy.spec.ts` | **Yes** — API level, against `Functions/GetProjectDeletionTier.sql` (hard only on a project's first stage entry, soft once it has progressed, Lump Sum itemized always hard, published never, BP/P-prefix-agnostic, and since 2026-10-15 an **Approved program refuses every delete** except a Lump Sum itemized child's). Delete Program cases (a)–(g), (m), (n) — **no cascade since 2026-10-16**: a program with a live project is refused ("still has N project(s)") until Batch Delete removes them, then deleted; advanced program and Approved program refused (the refusal **reason** reaches the client); skip-BP program; the `tRevisionDetails` cascade on Batch Delete; audit rows per project (Batch Delete) plus one for the program; a program whose projects are all soft-deleted is deleted with their leftovers; and the Program list's `CanDelete`/`DeleteBlockedReason`. Batch Delete cases (h)–(l): first-stage hard delete, soft delete after BP→NEP by either the BP-form PK or the P-form id (restore too, each logged), refusal of Lump Sum and published rows, refusal in an Approved program, and `PreviewBatchDelete` returning the hard/soft/refused/missing groups while writing nothing. Seeds by `sqlcmd` and cleans up through nothing: **run it against a database snapshot**, with `E2E_SQL_*` naming the API's database. Before it runs: run `Main/Resources/Internal/SQLScripts/Migration.PreviewBatchDeletePermission.2026-10-15.sql` (the deletion scripts ship in the build; if they are missing the delete endpoints answer **503 "Delete Unavailable"**). `program-detail-batch-actions.spec.ts` case 1 also asserts the Batch Delete confirm dialog shows the server's "Permanently deleted (first stage entry)" group before DELETE |
| — (not a test) | `tests/zz-manual-cleanup.spec.ts` | One-off cleanup script from 2026-10-05, excluded by `testIgnore`; runs only with `E2E_RUN_MANUAL=1` |
| Batch Restrict/Allow Publishing — already-published guard | `tests/batch-restrict-allow-publish-skips-published.spec.ts` | Yes — API level. A mixed batch (one unpublished, one `IsPublished = 1`) must restrict/allow only the unpublished one and report the other in `SkippedAlreadyPublishedProjectIds`, verified against the table directly. The published flag is set by `sqlcmd`, so the file **self-skips unless `E2E_SQL_SERVER` and `E2E_SQL_DB` name the same database the API under test uses** (`E2E_SQL_USER`/`E2E_SQL_PASSWORD` for SQL auth, Windows auth otherwise; see `.env.example`) |
| ProjectDetails | `tests/project-visibility.spec.ts` | **Partly**: visibility only. A refused stage renders the "Project Not Available" panel instead of a blank page. The form itself is still uncovered |
| Project view gate: DEO / Region, per stage | `tests/project-visibility.spec.ts` | Yes, API level plus 2 UI cases. Covers: DPC/RPC list and open only the stages whose DEO is in scope; Lump Sum parents hidden; 403 "No Project Access" for an office that doesn't fit; AUC and users outside the four groups unchanged; Program totals unchanged; an approved modification's DEO moves a stage (SQL probe, rolled back); Lump Sum and Code Tables hidden in the sidebar for DPC. Needs the fixture and `E2E_SQL_*`, see *Project view gate* below |
| RevisionList / RevisionView / RevisionDetails | — | No |
| ProjectGroupList / ProjectGroupDetails | — | No |
| Reports | — | No |
| Settings | — | No |
| CodeTables — Component Cost › Cost Type | `tests/code-tables-cost-type-pcma-label.spec.ts` | **Partly** — this table only (S04-TC005, 2026-10-24). The column header and the Add / Save confirm dialogs say "Publishable to PCMA" and never "Export to PCMA" / "Export PCMA"; the flag still saves (added ticked → row shows Yes, edited unticked → No), since only the label changed and the wire field is still `ExportToPCMA`. Adds one `E2E<n>` cost type and deletes it in the UI, and again via `UpdateCodeTable` (TransactionType 2) in `afterEach`. It leaves `tCodeTableTransactionLog` / `tLoginHistory` rows behind. Confirmed to fail on the pre-fix component at the header step. Every other Code Tables tab is uncovered |
| LumpSumList / AddWallet / LumpSumDetails | `tests/ls-module-ui-walkthrough.narrated.spec.ts` | **Yes, all 11** — creates by typing, spends through the dialogs, pages the list (screen, wire and server compared), deletes through the UI, and asserts the absent controls stay absent. Six of these were dark for weeks behind a stale fixture; see *Resolve the program, do not name it* |
| Lump Sum API contract (13 actions) | `tests/ls-contract.spec.ts` | Yes — API level only, see below |
| Lump Sum row-level data security (13 actions) | `tests/ls-data-security.spec.ts` | Yes — API level; needs the fixture script, see below |
| Lump Sum data security, as a user sees it | `tests/ls-data-security-ui.narrated.spec.ts` | Yes — empty list, refused deep link, entitled user unaffected |
| A Lump Sum Project in the Project form | `tests/ls-project-form-identity.narrated.spec.ts` | **Yes** — the self-skip has cleared. It opens with the Lump Sum exemptions applied, renders read-only with its banner, and offers no Save, Update, Revise or enabled Add control |
| Lump Sum ownership — UACS inheritance, edit confinement | `tests/ls-ownership.spec.ts` | Yes — API level. Asserts children inherit the parent's UACS, that a differing workbook UACS is no longer refused, and that `AddProject` / `UpdateProjectDetails` / `ReviseProject` each refuse a Lump Sum **parent** while leaving children editable |
| A Lump Sum Project inside the ordinary project lists | `tests/ls-list-tolerance.spec.ts` | Yes — API level. `ShowProjects` and `ShowProjectsInProgram` each return a full page with the Lump Sum Project in it, its absent Region and Implementing Office coming back null rather than throwing |
| An Approved program on the Lump Sum page | `tests/ls-program-approved.narrated.spec.ts` | Yes — the rule is **narrow** (2026-09-09): only Delete Lump Sum Project is refused and only the details/component go read-only; Replenish, Import, Save, the row Delete and the child Delete stay live. Four cases: opened on an approved program; the flip on return-to-tab greying the delete **alone**; a Replenish draft caught by the flip still saving; the Add page's picker hiding the program and offering it again once Working. The API boundary is in `ls-contract`. Needs the approval fixture program, see *The approval fixture program* |

## Adding a new spec

1. Put it in `tests/`, named `<feature>.spec.ts`.
2. Start with `login(page)` from `helpers/auth.ts` (or a `test.beforeEach` if every test in the file needs it, see `project-list.spec.ts`).
3. Use `captureApiCalls()` if the test should assert on network activity.
4. Assert against visible text/role, per the [selector convention](#selector-convention) above — check the actual rendered copy in the relevant `FE/src/pages/**/Views/*.tsx` file rather than guessing.
5. Update the [coverage map](#coverage-map) above.

## Lump Sum V2

`tests/ls-contract.spec.ts` locks the module's API contract — all 13 actions, the
allocation arithmetic at both ends (a deduction and its restore), and each refusal's
own words.

**It is the API-level backstop; the narrated runs are
`ls-module-ui-walkthrough.narrated.spec.ts` and its two companions.** Keep both: the
contract spec is fast and precise about refusal wording, the walkthrough is what catches
things only a browser can — it found that creating a Lump Sum Project from the form had
never worked, because the program picker sent `ProgramLatest.ProgramId` where the server
wants `ProgramPK` and the two differ only by an `MP_` prefix.

### Running the whole suite

```bash
npx playwright test
```

Expected (whole suite, counted 2026-09-13 against `localhost/myps_db_dev_200`):
**70 passed, 4 skipped, 0 failed** in 5.3 minutes.

All four skips are honest and self-clearing:

- `dashboard-real-data` › *live database* — skipped at the time of that count, while
  `LIVE_DB_ENABLED` was false. It was re-enabled on 2026-09-17 (see *The dashboard's Live DB
  switch*), so on a current checkout this skip no longer applies.
- three KNOWN GAP data-security cases, which carry their gaps rather than deleting them.

That run was the first green one on this lineage. The one before it was **9 failed, 30 passed,
29 did not run**, and none of the nine was a product regression: the bring-up granted
`LumpsumController` but not the two `ImportingController` actions the import calls (six
failures, plus a serial cascade), the sample fixture could not load on this database at all
(two), and this dashboard spec had gone stale while it was dark (one). See
`documents/docs/engineering/MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md`.

This ran nothing at all until 2026-09-04. `dashboard-real-data.narrated.spec.ts` imported
`narrator` from `qa-kit/narrate.js` — a plain-JS kit junctioned into one machine's
`node_modules` and never a dependency of this project — so **collection** failed and no spec
in the suite could run. Its two methods now live in `tests/helpers/narrate.ts`. If you find
yourself reaching for an external kit in a spec, put it in `helpers/` instead: a spec that
cannot be collected is worse than one that fails.

### Ask the database for the rows you need — do not name them, and do not assume they exist

Three variants of the same mistake, all found on `myps_db_dev_200` on 2026-09-13, where the
sample fixture could not run and the module started empty:

- **`ls-module-ui-walkthrough`'s filter test searched for `'Demo pack'`** — the description the
  three migrated MyMYPS samples carry. On a database without them it matched nothing and failed
  on an empty table, for a reason unrelated to filtering. It now provisions the row it searches
  for and asserts every returned row is that row.
- **Its pager test topped up to ELEVEN projects** and then asserted page 2 holds **ten** rows
  that were not on page 1. Eleven satisfies the top-up and fails the assertion; it passed only
  where the database already held enough. Now twenty.
- **`ls-ownership` dropped the sweeper's marker.** `provisionLumpSum` writes
  `(e2e <ISO timestamp>)` into the Description, and the sweeper finds test data by that and
  nothing else — so an `UpdateLumpSum` that rewrites the Description must write it again. One
  did not, stranding a parent holding 200,000,000 of a program's allocation, which is exactly
  the figure other specs assert on. **If a spec rewrites a Description, keep the marker.**

A fourth, found 2026-10-20: **the pager test's last step searched for `RUN_TAG` but relied on
the filter test before it to have made the only row carrying it.** `RUN_TAG` is computed when
the file loads, so running the pager test alone (`-g`), or after the filter test failed
(Playwright restarts the worker and `RUN_TAG` changes), searched for a tag no row carried and
timed out on an empty table. It now provisions its own tagged row, after its paging
assertions, so the row cannot move page 1 or the cursor under them.

### The dashboard's Live DB switch

`FE/src/pages/Dashboard/Dashboard.tsx` exports `LIVE_DB_ENABLED`, and
`tests/dashboard-real-data.spec.ts` carries a constant that must track it — flip both together.
While it is false the Live DB control renders disabled, every section hook is routed to Demo
Data, and the live describe is skipped.

**History.** It was switched off on 2026-09-13 (maintainer's call) because the page then made one
`Dashboard/Summary` call that returned every visible project uncapped — on `myps_db_dev_200`
**56,722 rows, 33.5 MB, ~14 s** per load, for a watchlist that shows a handful. It was switched
back on on 2026-09-17, once that call was gone: the page now loads each section from its own
endpoint (`Kpis`, `Trend`, `BudgetBreakdown`, `Statuses`, `RegionalBreakdown`, `Projects`,
`Activities`, `Revisions`) only when the section is scrolled into view, aggregates are computed
in SQL, and the watchlist pages server-side. `Dashboard/Summary` still exists on the backend but
nothing on the page calls it. See `documents/plans/dashboard-modular-data-loading.md`.

The spec has two halves. The demo half runs regardless and asserts, above all, that Demo Data
issues **no** `/api/Dashboard/` request. The live half asserts eager KPIs, lazy loading, and
cross-endpoint reconciliation.

Three things the 2026-09-13 rewrite paid for, which still hold:

- **Prefer `waitForResponse` (or a URL-only `page.on('request')` count) over `captureApiCalls`.**
  That helper `await`s `response.json()` inside its handler and swallows what it throws; on the
  old 33.5 MB body it was slow enough to look exactly like "the button did nothing". Split
  responses are now a few KB, so the live half's existing use of it works, but do not reach for
  it on anything large.
- **Read payloads with `page.request`, not the `request` fixture.** The fixture has its own
  cookie jar, is not signed in, and answers 401.
- **Budget fetches against the timeout.** Clicking every fiscal-year button is sixteen rounds of
  lazy section loads; pick two or three years.

### Resolve the program, do not name it

`ls-module-ui-walkthrough`'s `create` step typed the literal string `'Trust Funds'` into the
program picker. That was correct when the sample data was Trust Fund; it stopped being correct
when TF-R ceased to be itemizable (2026-09-04) and the data moved to GAA-R, and this database
now has no Trust Funds program at all. The step failed on a 120s timeout — and because the
file is `mode: 'serial'`, it took **six** downstream tests with it: the detail page, the
edit-mode locks, replenish, the import dialog, the activity panel and delete-through-the-UI.
The module's entire UI action coverage was dark, and the suite still reported "1 failed".

It now calls `programOnStage(page, true)` from `helpers/lumpSumFixture.ts` — the same lookup
the fixtures use — and types whatever name comes back, asserting Start Year against that
program's own `StartYear` rather than a hard-coded 2025. **A spec should ask the database
which row to use, not assume one.** The option text is matched as a string rather than a
regex, because a program name is data and may contain metacharacters.

### Wait for the write, not for a word that contains it

The replenish step waited on `/Allocation raised|replenish/i`, then read the balance back.
The in-flight overlay says **"Replenishing..."**, which that pattern matches — so the wait was
satisfied by the spinner, the balance was read mid-request, and the assertion failed against
the pre-replenish total. It had never run, so nobody had seen it.

`ReplenishLumpSumDialog` calls `onClose()` only after the request resolves, so the dialog
disappearing IS the write having landed. The spec waits on that, then `expect.poll`s the
balance. Prefer a state the app only reaches after the work is done over any string that
merely mentions it — and never a pattern that a loading state also satisfies.

### An API spec must send what the UI sends

`UpdateLumpSum` writes whatever arrives, so a spec's payload is a write to real data — not
just an assertion. Three fields caught these specs out:

- **`ComponentId`** — send `'LS'`. `'LS1'` is the pre-migration value; sending it writes it
  back onto a parent.
- **`Year`** — round-trip the row's own year, don't send `new Date().getFullYear()`. The
  dialog pins it to the program's start year, and calendar-year rows drift out of range.
- **`StartDate` / `EndDate`** — round-trip them too. **Omitting them NULLs them**, and the
  Component Cost dialog then refuses to save that project until they are re-entered.
- **`UpdateProgramStage`'s `Name`** — send the program's name. The advance writes the new
  program revision with `Name = dto.Name`, so an advance without it **blanks the program's
  name**, and every later find-by-name misses it (program 71 on `myps_db_dpwh_2025`,
  2026-10-06). The UI's `nextStage` always sends it.

The rule generalises: if the form cannot produce a value, a spec should not send one.

### Cleanup is a globalTeardown, not an afterAll

`tests/helpers/lumpSumSweeper.ts` runs after the whole run — passed, failed or aborted —
and removes anything carrying the `(e2e <ISO timestamp>)` marker every Lump Sum fixture
writes into what it creates. The three migrated MyMYPS sample projects carry that marker
too and are **pinned by ProjectId so they survive**; sweeping them would quietly empty the
module.

`afterAll` is not enough on its own: a run whose first request times out against a cold
API abandons the file before reaching it. That happened twice on 2026-09-03 and both times
stranded a Lump Sum Project and its child. Orphans are not cosmetic — a stranded parent
holds part of a program's allocation, and these specs assert on allocation arithmetic.

**It does not need the FE dev server.** `FE/.env.development` points Vite's `/api` proxy
at a remote host, so a contract spec that relied on the proxy would silently test someone
else's database. It addresses the API directly instead, via `E2E_API_URL`
(default `http://localhost:5015`), and authenticates with `apiLogin()` rather than the
login form.

**A UI spec must point the proxy at the local API too**, or it drives the local browser
against a remote database. Pass the override to Vite rather than editing the tracked
`.env.development`:

```bash
cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort
```

**Expect `/auth/validate` 401s in the console on every page.** They fire before login and
are pre-existing app behaviour, unrelated to whatever a spec is testing — a spec that
asserts on console errors has to exclude them or it fails everywhere.

```bash
cd Main && ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5015 \
  dotnet run --no-launch-profile          # the API; no FE needed
cd e2e && npx playwright test ls-contract
```

**`workers: 1` is deliberate** — several Lump Sum specs itemize inside the same program,
and concurrently they deadlocked SQL Server on `UpdateProjectDetails`, which read as a
product bug and was not one. Kept at 1 until that is re-examined under snapshot isolation
(below).

**The local database must run `READ_COMMITTED_SNAPSHOT`.** Check with
`SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = 'myps_db_dev'` — it must
be 1; if not, run `Main/Resources/Internal/SQLScripts/LumpSum.Isolation.ReadCommittedSnapshot.sql`
once (it disconnects every session to do it, so with the API stopped). Without it every read
takes shared locks, and a read of one Lump Sum Project could be chosen as a deadlock victim
(error 1205, a 500) against the hard delete of a *different* one — six times in one day's logs
on 2026-09-06, always the read. The RCA is
`documents/docs/engineering/MYPS_LUMPSUM_DEADLOCK_RCA.md`; the views were also rewritten to
seek per project, and `ls-contract` has a race case (forty reads during five hard deletes) that
fails if the view rewrite and the isolation both regress — under snapshot isolation it cannot
see lock order, which is why a lock-first delete helper was tried and removed. If a run's API
log ever contains `1205` again, that is the first thing to check.

**Fixtures.** `provisionLumpSum()` makes each run its own parent: itemizing only ever
lowers an allocation and there is no un-itemize, so a spec pinned to a shared parent
passes once and fails every run after. `importChild()` is how a spec gets a parent with
children — **Mode 2 is gone**, so an existing project can never be attached; children can
only be created.

### The approval fixture program — `tests/helpers/approvedProgramFixture.ts`

An Approved program at GAA-R refuses creating and deleting a Lump Sum Project (2026-09-09), and
approving a program runs `dbo.pRecomputeProjectPublishable` over every project it holds —
which can demote real projects' publishability. So the approval specs never approve a program
`programOnStage` might hand to another spec. They flip a program of their own, named
**"E2E LS approval fixture"** (and a second one, "(GAA)", born at GAA for the "Approved off
the revision stage does not gate" pin), created once and found by name after that. It is
deliberately **never swept**: one row, named unmistakably.

**It cannot be created at GAA-R directly.** `AddProgram` writes `tProgramStages.StageName`
from the enum name (`"GAAR"`) while the table's foreign key is composite on
`(StageId, StageName)` against the lookup's `"GAA-R"`, so a direct create at any hyphenated
stage fails on the FK — a pre-existing defect in the Program module, the same `"GAAR"` vs
`"GAA-R"` class the gate itself avoids. Real programs reach GAA-R by advancing, so the fixture
is created at GAA, seeded with one Lump Sum parent (`UpdateProgramStage` refuses a program
with no projects), advanced, and the seed removed.

`withFixtureProgram(page, fn)` hands `fn` the program plus `approve()` / `restore()`, starts
it Working and always ends it Working. Provision **before** approving — `CreateLumpSum` is one
of the things approval refuses. `provisionLumpSum(..., { programPK })` targets it.

Two consequences for every other spec:

- `programOnStage` now **skips Approved programs and the fixture programs**. Without the
  first, a database whose first GAA-R program is Approved would fail every fixture and, in a
  serial file, every downstream test — for a reason unrelated to what they test. If *every*
  GAA-R program is Approved the helper throws and says so.
- The sweeper sets the fixture programs back to **Working before it sweeps**. A run that
  aborts while one is Approved would otherwise leave parents `DeleteLumpSum` refuses forever.

### The cross-stage fixture program — `tests/helpers/crossStageFixture.ts`

A project exists on two stages only after its program is **advanced**, and **a program past BP
can never be deleted**: `DeleteProgram`'s `StagesToCheck` guard refuses it, by design, and no
other endpoint removes one. So a spec that advances a program must not make a new one per run.
Before 2026-10-06 the cross-stage spec did, and stranded four programs on `myps_db_dev` and
one on `myps_db_dpwh_2025`. They are listed in the RCA. Like the approval fixture,
**"E2E batch delete/restore cross-stage fixture"** is created once, at BP with one ordinary
project, advanced to NEP, and found by name after that. Every run leaves it as it found it, and
`ensureCrossStageFixture` heals a run that died between its delete and its restore.
`programOnStage` skips it and the `e2e-crossstage-orphan-*` programs.

**The program has two identifiers, and the endpoints disagree on which one they want:**

| | Changes? | Wanted by |
|---|---|---|
| `ProgramPK` | Never | `ShowProjectsInProgram`. Its field is called `ProgramId`, but it is passed to `fProgramProjects`' `@ProgramPK` |
| `ProgramId` | **Regenerated on every stage advance** (`<host>_<MMddyyyy>_<HHmmss>` of the advance) | `BatchDelete`, `BatchAddExistingProject`, `UpdateProgramStage` (matched against `vProgramLatest.ProgramId`) |

The two are equal only until the first advance. **Re-read the program by `ProgramPK` after
every advance** (`advanceProgram` does). A spec that keeps the BP-era `ProgramId` passes only
when create and advance land in the same second. That is how the old spec passed on
`myps_db_dev` and failed on `myps_db_dpwh_2025`. The BP→NEP advance also rewrites each
project's id (`BP01000002LZ` → `P01000002LZ`, `GenerateProjec1stSegment`); `nepProjectId`
derives it.

**The opt-in rule #2 test guards a fixed defect; keep it strict.** It deletes project A at NEP,
advances the program to NEP-E, restores A, and expects A listed at NEP but not at NEP-E. On
`myps_db_dev` (2026-10-06) A was listed at NEP-E too, as a revision **created by the advance**
under its **BP-era id**: once A's NEP revision is flagged, `vProjectLatest` falls back to A's
still-live BP revision, and `UpdateProgramStage` copied every row `vProjectLatest` returned. Fixed
2026-10-20: the advance skips a project whose revisions at the stage being left are all deleted
(see the RCA); a project dropped by an earlier advance has no row at the next stage either, so it
is kept only if it is live at the stage being left or was never staged at all (a legacy import).
The test passes against the fix. Don't loosen the assertion if it fails again.
It sends `Category: 1` (`addOrdinaryProject`), which an API that refuses expired categories
(`ValidUntil` 2017) rejects with "Selected Category '1' is not valid"; point it at a category
that is still valid (17 works on `myps_db_dev`) when that happens.

### Row-level data security — `tests/ls-data-security.spec.ts`

`AssertLumpSumVisibleAsync` guards all 13 actions and, until this spec, had **never executed
once**: it returns early when the session's `ApplyFilter` is 0, and no user on a restored
`myps_db_dev` had it set. Every other spec runs as an Admin.

**It needs a fixture, and the fixture is not optional:**

```bash
sqlcmd -S 127.0.0.1 -d myps_db_dev -U sa -P <pw> -C \
  -i ../Main/Resources/Internal/SQLScripts/LumpSum.DataSecurity.Dev.sql
npx playwright test ls-data-security
```

It creates `e2elsdenied` (a regional office outside the program's DataSecurityGroup) and
`e2elsallowed` (Central Office, exempt structurally), and signs in with any password under
`PIS.BypassLogin`. It touches no existing row and refuses to run on a non-dev database.

**Two ways to write this kind of spec so it passes while proving nothing** — both were hit on
the first run, so check for them in anything similar:

1. **A user in the restricted group *and* any unrestricted group is not restricted.**
   `vUsers.ApplyFilter` is computed as *"no group of mine is unrestricted"*, so adding a
   restricted group to an existing account leaves it 0. The fixture puts each account in one
   group only, and the first test asserts the flag really came out 1.
2. **An ungranted group 403s at the permission filter before the guard runs.** A spec
   asserting "the restricted user is refused" passes on that, having tested nothing. So the
   fixture grants its group the 13 actions, and the spec asserts on the guard's **own words**
   (`You do not have access to this Lump Sum Project.`), failing loudly if it sees a 403
   instead.

The spec provisions its probe target as an admin and deletes it afterwards, because a missing
guard means the request that proves it deletes or mutates whatever it is aimed at.

**Two known gaps are carried as `test.skip` with their reasoning** rather than deleted:
`InitFilterLumpSum` names programs the user cannot see, and a Central Office user can *open* a
Lump Sum Project but not *list* it (the guard uses `fUserVisiblePrograms(UserId)`;
`ShowLumpSum` filters inline on `_Session.RegCode`, which is NULL for central users). Unskip
them when the behaviour is fixed.

**Still to do:** the same two accounts through the **UI** — a restricted user should find the
list empty and a deep link refused. That is part of the phase-4 spec work.

### Project view gate — `tests/project-visibility.spec.ts`

The gate is the "Project view gate" region of `Helpers/ProjectHelper.cs`; see
`documents/docs/engineering/PROJECT_VISIBILITY_RULE.md`. It is **per stage**: a stage is visible when its own DEO is
in the user's scope.

**Before it runs:** run `Main/Resources/Internal/SQLScripts/ProjectVisibility.Fixture.Dev.sql` against the API's
database. It creates these accounts, each in one real group:

| Account | Group | PlantillaOffice |
|---|---|---|
| `e2edpc` | DPC | OI122 Davao City DEO |
| `e2erpc` | RPC | OI246 Region XI |
| `e2eauc` | AUC | — |
| `e2edpcnoscope` | DPC | OI246, a region, which is wrong for DPC |

- OI122 is chosen because its projects move to OI3576 at GAA. `e2edpc` sees their early stages but not the later
  ones, while `e2erpc` sees all of them.
- The fixture refuses a non-local server.
- It **asserts** the real groups' grants instead of granting them.

**How it runs**
- **Self-skips** without `E2E_SQL_SERVER` / `E2E_SQL_DB`. Expected sets come from SQL, using the same stage-DEO
  expression as the gate.
- **The UI cases need Vite on the same API.** Their Lump Sum check matches `/api/lumpsum/` calls only: Vite's dev
  server also serves `/src/pages/LumpSum/*` modules, and a broader match is a false positive.

`ProjectVisibility.UserRoles.Dev.sql` is separate and is not a fixture. It sets real local accounts for manual
testing: asisjnt/yabutgj, caldokp/afundardb, ferrermaa/jopiojvc, and salaniokaes as Super Admin.
