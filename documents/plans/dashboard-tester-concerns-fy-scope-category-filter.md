# Plan: Dashboard tester concerns: FY scope, region resolution, category filter

Status: Implemented
Created: 2026-10-14
Source: `myps_concerns.docx` (7 tester concerns, screenshots SS1 to SS5), plus the user's added request for a Category filter next to the year switcher.

## Context

QA tested the Dashboard against the live DB and raised 7 concerns. Investigation against `myps_db_dev` (localhost, read-only queries) found four root causes behind them:

| # | Concern | Root cause (verified) |
|---|---|---|
| 1 | FY2026 card shows ₱10M; the only project costs ₱30M (SS1) | P01093001LZ has an **approved formal revision** (RO+CO, detail 1) that raised its cost to ₱30M. `vProjectLatest.Source = 'Revision'` and Program Cost = ₱30M, but `DashboardController.GetYearCostRows` always sums the **base** `tProjectComponentCost*` rows (₱10M). |
| 2 | FY2025 outlays list 2024 programs at ₱0 / 0%, plus RBP/RDIP/PIP (SS2) | FY scope is "cost-row year = FY" only. Multi-year projects in **2024 programs** leak in with tiny 2025 slices. **Planning stages** (RBP/RDIP/PIP, StageHierarchy < 1) are counted as budget: FY2025 is ₱3.34T in total, but only ₱1.33T once planning stages and other-year programs are dropped (FY2024: ₱11.24T vs ₱1.34T). |
| 3 | "Relative Volume Density" is the wrong term | Label in `DashboardTrajectoryChart.tsx:216`. |
| 4 | Map doesn't update on live DB (SS3: Luzon 0%, Visayas 0%) | `tProjectRevisions.Region` is **blank for 113k of 121k projects**. Where it is set, it **contradicts the province in 8,445 of 8,463 cases** (e.g. 7,683 Luzon projects such as EDSA tagged `OI249` BARMM). `Province` (by `tOptionAdminAreaProvince.Code`) resolves 98.8% of projects, and its island matches the project-ID suffix (LZ/VS/MN) in more than 99.9% of them. |
| 5 | Annual Budget bars not interactive like the Projects chart | `DashboardCharts.tsx` bars only hover. They have no click handler and are not keyboard reachable. Live LS Itemized is also hard-coded to `0` in `Trend`. |
| 6 | Island-group cards don't update (SS4: 92% "Unassigned") | Same as #4. |
| 7 | "8460 Regions?" label; what is the Live Audit Feed? (SS5) | The watchlist shows the **project** total labelled as "Regions". The feed lists the 12 latest project edits; **the user decided to remove it**. |

