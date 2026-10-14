# Plan: Dashboard region order, Luzon sub-group amounts, trend values, category breakdown

Status: Implemented
Created: 2026-10-14
Source: User request with three screenshots (region map tables, Annual Budget & Lump Sum Itemization Trend, Project Stages box).

## Context

Five follow-ups on the Dashboard:
1. **Region order.** The region tables beside the map are in budget order. The user wants a fixed order:
   - Southern Luzon: IV-A, MIMAROPA, V
   - Northern Luzon: CAR, I, II, III
   - Visayas: NIR, VI, VII, VIII
   - Mindanao: IX, X, XI, XII, XIII, BARMM

   They asked whether `tOptionAdminAreaRegion.Hierarchy` can drive it.
2. **Luzon sub-group amounts.** Northern and Southern Luzon show only a %; the user wants the amount too, plus how the sub-groups are computed.
3. **Trend chart.**
   - Clicking a year bar makes the chart vanish (skeleton) and come back.
   - The Budget and LS Itemized amounts appear only on hover.
4. **Project Stages box.** Show the breakdown per **Category** (as in the Category filter) instead of per stage.
5. **Lazy loading.** Confirm each section loads on scroll, one by one.

Findings (read-only):
- **Hierarchy fits exactly.** `tOptionAdminAreaRegion.Hierarchy` (nvarchar, 5 digits) orders the 18 regions exactly as requested:
  - Luzon: NCR 10101 · CAR 10102 · I 10103 · II 10104 · III 10105 · IV-A 10106 · IV-B (MIMAROPA) 10107 · V 10108;
  - Visayas: NIR 10202 · VI 10209 · VII 10210 · VIII 10211;
  - Mindanao: IX 10312 … XIII 10316 · BARMM 10317.

  The middle digits are the island group (01 Luzon, 02 Visayas, 03 Mindanao). Hierarchy does **not** mark Northern vs Southern Luzon.
- **How the sub-groups are computed today.** They are not in the database: `regionGroup()` in `FE/src/pages/Dashboard/components/dashboardRegions.ts` maps region names to them (CAR/I/II/III → Northern; IV-A/MIMAROPA/V → Southern; NCR on its own), and `DashboardRegionalMatrix.tsx` sums each sub-group's regions' % only. Its amount is never summed.
- **Why the trend chart vanishes.** `useDashboardTrend` caches by fiscal year (`sectionCacheKey(mode, year, filters)`), but the Trend endpoint ignores the year (it always plots every year; `GetCostRowsAsync(null, …)`). A year click therefore discards the chart and refetches identical data; the 5-bar skeleton replaces it and the bars re-animate from 0.
- **Lazy loading is already in place.** KPI cards, revisions and Lump Sum load on mount (Tier 1). Every other section (Macro Budget, Trajectory, Regional Map, Charts, Watchlist) has its own `useInViewport` observer (`FE/src/hooks/useInViewport.ts`, 200 px margin, fires once) gating both its data hook and its `React.lazy` chunk via `LazySection`. To be confirmed in the browser by request timing (AC10); no code change unless that shows otherwise.
- **The Project Stages box** is fed by the Statuses endpoint (one SQL group by {stage, region}, rolled up into stage counts and island totals). Its stage click cross-filters the watchlist (`activeStatusFilter`). The e2e reconcile test sums `Statuses`, so that list stays in the response.

## Acceptance Criteria

As a DPWH executive user, I want the regional tables, the trend chart and the breakdown box to read the way DPWH reports them, so that I can find a region, a year's amounts and a category's share without hovering or hunting.

- [ ] AC1: Each region table lists its regions in `tOptionAdminAreaRegion.Hierarchy` order (Southern Luzon IV-A, MIMAROPA, V; Northern Luzon CAR, I, II, III; Visayas NIR, VI, VII, VIII; Mindanao IX, X, XI, XII, XIII, BARMM), whatever their budgets. A region without a hierarchy (unrecognized) is listed last.
- [ ] AC2: The Northern Luzon and Southern Luzon headers show their amount (₱ B) beside the %, like NCR, Visayas and Mindanao. Each amount is the sum of its regions' amounts.
- [ ] AC3: Clicking a year in the trend chart keeps the chart on screen. No skeleton appears and no new Trend request is made, since the data does not depend on the year; only the selected year's highlight moves. When a header filter changes, the chart stays visible with an "Updating…" indicator until the new data lands.
- [ ] AC4: Every year's Infrastructure Budget and LS Itemized amounts are visible without hovering, under the year label. The footer names the selected year with both amounts. The hover tooltip remains.
- [ ] AC5: The former Project Stages box is now **Project Categories**: one row per category with projects in the year (count, % of projects, FY amount), largest first, matching the header filters. The categories add up to the card's project total.
- [ ] AC6: Clicking a category applies it as the header **Category** filter (the chip shows, and every section narrows). Clicking the selected category again clears it.
- [ ] AC7: The stage cross-filter on the project list (set only by the old box) is removed: no "Stage: …" chip and no `Status` in Projects requests. The header Program Stage Name filter is unaffected.
- [ ] AC8: The Statuses response keeps `Statuses` and `Islands` unchanged and adds `Categories`. Its time stays in line with today's (≈1 s for FY2024).
- [ ] AC9: The Regional, Trend and Statuses figures are unchanged apart from order and the new fields (spot-checked against the previous build).
- [ ] AC10: Lazy loading is confirmed in the browser. On load only the Tier-1 requests and the sections within one screen plus 200 px are fetched; each further section's request fires as it scrolls into view, one at a time.

