# Plan: Improve e2e Playwright Setup + Add e2e/CLAUDE.md Context File

Status: Implemented
Created: 2026-08-11
Source: User request — clean up current e2e test duplication and add a markdown context file so Claude has enough app context to write comprehensive Playwright tests without re-exploring FE/ each session.

## Context

The `e2e/` folder was recently scaffolded with `playwright.config.ts`, two spec files, and two helper files (`helpers/auth.ts`, `helpers/networkCapture.ts`). The specs don't actually use the helpers — each spec re-implements login and network-capture inline, with hardcoded credentials (`testuser`/`password`). There's also no `.gitignore` entry for the generated `playwright-report/`/`test-results/` folders (already untracked-but-present in git status), and no documentation of the app's routes/selectors/API surface for future test-writing sessions.

This plan fixes the immediate duplication/config gaps and adds a `e2e/CLAUDE.md` — modeled on the existing `FE/CLAUDE.md` — that documents how to run tests, the login flow, the full route inventory (pulled from `FE/src/components/Routes.tsx`), selector conventions actually used in this app (no `data-testid` attributes exist anywhere in `FE/src` — confirmed via grep — so tests rely on text/role selectors), and a coverage map of which routes have specs today vs. which don't. This turns `e2e/CLAUDE.md` into living context: as new tests get added, the coverage table is updated, so a future session can see at a glance what's covered and pick up where the last one left off.

## Acceptance Criteria

As a developer writing Playwright tests in this repo, I want the e2e specs to reuse shared helpers and a context file to describe the app's routes/selectors/coverage, so that new tests can be written faster and with less duplicated/rediscovered context.

- [ ] `project-form.spec.ts` and `project-list.spec.ts` import and use `login()` from `helpers/auth.ts` instead of inline duplicated login code
- [ ] Both specs use `captureApiCalls()` from `helpers/networkCapture.ts` instead of inline duplicated `page.on('requestfinished', ...)` blocks
- [ ] Test credentials are read from environment variables (with the current values as fallback defaults) instead of being hardcoded string literals in each spec
- [ ] `e2e/.gitignore` excludes `playwright-report/`, `test-results/`, and `node_modules/`
- [ ] `e2e/CLAUDE.md` exists and documents: how to run tests (`npm test`, `test:headed`, `test:report`), the login flow, the full route table from `Routes.tsx`, the selector convention actually in use (text/role-based, no `data-testid`), the API-capture helper pattern, and a coverage table (route → spec file → covered y/n)
- [ ] Root `CLAUDE.md` gets a one-line pointer to `e2e/CLAUDE.md` (mirroring the existing pointer to `FE/CLAUDE.md`) so it's discoverable
- [ ] Existing two specs still pass conceptually (same assertions/behavior, just de-duplicated) — no behavior change beyond removing duplication

## Approach

**1. De-duplicate specs onto existing helpers.**
`helpers/auth.ts` exports `login(page, userName, password)` — already matches what both specs need. `helpers/networkCapture.ts` exports `captureApiCalls(page, urlPatterns: string[])` which returns the same `ApiCallDetails[]` shape both specs build manually. Rewire both specs to call these instead of inlining the logic. Call `captureApiCalls` before navigation (it just registers a listener), same as the current inline `page.on(...)` placement.

**2. Env-based credentials.**
Add a small constant block (or reuse `helpers/auth.ts`) reading `process.env.E2E_USERNAME ?? 'testuser'` / `process.env.E2E_PASSWORD ?? '***REMOVED***'`. Keep it simple — no `.env` loader dependency needed since Playwright config already runs under Node; just reference `process.env` directly. Document the override in `e2e/CLAUDE.md`.

