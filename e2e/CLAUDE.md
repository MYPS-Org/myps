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

## Login flow

Use `login()` from `tests/helpers/auth.ts` — don't re-implement it inline in a spec:

```ts
import { login } from './helpers/auth';

await login(page); // uses E2E_USERNAME/E2E_PASSWORD env vars, falls back to testuser/password
```

It navigates to `/login`, fills `input#username` / `input#password`, clicks `Sign In`, and waits for the redirect to `/dashboard`. Credentials come from `E2E_USERNAME`/`E2E_PASSWORD` — set them in `e2e/.env` (see `.env.example`) or export them in the shell before running tests. Falls back to `testuser`/`password` if unset. Can also be overridden per-call: `login(page, user, pass)`.

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
| LumpSumList | `/lumpsum` | `pages/LSWallet/Views/LSWalletList` |
| AddWallet | `/lumpsum/add` | `pages/LSWallet/Views/AddWallet` |
| LumpSumDetails | `/lumpsum/:walletId` | `pages/LSWallet/Views/LSWalletDetail` |

All routes above are behind login (protected routes) — every spec needs `login(page)` before navigating to one.

## Coverage map

Update this table whenever a spec is added, removed, or renamed — it's the fastest way for a future session to see what still needs coverage.

| Route | Spec file | Covered? |
|---|---|---|
| ProjectList (`/projects`) | `tests/project-list.spec.ts` | Yes |
| AddProject (`/projects/addproject`) | `tests/project-form.spec.ts` | Yes |
| Dashboard | `tests/dashboard-real-data.spec.ts` | Yes |
| UserManagement | — | No |
| InfraManagement | — | No |
| ProgramList / ProgramDetails | — | No |
| ProjectDetails | — | No |
| RevisionList / RevisionView / RevisionDetails | — | No |
| ProjectGroupList / ProjectGroupDetails | — | No |
| Reports | — | No |
| Settings / CodeTables | — | No |
| LumpSumList / AddWallet / LumpSumDetails | — | No |

## Adding a new spec

1. Put it in `tests/`, named `<feature>.spec.ts`.
2. Start with `login(page)` from `helpers/auth.ts` (or a `test.beforeEach` if every test in the file needs it, see `project-list.spec.ts`).
3. Use `captureApiCalls()` if the test should assert on network activity.
4. Assert against visible text/role, per the [selector convention](#selector-convention) above — check the actual rendered copy in the relevant `FE/src/pages/**/Views/*.tsx` file rather than guessing.
5. Update the [coverage map](#coverage-map) above.