## Approach

**Backend (`WebAPI/Controllers/Dashboard`)**
- `DashboardRegionalBreakdownDTO` gains `Hierarchy` (string); `GetRegionsByCodeAsync` already reads `tOptionAdminAreaRegion` and also returns Hierarchy.
- `DashboardCostRow` / `BranchCostRow` carry `Category` (already on `ScopedProject`). EF prunes it wherever it is unused, as shown for `ProgramPK` last time.
- **Statuses:** group by {StageName, RegionCode, Category}; a project has one of each, so roll-ups stay exact. Add `Categories` [{CategoryId, Name, ProjectCount, Budget}], with names from `tOptionProjectCategory` for the handful of ids, ordered by ProjectCount desc. `Statuses` and `Islands` are computed as now. If the extra key slows it, give categories their own grouped query instead.

**Frontend (`FE/src/pages/Dashboard`)**
- **`DashboardRegionalMatrix.tsx`:**
  - sort `northernLuzon`, `southernLuzon`, `visayasList`, `mindanaoList` by Hierarchy (missing → last, then name);
  - add sub-group amounts to the Northern/Southern Luzon header buttons (same badge as Visayas/Mindanao);
  - pie/region rankings stay by amount.
- **`hooks/useSectionData.ts`:** new option `keepPreviousData`. While a new key loads, it returns the last loaded data, with `isLoading` true.
- **`hooks/useDashboardTrend.ts`:**
  - key the cache without the year (constant year; the endpoint and Demo Data ignore it);
  - `keepPreviousData: true`.
- **`DashboardCharts.tsx` (trend):**
  - the skeleton only when there is no data; otherwise the chart with a small "Updating…" badge while loading;
  - under each year label, two compact lines (blue budget, amber LS, `formatCompactMoney`);
  - when the series is dense (> 8 years), hide those lines and rely on the footer and hover;
  - footer: "FY 2025 · Budget ₱… · LS Itemized ₱…".
- **`DashboardCharts.tsx` (box):**
  - replace Project Stages with **Project Categories** (same card styling): rows of category name, count, % bar and compact FY amount;
  - scrolls within the card's height;
  - click → `onSelectCategory({ id, name })`, with the selected category highlighted.
