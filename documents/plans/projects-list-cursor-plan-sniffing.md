# Plan: Stop Projects-list "Next" from timing out (cursor parameter sniffing)

Status: Implemented
Created: 2026-10-18
Source: Risk #1 from the fast-list review, investigated read-only on localhost `myps_db_migrated_uat` (2026-10-18).
Branch: `fix/projects-list-cursor-plan-sniffing`, cut from `main` (`d3d1845d`) so it can ship independently of the
project-visibility work.

## Context: what the checks found

**Check 1: the app's cached plan.**
- The only cached plan the app has for the unrestricted Next statement
  (`SELECT TOP (@__take) v.* FROM [vProjectLatest] AS v WHERE v.[Id] < @__cursor ORDER BY v.[Id] DESC`, app connection
  `set_options` 251) was **compiled for `@__cursor = 0`, `@__take = 11`**.
- "Ids below 0" is estimated at about 1 row, so the plan is nested loops throughout (every operator estimated at ~1
  row).
- It recorded one completed run at 16 ms. Aborted runs aren't recorded, which is why the three 90 s timeouts don't
  appear.
- Later calls with a real cursor (305877, which matches most of the 172k rows) **reused that 1-row plan** and
  nested-looped over the whole view. That's the timeout.
- **The poisoning call was my own test.** The first, buggy `nav.py` run sent `NextFilteredId: 0` while its enum codes
  were wrong.
- **The general risk is real anyway.** Whichever Next call compiles first after a plan-cache reset (SQL restart,
  memory pressure, statistics update) fixes the plan for everyone. A cursor near the oldest ids, for example a user
  paging near the end, estimates few rows and produces this same nested-loop plan, which then times out for typical
  cursors.
- The same statement in sqlcmd, compiled fresh for the real cursor, runs in 1.2–2.6 s.

**Check 2: is it pre-existing? (`main` built and run, 2026-10-18)**
- `main`'s API reproduced the timeout: Next and Page took ~91 s for e2eauc (AUC) and longboanak (Admin). The failing
  SQL in its log is identical to the feature branch's.
- `git diff main HEAD -- Helpers/CursorPagination.cs` removes 0 lines: `FilterDataCursor` is untouched, and the branch
  only adds a separate method.
- `main`'s `ShowProjects` sends unrestricted users (`ApplyFilter = 0`; both e2eauc and longboanak are 0) straight to
  `FilterDataCursor` over `vProjectLatest`, with no extra clause. That's the same SQL text.
- **Conclusion:** the bug is in existing code, and is not caused by either branch.

**Check 3: eviction (localhost, approved).**

| Phase | What was done | Result |
|---|---|---|
| A | Fresh plans with real cursors | Next / Previous / Page all 200 in 1.9–5.4 s |
| B | Evicted, then sent one Next with `NextFilteredId = 0` | That request got a 1.4 s "stale cursor" 400. The next real Next for e2eauc **and** longboanak took **91.3 s** (timeout), and the cache held a cursor-0 plan |
| C | Evicted, then warmed good plans | Localhost left with good plans |

**Exposure.** Every paginated list goes through `FilterDataCursor`'s cursor queries (Next, Previous, Page). The heavy
sources are where sniffing hurts most: `vProjectLatest` for unrestricted Projects, `fProgramProjects` and
`vProgramLatest`. The restricted Projects path no longer uses SQL paging, so it's immune.

## Goal

Cursor navigation (Next / Previous / Page n) on the Projects list can't be poisoned by whichever cursor value compiled
first. Unrestricted users page in about the same time as the first page.

## Acceptance Criteria

As an unrestricted user, I want to page through Projects without timeouts, whatever anyone paged before me.

- [ ] **Poison resistance.** Sequence: (a) a Next with `NextFilteredId = 0`; then (b) First → Next → Next → Previous →
      Page 3 for an unrestricted user (the Admin `E2E_USERNAME`, and e2eauc). Every response is 200 and arrives in
      ≤ 1.5 × the First-page time (~5 s locally); none times out.
- [ ] **Same results.** Same rows, totals and cursors as before the fix, for the same users.
- [ ] **No collateral regression.** No other `FilterDataCursor` caller changes behaviour or gets measurably slower,
      unless it opts in.