**3. `.gitignore`.**
Add `e2e/.gitignore` with `playwright-report/`, `test-results/`, `node_modules/`. (Root `.gitignore` already has generic `node_modules/`, but explicit local entries make `e2e/` self-documenting since it's a separate npm project.)

**4. `e2e/CLAUDE.md` — the context file.**
Structure mirrors `FE/CLAUDE.md`'s style (stack, conventions, tables) but for testing:
- How to run: `npm install`, `npm run install:playwright`, `npm test`, `npm run test:headed`, `npm run test:report`. Note `baseURL: http://localhost:8080` — FE dev server (`cd FE && npm run dev`) must be running first; no `webServer` auto-start is configured.
- Login flow: routes to `/login`, fills `#username`/`#password`, clicks `Sign In`, waits for redirect to `/dashboard`. Reference `helpers/auth.ts`.
- Selector convention actually in use: **no `data-testid` attributes exist in `FE/src`** (verified by grep) — tests use text (`text=...`) and role/text-based locators (`button:has-text(...)`). Note this as a known constraint/tech debt: if `data-testid` is added to FE components later, prefer it over text selectors since UI copy changes will break tests silently otherwise.
- API capture pattern: reference `helpers/networkCapture.ts`'s `captureApiCalls(page, urlPatterns)`, with the existing usage as the example.
- Full route table copied from `FE/src/components/Routes.tsx` (RouteName, path, page component) — 18 routes across Dashboard, Programs, Projects, Revision, Project Groups, Reports, Settings, LS Wallet.
- Coverage table: route/page → spec file → status. Today only `ProjectList` (`/projects`) and `AddProject` (`/projects/addproject`) have specs; everything else is "not covered yet" — this is the part future sessions update as they add specs.

**5. Root `CLAUDE.md` pointer.**
Add one line near the existing `See FE/CLAUDE.md for...` line: `See e2e/CLAUDE.md for Playwright test conventions and route/coverage context.`

No changes to `playwright.config.ts` itself — it's already reasonable (trace/video/screenshot on failure, HTML+list reporter, 120s timeout). Out of scope: adding new test specs for uncovered routes, `data-testid` additions to FE components, CI wiring — those are natural follow-ups the coverage table sets up but aren't part of this plan.

## Tasks

### Implementation
- Rewrite `e2e/tests/project-form.spec.ts` to use `helpers/auth.ts` login and `helpers/networkCapture.ts` captureApiCalls, with env-var-backed credentials
- Rewrite `e2e/tests/project-list.spec.ts` the same way
- Update `e2e/tests/helpers/auth.ts` if needed so credential defaults live in one place (optional small helper constants, only if it avoids re-duplicating the `process.env` fallback logic in both specs)
- Add `e2e/.gitignore`

### Documentation
- Create `e2e/CLAUDE.md` per the structure above
- Add one-line pointer to `e2e/CLAUDE.md` in root `CLAUDE.md`

## Files / Components Touched
- `e2e/tests/project-form.spec.ts`
- `e2e/tests/project-list.spec.ts`
- `e2e/tests/helpers/auth.ts` (maybe, minor)
- `e2e/.gitignore` (new)
- `e2e/CLAUDE.md` (new)
- `CLAUDE.md` (root, one line)

## Risks / Open Questions / Assumptions
- Assumes `testuser`/`password` remain valid fallback dev credentials — not touching actual test-account provisioning.
- Assumes FE dev server on port 8080 is started manually before running e2e tests (matches current `playwright.config.ts` — no `webServer` block to auto-start it). Not adding a `webServer` config since that's a behavior change beyond de-duplication scope; noted as a documented manual step instead.
- Route table in `e2e/CLAUDE.md` will drift as `Routes.tsx` changes over time — it's a snapshot, not generated. Acceptable since this mirrors how `FE/CLAUDE.md`'s DTO-limits table already works (manually maintained reference).
- No new test coverage is added in this plan — only infra cleanup + documentation. If the user wants actual new specs for uncovered routes, that's a follow-up `create-plan` pass using the coverage table this plan produces.

## Completion Log
Date: 2026-08-11
- Implementation: Rewired `project-form.spec.ts` and `project-list.spec.ts` to use `login()` from `helpers/auth.ts` and `captureApiCalls()` from `helpers/networkCapture.ts`, removing all duplicated inline login/network-capture code. Added `DEFAULT_USERNAME`/`DEFAULT_PASSWORD` exports to `helpers/auth.ts` (reading `E2E_USERNAME`/`E2E_PASSWORD` env vars, falling back to `testuser`/`password`) as `login()`'s default params, so specs no longer hardcode credentials and no per-spec env-fallback duplication was needed. Added `e2e/.gitignore` (`node_modules/`, `playwright-report/`, `test-results/`). Added `@types/node` to `e2e/package.json` devDependencies (needed for `process.env` typing in `auth.ts`; not in the original plan text but required to make the env-var change type-check) and ran `npm install` in `e2e/`, which also generated `e2e/package-lock.json`.
- Documentation: Created `e2e/CLAUDE.md` (run instructions, login flow, selector convention note — no `data-testid` in `FE/src`, API-capture pattern, full 21-route table from `Routes.tsx`, coverage map, add-a-spec checklist). Added one-line pointer to it in root `CLAUDE.md`.
Deviations / flags: (1) Added `@types/node` devDependency — not called out in the original plan, needed for `process.env` to type-check in `auth.ts`. (2) Route table has 21 entries, not the ~18 estimated in the plan text (exact count wasn't critical to the AC). (3) `e2e/playwright-report/index.html` is already tracked in git from before this change (pre-existing, not introduced by this session) — the new `.gitignore` prevents it from being an issue going forward but does not untrack the existing committed copy; flagged to the user, no action taken since untracking is outside this plan's scope and mildly destructive (`git rm --cached`).
Verification: `npx playwright test --list` (from `e2e/`) resolves both specs through the new helper imports with no compile errors — confirms the de-duplication works. Did not run the full suite end-to-end since it requires the FE dev server running on port 8080 and a live backend/test account, which is outside this session's scope.
Files changed: `e2e/tests/project-form.spec.ts`, `e2e/tests/project-list.spec.ts`, `e2e/tests/helpers/auth.ts`, `e2e/package.json`, `e2e/package-lock.json` (new), `e2e/.gitignore` (new), `e2e/CLAUDE.md` (new), `CLAUDE.md` (root)