- **`Dashboard.tsx`:**
  - pass categories, the selected category id and `setSelectedCategory` to the box;
  - remove `activeStatusFilter` and its plumbing (DashboardCharts, the watchlist prop and its chip, `handleStageChange`'s clear);
  - `hooks/useDashboardStatuses.ts` maps `Categories`.
- **`Service.ts`:** the Statuses type gains `Categories`; Demo Data's Statuses gains sample categories from the sample projects' Category field.

## Tasks

### Implementation
1. Backend: Hierarchy on regional rows; Category on cost rows; Statuses `Categories`; DTOs.
2. Contract test: `DashboardStatusesResponseDTO` has `Categories`; `DashboardRegionalBreakdownDTO` has `Hierarchy`.
3. FE regional matrix: Hierarchy order and Northern/Southern amounts.
4. FE `useSectionData` `keepPreviousData`; trend hook keyed without the year; chart values, footer and updating state.
5. FE Project Categories box and click-to-filter; remove the stage cross-filter; Demo Data categories.
6. e2e:
   - the year-click test also asserts no new Trend request and the chart staying visible;
   - replace "project stage filter can be applied and cleared" with "category breakdown applies the Category filter";
   - region order: one table checked against Hierarchy order.

### Documentation
7. `FE/UserManual.md` §5.1 (Sections table: Distribution of Budget by Region, Annual Budget, Project Categories; Step 6; v3.13 row) and the `documents/UserManual_Changelog.md` v3.13 entry. Both are still uncommitted, so extend them rather than bumping.
8. Persist the plan as `documents/plans/dashboard-regions-trend-categories.md`; Completion Log at the end.

## Files / Components Touched
- `WebAPI/Controllers/Dashboard/DashboardController.cs`, `DTODashboard.cs`; `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`
- `FE/src/pages/Dashboard/Dashboard.tsx`, `Service.ts`, `hooks/useSectionData.ts`, `hooks/useDashboardTrend.ts`, `hooks/useDashboardStatuses.ts`, `components/DashboardCharts.tsx`, `components/DashboardRegionalMatrix.tsx`, `components/DashboardProjectWatchlist.tsx`
- `e2e/tests/dashboard-real-data.spec.ts`; `FE/UserManual.md`; `documents/UserManual_Changelog.md`

## Verification
1. Scratch build (`-o <scratch>/apibuild`); contract tests; `tsc -b` (ignoring Rbac); ESLint.
2. Scratch API :5016 + Vite :8081. Script:
   - Σ Categories ProjectCount == Σ Statuses Count == Kpis.ActiveProjects (FY2024, FY2025, with and without filters);
   - Statuses/Regional timings vs the previous build;
   - Regional rows carry Hierarchy.
3. Browser (`abdonslt`):
   - the region tables' order and the Northern/Southern amounts;
   - a year click: the chart stays, with no new Trend request;
   - a filter change: the "Updating…" badge;
   - category click → Category chip, then click again → cleared;
   - request log vs scroll for AC10.
4. `dashboard-real-data.spec.ts` through the scratch config (`globalTeardown` null); no edits during the run.

## Risks / Open Questions / Assumptions
- **Clicking a category applies the header Category filter**, which narrows every section, rather than only the project list as the stage box did. This mirrors "like we had on filtering". When a category is selected, the box shows just that category.
- **Northern/Southern Luzon stay a front-end convention** (`regionGroup()`), since the database does not tag them. Hierarchy could express the same split (10102–10105 north, 10106–10108 south), but that would only move the hard-coded rule.
- **Dense trend series:** live DB has 4–5 years today, so the per-bar values show. Past 8 years they hide in favour of the footer and hover, to stay legible.
- **Statuses' extra group key:** it multiplies cells (stage × region × category, sparse). Measure; split into its own query if slower.

## Completion Log
Date: 2026-10-14
- Implementation: all 6 tasks.
  - Backend: `Hierarchy` on the regional rows (`DashboardRegionRow` / `GetRegionsByCodeAsync`); `Category` on the cost rows; Statuses groups by {stage, region, category} and adds `Categories` (names from `tOptionProjectCategory`); DTOs; contract tests.
  - Frontend:
    - region tables sorted by Hierarchy, with Northern/Southern Luzon amounts (and every group amount kept on one line);
    - `useSectionData.keepPreviousData`; the trend cached without the year; values under every year's bars, the selected year's in the footer, and an "Updating…" badge;
    - Project Categories box that applies the header Category filter (read-only in Demo Data);
    - the stage cross-filter removed (Dashboard, DashboardCharts, watchlist);
    - Demo Data categories and hierarchy.
  - e2e: the year-click test asserts the values, no Trend refetch and the chart staying visible; new tests for the category breakdown and for the region order (Visayas table vs Hierarchy, on the busiest year).
- Documentation: `FE/UserManual.md` §5.1 (Distribution of Budget by Region, Annual Budget, Project Categories rows; Step 6; v3.13 history row); `documents/UserManual_Changelog.md` v3.13 entry (Section 4 rows 3–5, Section 5 row 6, Commits).
- Verification (scratch API :5016 + Vite :8081 on `myps_db_dev`; the user's :5015/:8080 untouched):
  - contract tests 16/16; `tsc -b` 0 errors outside Rbac; ESLint 0 errors;
  - `dashboard-real-data.spec.ts` 12/12 (none skipped) through the scratch config (`globalTeardown` null).
  - Σ Categories == Σ Statuses == Kpis.ActiveProjects for FY2024 and FY2025, with and without GAA-R + type 1.
  - Statuses and Islands byte-identical to the previous build (:5015, read-only); Regional identical apart from Hierarchy (18 of 19 rows; the "Not recorded" row has none).
  - Statuses ≈0.9–1.5 s, as before.
  - Browser (FY2025): Southern Luzon 26.89% ₱358.50 B → IV-A, IV-B, V; Northern 24.89% ₱331.84 B → CAR, I, II, III; Visayas NIR, VI–VIII; Mindanao IX–XIII, BARMM. A year click: chart never hidden, 0 Trend requests. A filter change: "Updating…" shown, chart never hidden. Categories: 16 rows = 34,010 projects; click → header chip, clear → gone.
  - AC10 (lazy loading) confirmed, no change needed. At the top only Kpis, Revisions, LumpSum, FilterOptions plus the two sections in view (Trend, BudgetBreakdown) loaded; then RegionalBreakdown at scroll 600, Statuses at 1800, Projects at 2400.
Deviations / flags:
- Added `whitespace-nowrap` to all four region-group amounts and to the categories' project badge; they wrapped ("₱358.50 / B") in a narrow column.
- The region-order e2e test switches to the busiest year (from the Trend response) via the pinned header: the default FY2027 has too few regions to test, and the e2e viewport only loads the trend once scrolled.
- Region IV-B is labelled as stored ("Region IV-B"); the manual calls it MIMAROPA.
Files changed: `WebAPI/Controllers/Dashboard/{DashboardController.cs, DTODashboard.cs}`, `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`, `FE/src/pages/Dashboard/{Dashboard.tsx, Service.ts, atoms/dashboardSectionCache.atom.ts, hooks/useSectionData.ts, hooks/useDashboardTrend.ts, hooks/useDashboardStatuses.ts, hooks/useDashboardRegionalBreakdown.ts, components/DashboardCharts.tsx, components/DashboardRegionalMatrix.tsx, components/DashboardProjectWatchlist.tsx}`, `e2e/tests/dashboard-real-data.spec.ts`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/dashboard-regions-trend-categories.md` (new).