- [ ] **Recorded.** The finding and the fix are in `PROJECT_VISIBILITY_RULE.md` (or a short engineering note), and
      a regression spec covers the poison sequence.

## Approach (recommended: opt-in recompile for cursor fetches on heavy sources)

- **Add an optional `recompileCursorQueries` parameter to `FilterDataCursor`** in `Helpers/CursorPagination.cs`,
  default `false`, so every existing caller is unchanged.
  - When true and the fetch has a cursor predicate (Next / Previous / Page > 1), append `OPTION (RECOMPILE)` to the
    fetch SQL.
  - Each such call then gets a plan built for its actual cursor value; sniffing can't carry over.
  - The cost is one compile per cursor call (tens to low hundreds of ms for the view), against 2–90 s when a bad plan
    is reused.
- **`ShowProjects` (unrestricted path) passes `recompileCursorQueries: true`.**
- `ShowProjectsInProgram` and the Program list are **measured, not changed**: if they show the same poisoning, the
  same flag is a one-line opt-in later.

Not recommended now:
- **Option A** (page `tProjects` and hydrate for everyone, like the restricted path) is the better long-term speed fix
  (~1 s pages), but it changes the default path for every user; worth its own plan.
- **`OPTIMIZE FOR UNKNOWN`** gives one average plan, which can still be poor at the extremes.
- **Clearing the plan cache** hides the issue until the next poisoning.

## Tasks

### Implementation
0. `git checkout -b fix/projects-list-cursor-plan-sniffing main`.
1. Add `recompileCursorQueries` to `FilterDataCursor`, applied only to the fetch query with a cursor predicate. The
   count query has no cursor and is unaffected.
2. Pass it from `ShowProjects`' unrestricted call.
3. **Reproduce first, then fix.** With the API on :5015, evict only the poisoned plan (one `DBCC FREEPROCCACHE
   (<plan_handle>)`, localhost). Re-poison with a cursor-0 Next and show the timeout. Apply the fix and show the AC
   sequence passing.
4. Add `e2e/tests/project-list-cursor-paging.spec.ts` (`main` has no visibility spec). API level, as the Admin
   `E2E_USERNAME`: a cursor-0 Next first, then First → Next → Previous → Page. All are 200, each under 30 s (the
   timeout is 90 s), with the pages consistent.
5. Measure `ShowProjectsInProgram` and the Program list with the same poison sequence; record the results, and change
   nothing.