User decisions (asked this session):
- FY scope applies to the **whole dashboard**: only programs whose `StartYear` = FY, cost rows of that FY, and **only the budget stages BP, NEP, NEP-E, HGAB, HGAB-I, GAA, GAA-R, TF, TF-R** (an allow-list from `tOptionProgramStage`; the planning stages RBP/RDIP/PIP and any unstaged/unknown stage are excluded). The user confirmed this by highlighting those nine rows.
- New **Category** filter = project category (`tOptionProjectCategory`) as a **3-character server-side autocomplete** (the user's pick-list rule).
- **Remove** the Live Audit Feed.

## Acceptance Criteria

As a DPWH executive user, I want every dashboard figure to count the selected fiscal year's actual budget programs, with correct locations and an optional category filter, so that the dashboard matches the Programs module and can be trusted for FY decisions.

- [ ] AC1: Live DB, FY2026: the FY Infrastructure Budget card and its modal show **₱30,000,000.00** for P01093001LZ, which is the approved-revision amount.
- [ ] AC2: Live DB, FY2025: Total Program Outlays lists only programs with `StartYear = 2025`, and only projects at the allow-listed budget stages (BP, NEP, NEP-E, HGAB, HGAB-I, GAA, GAA-R, TF, TF-R). Nothing at RBP, RDIP, PIP or unstaged appears, and no 2024 program appears. The Project Stages panel shows only allow-listed stages.
- [ ] AC3: For any FY and category, the KPI total budget = outlays total = island total = regional total, and the project counts agree across those sections. The reconciliation in `dashboard-real-data.spec.ts` passes.
- [ ] AC4: The trajectory chart footer reads "Relative Project Count (Max: N)". "Relative Volume Density" no longer appears anywhere.
- [ ] AC5: On the Live DB map (FY2025), Luzon, Visayas and Mindanao all show non-zero shares, and NCR, Northern Luzon and Southern Luzon tables list their regions. A project is attributed to its province's region. EDSA and Bicutan–Alabang projects appear under NCR, not BARMM.
- [ ] AC6: The island-group cards show the Luzon, Visayas and Mindanao groups ("Unassigned" only for unresolvable projects, about 1% locally). Clicking a group filters the watchlist to a non-empty list of that island's projects.
- [ ] AC7: Clicking an Annual Budget bar, or pressing Enter or Space on it, selects that FY for the whole dashboard. Its tooltip appears on hover and on focus. LS Itemized shows real per-year Lump Sum itemization in Live DB.
- [ ] AC8: Watchlist counts say projects, e.g. "Mindanao Island Group (8,460 projects)", and "Showing 10 of 8,460 projects". "Regions" no longer labels a project count.
- [ ] AC9: The Live Audit Feed panel is gone, the page sends no `/Dashboard/Activities` request, and the endpoint no longer exists. The watchlist uses the full width.
- [ ] AC10: Category autocomplete: below 3 characters it lists nothing, sends no query, and shows "Type at least 3 characters to see matches." From 3 characters it shows at most 8 matches. It says when nothing matches and ignores stale responses. The selected category shows as a clearable chip, and "All categories" is the empty state. The control is disabled in Demo Data.
- [ ] AC11: A selected category narrows KPIs, outlays, trend, trajectory, map, islands, stages, watchlist, KPI modal lists, Lump Sum and the revision queue. Clearing it restores the unfiltered figures.
- [ ] AC12: Demo Data behaviour is unchanged and still issues zero `/api/Dashboard/` requests.
- [ ] AC13: `dotnet build` succeeds, `FE npm run build` succeeds, `eslint` is clean on the touched dashboard files, and `e2e/tests/dashboard-real-data.spec.ts` passes against local Live DB.

## Approach

### Backend: one shared scoped cost-row source (`DashboardController.cs`)

Every aggregate already flows through `GetYearCostRows` (`DashboardController.cs:1048`). It is rebuilt so that the fixes apply everywhere at once:

1. **Scope** (`DashboardScope { Year, CategoryId? }`):
   - Visible projects (existing `GetVisibleProjects`).
   - Joined to `tPrograms` with `StartYear == Year` and `!IsDeleted`.
   - Only projects at a stage in the allow-list `BudgetStageNames = { "BP", "NEP", "NEP-E", "HGAB", "HGAB-I", "GAA", "GAA-R", "TF", "TF-R" }` (`tOptionProgramStage.Name`) are counted. This is a named constant with a comment: RBP, RDIP and PIP are planning proposals, not appropriations. An allow-list also keeps out unstaged rows and any stage added later until someone decides about it.
   - `project.Category == CategoryId` when set.
   - Cost rows with `Year == program StartYear`.
2. **Effective cost source** (concern 1). The base branch takes projects with `Source != "Revision"`, joined to `tProjectComponentCost` and `tProjectComponentCostPerYear` (as today). The revision branch is driven from a small `GetEffectiveRevisions()` query that mirrors `dbo.fProjectEffectiveRevision`:
   - It takes the latest `tRevisionDetails.Id` per project that has a non-deleted snapshot and approvals `RO Status=1` and `CO Status=1`. `UQ_tRevisionApprovals_Level` makes the two `EXISTS` checks equal `IsFullyApproved`.
   - It joins `tRevisionProjectComponentCost` and `tRevisionProjectComponentCostPerYear`.
   - The two branches are combined with `Concat` (UNION ALL). A project is in exactly one branch, so `COUNT(DISTINCT ProjectPK)` stays exact.
3. **Region resolution** (concerns 4, 6, 7). Each row carries `RegionCode`: the region of the project's province, `tProjectRevisions.Province` → `tOptionAdminAreaProvince.Code` → `RegionParticipantId` (→ `tOptionAdminAreaRegion` for name and IslandCode).
   - *Amended during implementation, per the user's explicit instruction:* province is the **only** source. There is no implementing-office or stored-Region fallback, and the province is read from `tProjectRevisions` for revised projects too.
   - A project whose province matches nothing has no region and shows as Unassigned (301 projects in FY2025 locally).
   - Lookup keys were checked unique. Existing helpers `GetRegionsByCodeAsync`, `IslandName`, `RegionDisplayName` are reused unchanged.
4. **Endpoints**:
   - `Kpis`, `BudgetBreakdown`, `Statuses`, `RegionalBreakdown` and `Projects` (`PageProjectsAsync`) read the new rows.
   - In `PageProjectsAsync`, the island, status and search filters move onto rows, and grouping is by `{ProjectPK, RegionCode}`. The existing page/detail/funding logic stays.
   - `Trend` uses the same rows across all years (cost year = program year). It adds real `LsItemized` per `StartYear` from `vLumpSumSet` and `vLumpSumBalance`, with the same fallback as `LoadLumpSumProjectsAsync`.
   - `LumpSum` and the KPI LS figures apply the category filter and the budget-stage allow-list to `GetVisibleLumpSumSet`.
   - `Revisions` takes an optional body `{ CategoryId }` and keeps queue rows whose project has that category. The queue stays not FY-scoped, as before.
   - `ResolveYearAsync`: `AvailableYears` becomes the distinct `StartYear` of non-deleted programs, which is cheap and matches "FY = program year".
5. **New** `Categories` action: POST `{ Query }` returns at most 8 `{ CategoryId, CategoryName }`, ordered by name.
   - Below 3 characters it returns only an exact, case-insensitive name match, so short names stay findable.
   - It searches all `tOptionProjectCategory` rows, inactive ones included, so historical FYs can be filtered.
   - The limits are constants `CategoryMinQueryLength = 3` and `CategoryMaxMatches = 8`.
6. **Remove** the `Activities` action, `GetRecentActivitiesAsync` and `DashboardActivitiesResponseDTO`. `Summary` and its `GetActivitiesAsync` stay; it is the legacy endpoint with no FE caller.
7. **DTOs**: `CategoryId` (int?) is added to `DashboardRequestDTO` and `ShowDashboardProjectsDTO`. A new `DashboardCategorySearchDTO` / `DashboardCategoryDTO` is added.

### Frontend (`FE/src/pages/Dashboard/`)

- **Category filter component** `components/DashboardCategoryFilter.tsx`:
  - The shared `components/tailwindui/combobox.tsx` lists every option with no threshold, so it fails the pick-list rule and is not reused.
  - The new component is an input with a 250 ms debounce. It sends no request below `PICK_LIST_MIN_CHARS` and shows at most `PICK_LIST_MAX_MATCHES` results.
  - It drops stale responses with a request-id ref, the same pattern as `useSectionData`.
  - It is keyboard navigable (arrow keys, Enter, Escape), with the combobox/listbox ARIA roles.
  - The selected category shows as a chip with a clear button. It is styled for the dark header and placed beside the year switcher in `Dashboard.tsx`.
  - Constants live in `FE/src/utils/pickList.ts` (no `constants` folder exists; `utils` holds the shared helpers).
- **Plumbing**:
  - `Dashboard.tsx` holds `selectedCategory`; the effective `categoryId` is `null` in Demo Data.
  - `useSectionData` gains `categoryId`. The cache key becomes `${mode}:${year}:${categoryId ?? 'all'}`, through `sectionCacheKey`.
  - Each section hook passes `categoryId` on.
  - `Service.ts` fetchers send `{ Year, CategoryId }`. `fetchDashboardRevisions` sends `{ CategoryId }`. A new `searchDashboardCategories(query)` is added.
  - The watchlist and the KPI modal pass `categoryId` to `fetchDashboardProjects`.
- **Concern fixes**:
  - `DashboardTrajectoryChart`: the label becomes "Relative Project Count".
  - `DashboardCharts`: each year column becomes a `<button>` with an `onSelectYear` prop. Dashboard passes `setSelectedYear`. The tooltip shows on hover and focus, and the button gets an `aria-label` with the figures.
  - `DashboardProjectWatchlist`: project-count wording, `toLocaleString()`, the empty-state text, and the search placeholder "Search project or region...".
  - `DashboardMacroBudget` live subtitle and the KPI modal "Calculation Methodology" text explain the new scope rule.
- **Remove the feed**: delete `components/DashboardActivityFeed.tsx`, `hooks/useDashboardActivities.ts`, `activitiesCacheAtom` and `fetchDashboardActivities`, plus the benchmark `Activities` data and its field if nothing else reads it. The watchlist becomes full width.

## Tasks

### Implementation
1. Backend DTOs: `CategoryId` on the request DTOs; category search DTOs; remove `DashboardActivitiesResponseDTO`.
2. Backend building blocks:
   - `DashboardScope`, `BudgetStageNames`, `GetEffectiveRevisions()`.
   - The rebuilt `GetYearCostRows`/`GetCostRows`, which handle base plus revision rows, resolve `RegionCode`, and apply the program-year, budget-stage allow-list and category filters.
   - Per-endpoint wiring (Kpis, BudgetBreakdown, Statuses, RegionalBreakdown, Trend including LS itemized, Projects, LumpSum, Revisions).
   - `ResolveYearAsync` switched to program years.
3. Backend: the `Categories` search action; remove `Activities` and `GetRecentActivitiesAsync`.
4. Verify the SQL against local `myps_db_dev`:
   - EF translation of `Concat` + `GroupBy` + left joins. If EF cannot translate it, fall back to two grouped queries merged in memory.
   - Expected figures: FY2026 = ₱30M; FY2025 ≈ ₱1.33T before the category filter.
   - Endpoint timings no worse than today's for Kpis and BudgetBreakdown.
5. FE plumbing: the `pickList` constants, `Service.ts`, `useSectionData` and the cache key, the section hooks, and the watchlist and KPI modal category passthrough.
6. FE: `DashboardCategoryFilter` component and the header placement (disabled with a tooltip in Demo Data).
7. FE concern fixes: trajectory label, clickable/keyboard trend bars, watchlist wording, methodology and subtitle copy.
8. FE: remove the activity feed (component, hook, atom, service function, layout).
9. e2e `dashboard-real-data.spec.ts`:
   - Drop `Activities` and the feed-tab clicks.
   - Assert trend years ⊆ available years.
   - Add the category picker test: no request and a hint at 2 characters; matches at 3 or more; choosing it refetches Kpis with `CategoryId`; clearing it refetches without.
   - Add a bar-click test: it selects the FY.
10. `MYPS.ApiIntegrationTests`: a reflection contract test that `Categories` is `[HttpPost]`, that `Activities` is gone, and that the request DTOs expose `CategoryId`.

### Documentation
11. `FE/UserManual.md` §5.1 Dashboard: replace the stale user-info panel description with the current sections, the FY scope rule (program year, the nine budget stages only, approved revisions count), the Category filter, and the removal of the feed.
12. `documents/UserManual_Changelog.md`: an entry for the §5.1 change, using the `update-manual-changelog` skill's format.
13. Write this plan to `documents/plans/dashboard-tester-concerns-fy-scope-category-filter.md`. Add a data-quality note: `tProjectRevisions.Region` contradicts Province on about 8.4k migrated rows. A follow-up **backfill (not executed)** would also unblock editing those projects, because the form's Province-in-Region validation rejects them today.

## Files / Components Touched
- `WebAPI/Controllers/Dashboard/DashboardController.cs`, `DTODashboard.cs`
- `FE/src/pages/Dashboard/Dashboard.tsx`, `Service.ts`, new `hooks/usePinnedHeader.ts`; `FE/src/hooks/usePagination.ts`; `FE/src/components/tailwindui/sidebar-layout.tsx`, `atoms/dashboardSectionCache.atom.ts`, `hooks/useSectionData.ts`, and every `hooks/useDashboard*.ts`
- `FE/src/pages/Dashboard/components/`: `DashboardCharts.tsx`, `DashboardTrajectoryChart.tsx`, `DashboardProjectWatchlist.tsx`, `DashboardMacroBudget.tsx`, `DashboardKpiDetailModal.tsx`, new `DashboardCategoryFilter.tsx`; delete `DashboardActivityFeed.tsx`, `hooks/useDashboardActivities.ts`
- New `FE/src/utils/pickList.ts`
- `e2e/tests/dashboard-real-data.spec.ts`; new `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`
- `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/…`

## Risks / Open Questions / Assumptions
- **Semantics change (user-approved)**: totals drop sharply (FY2025 ₱3.34T → ~₱1.33T) because planning-stage proposals, unstaged rows and other-year programs no longer count. Testers should expect this.
- **Not identical to Program Details Cost**: the dashboard uses "cost year = program year" over the allow-listed stages. `pRecomputeProgramCost` also counts single-year projects scheduled in another year, and excludes projects left at earlier stages. The stored `tProgramRevisions.Cost` is also inconsistent in this DB (e.g. a negative value), so it was not adopted.
- **EF translation and performance**: UNION ALL over `vProjectLatest` (which CROSS APPLYs `fProjectEffectiveRevision` per project). The revision branch is driven from the tiny effective-revision set so SQL can seek. The two-query merge is the fallback. Task 4 measures it.
- The snapshot has no unique index per revision detail, so the province is read as the first non-deleted snapshot row.
- `Summary` (legacy, no FE caller) keeps the old rules. Retiring it is recommended as a follow-up.
- No data is modified. All DB access in this work is read-only `SELECT`.

## Verification
- Run `dotnet build project_myps.sln`.
- Start the API via `run-api.ps1` against local `myps_db_dev` and the FE with `npm run dev`.
- In e2e, run `npx playwright test tests/dashboard-real-data.spec.ts`. It covers the endpoint reconciliation (AC3), the category picker (AC10, AC11), bar click (AC7), no Activities call (AC9) and the Demo Data no-query check (AC12).
- Compare by hand with SQL (`SELECT` only): FY2026 KPI = ₱30M (AC1); FY2025 outlay program list ⊆ StartYear 2025 and allow-listed stages only (AC2); island split ≈ the province-derived split (AC5, AC6).
- Run `FE npm run build` and `npx eslint src/pages/Dashboard`.
- Visual spot-check of SS1 to SS5 screens in the browser.

## Completion Log
Date: 2026-10-14

### Implementation
All 10 implementation tasks are done.

Backend (`DashboardController.cs`, `DTODashboard.cs`):
- Every aggregate reads `GetCostRowsAsync`: the year's programs and cost year, the nine budget stages, the category, approved formal revisions at their revised amount, and the region from the province.
- `Trend` carries real `LsItemized`. `LumpSum`/KPI LS follow the category and stage allow-list. `Revisions` takes `CategoryId`.
- `AvailableYears` = program years.
- New `Categories` search action. `Activities` and `GetRecentActivitiesAsync` were removed.

New helper `DashboardPageMerge.cs`:
- The watchlist pages the unrevised projects in SQL and merges the few revised projects into the page in memory.

Frontend:
- `categoryId` is threaded through `useSectionData` (cache key `mode:year:category`), every section hook, `Service.ts`, the watchlist and the KPI modal.
- New `DashboardCategoryFilter` autocomplete with constants in `utils/pickList.ts`.
- Annual Budget bars are buttons that select the FY.
- Labels changed:
  - "Relative Volume Density" became "Relative Project Count".
  - Watchlist counts read as projects.
  - Methodology and subtitle copy updated.
- Live Audit Feed removed: component, hook, atom, fetcher and demo data. The watchlist is full width.
- The header lost `overflow-hidden`, which clipped the autocomplete list.

Tests:
- `MYPS.UnitTests/DashboardPageMergeTests.cs`: 7 tests passed.
- `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`: 5 tests passed.
- `e2e/tests/dashboard-real-data.spec.ts` updated: Activities removed; new category-autocomplete and bar-click tests. 8 of 8 passed in Chrome against `myps_db_dev`.

### Verification (local `myps_db_dev`)
- AC1: FY2026 = P599,829,401,000, including P01093001LZ at its approved P30,000,000.
- AC2: FY2025 outlays list 15 programs, all StartYear 2025, none at a planning stage.
- AC3: KPI = outlays = islands = regions = watchlist = trend = P1,333.062B / 34,010 projects. With category OO1 (16), all equal P374.867B / 6,459.
- AC5/AC6:
  - Islands: Luzon 63.9%, Visayas 15.6%, Mindanao 19.0%, Unassigned 1.5%.
  - The Luzon filter lists 20,006 projects.
  - EDSA and Bicutan-Alabang projects are under National Capital Region.
- Builds and lint:
  - `dotnet build` passes.
  - `vite build` passes.
  - `eslint` on the touched files shows 0 errors.
  - `npm run build` cannot pass because of 21 existing type errors in `src/pages/Rbac/*`, which this work does not touch. `tsc` reports no error in any Dashboard file.

### Documentation
- `FE/UserManual.md` section 5.1 rewritten; version bumped 3.11 -> 3.12 with a revision-history row.
- `documents/UserManual_Changelog.md`: v3.11 -> v3.12 entry added.
- XML doc comments on the new query building blocks record why each shape was chosen.

### Deviations / flags
- **Region source:** province only, per the user's mid-implementation instruction. The office and stored-Region fallbacks were dropped (see Approach 3).
- **Stage rule:** an allow-list of the nine budget stages, per the user, rather than an RBP/RDIP/PIP deny-list. Unstaged projects are excluded too.
- **Performance work beyond the plan, all measured on `myps_db_dev`:**
  - The aggregates avoid `vProjectLatest` columns that depend on its per-project `fProjectEffectiveRevision` CROSS APPLY. Category, ID and description are read from the base revision row.
  - The trend groups by {program year, cost year} and keeps the equal pairs in memory. Comparing the two years in SQL produced a 34-89 s plan.
  - The base-branch exclusion is `NOT EXISTS` against `tRevisionDetails`, and the province filters are table subqueries. The OPENJSON list forms produced plans 4-7x slower.
  - The watchlist keeps the revised projects out of its SQL (see `DashboardPageMerge`).
  - Warm timings for FY2025, before -> after:

    | Query | Before | After |
    |---|---|---|
    | Kpis | 0.8 s | 1.1 s |
    | Outlays / regions | 0.7-0.9 s | ~1.0 s |
    | Statuses | 2.2 s | 1.0 s |
    | Trend | 1.3 s | 1.5 s |
    | Watchlist | 4.0 s | 3.0 s |
    | Search | 6.7 s | 2.7 s |
    | Luzon filter | 2.4 s | 5.0 s |

    The old Luzon figure covered only the 14 projects whose stored Region was set; the new one ranks 20,006.
- **Constants location:** `FE/src/utils/pickList.ts`, not `FE/src/constants/`.
- **Category search:** the FE sends no request below 3 characters. The backend's exact-match path for shorter names stays as a safeguard; no category name is shorter than 3 characters today.
- **`Summary` endpoint (legacy, no FE caller):** still uses the old rules, apart from the Lump Sum stage/category filter it shares. Retiring it is recommended.
- **Data quality, not changed:**
  - `tProjectRevisions.Region` contradicts Province on about 8.4k migrated rows (e.g. NCR projects stored as BARMM), and is blank on about 113k.
  - The project form's Province-in-Region validation will reject editing those rows until they are backfilled.
  - A backfill (`UPDATE ... SET Region = the province's RegionParticipantId`) is recommended. It was not run.
- **e2e safety:** `e2e/playwright.config.ts`'s `globalTeardown` (`lumpSumSweeper.ts`) calls `DeleteLumpSum` / `DeleteItemizedProject` against the API it targets. For verification it was disabled through a scratch config, and Chrome was used via `channel: 'chrome'`. The user may want that teardown gated behind an explicit flag.


### Addendum — 2026-10-14, user follow-up requests
**Requests:** "list these category lists in the dropdown the moment the user cursor is in this textbox", and "upon scrolling down, please freeze this part".

**Category picker:**
- Focusing the box lists all 33 categories, loaded once. Typing narrows the list in the browser with no further request.
- Inactive (retired) categories carry an "Inactive" badge.
- This deliberately replaces the 3-character / 8-match autocomplete rule for this one control: the list is short and fixed, and the user asked for it. The component's header comment says so, so it isn't "fixed" back.
- `Categories` returns every category when the query is empty, with no cap, and adds `IsActive`.
- `CategoryMinQueryLength` / `CategoryMaxMatches` and `FE/src/utils/pickList.ts` were removed. The contract test now pins `DashboardCategoryDTO.IsActive` instead of the limits.

**Pinned header:**
- New `hooks/usePinnedHeader.ts`. CSS `sticky` cannot work here: `SidebarLayout` wraps pages in an `overflow-auto` box that never scrolls.
- So the header switches to `position: fixed` under the app's top bar, which is tagged `data-app-navbar` in `components/tailwindui/sidebar-layout.tsx` (attribute only).
- A zero-height marker in its place gives the left edge and width, and a spacer keeps the page from jumping.
- Pinned, it is one compact row: "Viewing FY \<year\>", data-source badge, Live DB/Demo, Category, years, Refresh. The title, theme toggle and Project Repository button are hidden.

**Shared fix:**
- `FE/src/hooks/usePagination.ts` now applies only the newest request's response.
- A trace showed the watchlist's older category request still in flight when a clear's request was sent. Whichever finished last would have been shown.
- This is a shared hook, so the guard benefits every paginated list.

**Verification:**
- `dotnet build` passes. Dashboard contract tests: 5 of 5 pass.
- `tsc` reports no error outside the existing `pages/Rbac` errors. `eslint` reports no new errors; the 2 `prefer-const` errors in `sidebar-layout.tsx` and the `usePagination.ts` deps warnings predate this change.
- e2e `dashboard-real-data.spec.ts`: 9 of 9 pass in Chrome, including:
  - the new focus-lists-everything / type-narrows test;
  - the pinned-header test (pinned after scrolling, unpinned at the top).
- Screenshots checked: light, dark, and an 820 px-wide window. At that width the pinned bar wraps to three rows.

**Docs:** manual §5.1 (v3.12) and its changelog entry updated in place: the Category row, new step 7, and the Common Outcomes row for fewer than 3 characters removed.

### Files changed
- `WebAPI/Controllers/Dashboard/DashboardController.cs`, `WebAPI/Controllers/Dashboard/DTODashboard.cs`, new `WebAPI/Controllers/Dashboard/DashboardPageMerge.cs`
- `FE/src/pages/Dashboard/Dashboard.tsx`, `Service.ts`, new `hooks/usePinnedHeader.ts`; `FE/src/hooks/usePagination.ts`; `FE/src/components/tailwindui/sidebar-layout.tsx`, `atoms/dashboardSectionCache.atom.ts`, `hooks/useSectionData.ts`, `hooks/useDashboard{BudgetBreakdown,Kpis,LsProjects,RegionalBreakdown,Revisions,Statuses,Trend}.ts`
- `components/DashboardCharts.tsx`, `DashboardKpiDetailModal.tsx`, `DashboardMacroBudget.tsx`, `DashboardProjectWatchlist.tsx`, `DashboardTrajectoryChart.tsx`, new `components/DashboardCategoryFilter.tsx`
- Deleted: `components/DashboardActivityFeed.tsx`, `hooks/useDashboardActivities.ts`
- `e2e/tests/dashboard-real-data.spec.ts`; new `MYPS.UnitTests/DashboardPageMergeTests.cs`; new `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`
- `FE/UserManual.md`, `documents/UserManual_Changelog.md`, this plan file