### Documentation
1. Add `documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md`: the evidence above, the fix, and how to
   check for it. (`PROJECT_VISIBILITY_RULE.md` isn't on `main`.)
2. Add a coverage row to `e2e/CLAUDE.md`.
3. This plan, saved as `documents/plans/projects-list-cursor-plan-sniffing.md`.

## Files / Components Touched
- `Helpers/CursorPagination.cs` (optional parameter; no change to existing behaviour)
- `WebAPI/Controllers/Projects/ProjectController.cs` (`ShowProjects`, unrestricted call only)
- `e2e/tests/project-list-cursor-paging.spec.ts` (new), `e2e/CLAUDE.md`,
  `documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md` (new)

## Risks / Open Questions / Assumptions
- **Merging with the visibility branches.** `feat/project-list-speed-restricted-users` changes the same
  `ShowProjects` method. Whichever merges second needs the flag kept on the unrestricted `FilterDataCursor` call.
- **Compile cost.** `vProjectLatest` is a large view; recompiling adds compile time per cursor call. Measure it. If
  it's high, fall back to option A for `ShowProjects`.
- **Localhost evidence only.** UAT and production plans and statistics differ, so the same poisoning may or may not
  have happened there. The fix makes it impossible either way.
- **Plan-cache eviction in step 3** is localhost-only and affects one plan. It isn't run anywhere else.

## Verification
- Run the AC sequence (poison, then all navigations) before and after the fix, timing each call.
- Run `project-visibility.spec.ts` (15 cases plus the new one) and `project-list`.
- Re-check the plan cache: with the fix, the cursor fetch shows recompiles and no reused low-estimate plan.

## Completion Log
Date: 2026-10-18
- Implementation:
  - **Branch:** `fix/projects-list-cursor-plan-sniffing`, cut from `main` (`d3d1845d`).
  - **The flag:** `FilterDataCursor` gained `recompileCursorQueries` (default `false`). When true it appends
    `OPTION (RECOMPILE)` to cursor fetches only; `ShowProjects` passes `true`.
  - **The bug was reproduced on `main` before the fix:** Next and Page timed out for AUC and Admin.
  - **After the fix:** the same poison sequence (evict, cursor-0 Next, then a real Next) gives 200 in 5.8 s / 6.9 s.
    All navigations take 1.7–5.3 s, and no cursor plan stays cached.
  - **Regression spec:** added `e2e/tests/project-list-cursor-paging.spec.ts`.
  - **Measured only, not changed:** the Program list (Next 0.04 s) and the Program details projects tab (Next 3.29 s
    on the largest program).
- Documentation: `documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md` (new); `e2e/CLAUDE.md` coverage
  row.
- Verification:
  - Main and the three test projects build.
  - `project-list-cursor-paging` passes.
  - `project-list` passes twice, with Vite pointed at the local API.
Deviations / flags:
  - The new parameter is placed **after** `ct` so existing positional callers keep compiling; every call site uses
    named arguments.
  - The new spec runs as the Admin `E2E_USERNAME`; the e2eauc fixture script isn't on `main`. e2eauc was checked by
    hand.
  - **Merge note:** `feat/project-list-speed-restricted-users` rewrites `ShowProjects`. Whichever merges second must
    keep `recompileCursorQueries: true` on the unrestricted `FilterDataCursor` call.
Files changed:
  - Code: `Helpers/CursorPagination.cs`, `WebAPI/Controllers/Projects/ProjectController.cs`.
  - Tests: `e2e/tests/project-list-cursor-paging.spec.ts` (new), `e2e/CLAUDE.md`.
  - Docs: `documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md` (new), this plan.

### Review follow-ups (2026-10-18, approved R1, R2, R3, R6, R8)
- **R1, cursor <= 0 is "missing".** `FilterDataCursor` treats `NextFilteredId` / `PreviousFilteredId` /
  `PageCursorId` <= 0 like null, so the request is rejected ("… is required …") before any SQL runs and can't compile
  a plan. The FE stops sending `?? 0` (`ProgramDetail.tsx`, `ComponentTargetsPanel.tsx`; the two request types are
  widened to `number | null`). `ShowProjectsInProgram` (`fProgramProjects`) also opts in to `recompileCursorQueries`.
- **R2, the spec can fail.** The opt-in case (`E2E_ALLOW_PLAN_EVICTION=1` + `E2E_SQL_*`) evicts the app's cursor
  plans, injects the cursor-0 Next plan through sqlcmd under the app's set_options (251), checks it is cached, then
  sends a real Next. Negative control: with `recompileCursorQueries: false` it failed with a 91.3 s timeout; with the
  fix it passes. A tiny *real* cursor (oldest Id + 1) was tried first as the poison and did **not** reproduce the bad
  plan (8.6 s), so injection is the only reliable trigger now that the API rejects cursor 0.
- **R3, timeouts are visible.** `SqlException` -2 is rethrown instead of becoming `Error<T>`, so the controller's
  `IMYPSExceptionHandler` logs it (`fail`, ErrorId, `SqlErrorNumber: -2`, method name). The client still gets 400,
  now `SqlServerFailure` with an ErrorId: the handler maps every error to 400 by design.
- **R6, tighter spec.** Cursor fetches must take < max(1.5 × first page, 10 s); it runs as `E2E_USERNAME` and e2eauc
  (skipped when the account is missing), skips below 31 visible rows, and checks that all three cursor fields reject 0.
- **R8.** `recompileCursorQueries` now sits before `ct` (every call site uses named arguments).
- **Verification:** Main builds; `project-list-cursor-paging` 3/3 with the opt-in (2 pass + 1 skip without it);
  `project-list` passes with Vite; FE `tsc -b` stays at the 21-error baseline (none in the touched files).
  `program-detail-batch-actions` "batch delete removes the row" fails at the delete-preview text **with and without**
  the FE change, so it is unrelated; the Program details table itself loads with null cursors.

