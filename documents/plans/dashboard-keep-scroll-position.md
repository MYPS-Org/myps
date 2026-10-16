# Plan: Dashboard stays in place when a year or category is selected

Status: Implemented
Created: 2026-10-14
Source: User report (screenshot): clicking a trend bar or a Project Categories row scrolls the page down to the next section and then back, which confuses users. "When clicking, it should stay on that area of the component page."

## Context

Measured on the scratch build (1366×768, Live DB, FY2025 → click the FY2024 trend bar): the trend chart moved from **406 px to −110 px** on screen.

The cause is the sections **above** it. While the new year loads, they replace their content with much shorter loading skeletons:
- Total Program Outlays: 689 → 399 px;
- region map: 956 → 455 px.

So about 790 px of page above the user disappears, and everything below slides up; when the data lands, they grow back. A category click goes through the same mechanism, since every section reloads for the new filter. The same happens when a pinned-header control (year, Category, Program Type, Stage) is used while scrolled down.

Two causes, both addressed:
1. **Sections collapse while loading.** BudgetBreakdown, RegionalBreakdown and Statuses drop their data whenever the cache key changes (`useSectionData`), so their components render skeletons.
2. **Heights still change when new data lands.** For example, another year has more or fewer programs. Nothing keeps the user's spot in place.

## Acceptance Criteria

As a DPWH executive user, I want the page to stay where I am when I pick a year or a category, so that I keep looking at the chart I clicked instead of being thrown down the page and back.

- [ ] AC1: Clicking a trend bar keeps the clicked bar within ±10 px of its on-screen position, from the click until every section has reloaded, including FY2024's slow load. The same holds for a Project Categories row and for a trajectory year card or bar.
- [ ] AC2: Changing the year, Category, Program Type or Program Stage Name from the pinned header (while scrolled down) keeps the section under the header in place within ±10 px.
- [ ] AC3: While reloading for a new year or filter, Total Program Outlays, the region map and the Project Categories / Island-Group cards keep showing their previous content, dimmed and marked **Updating…**, instead of shorter skeletons. Skeletons appear only on a section's first load. Data from the other source is never shown (Demo ↔ Live switches still show skeletons).
- [ ] AC4: The hold ends as soon as the user scrolls (wheel, touch, keyboard), and after at most 20 s. It never fights the user's own scrolling.
- [ ] AC5: The figures are unchanged. The existing e2e suite passes, and a new e2e test checks AC1 for a trend bar and a category row.

## Approach

- **New `FE/src/pages/Dashboard/hooks/holdScrollPosition.ts`.** `holdScrollPosition(anchor, root)` records `anchor.getBoundingClientRect().top`. A `ResizeObserver` on the dashboard root (every section resize lands there) then scrolls by the difference on each resize, in the same frame, before paint. It stops:
  - on the user's `wheel`, `touchstart` or `keydown`;
  - when the anchor leaves the DOM;
  - after 20 s;
  - when the next hold starts (one module-level active hold).
- **`Dashboard.tsx`:**
  - a `rootRef` on the page container;
  - `holdView(anchor?)`: the clicked element, or, for pinned-header controls, the element just below the pinned header (`document.elementFromPoint` at the header's bottom edge). With an unpinned header the user is at the top and nothing above can move, so there is no hold.
  - It wraps: the header year buttons, Category, Program Type and Stage changes, the trend bars, the category rows and the trajectory year cards/bars.
- **Click handlers pass their element.** `DashboardCharts` (`onSelectYear(year, anchor)`, `onSelectCategory(category, anchor)`) and `DashboardTrajectoryChart` (`onSelectYear(year, anchor)`) pass `event.currentTarget`.
- **`useSectionData.keepPreviousData`** (added last time for the trend) only keeps data from the same data source: the cache key's mode prefix must match.
  - It is enabled for `useDashboardBudgetBreakdown`, `useDashboardRegionalBreakdown` and `useDashboardStatuses`.
  - In `DashboardMacroBudget`, `DashboardRegionalMatrix` and `DashboardCharts` (categories, islands): the skeleton shows only when there is no data yet; otherwise the content stays, dimmed (`opacity-60`), with an **Updating…** badge like the trend chart's.
- The KPI cards, the trend and the trajectory chart already keep their height, so they are unchanged.

## Tasks

### Implementation
1. `hooks/holdScrollPosition.ts` (new).
2. `hooks/useSectionData.ts`: keepPreviousData only within the same data source; enable it in the BudgetBreakdown, RegionalBreakdown and Statuses hooks.
3. `DashboardMacroBudget.tsx`, `DashboardRegionalMatrix.tsx`, `DashboardCharts.tsx`: skeleton only on the first load; otherwise dim plus **Updating…**.
4. `Dashboard.tsx`, `DashboardCharts.tsx`, `DashboardTrajectoryChart.tsx`: pass the anchor and call `holdView` for every in-page and pinned-header year or filter change.
5. e2e: "selecting a year or a category keeps the page in place". Scroll to the trend chart, click a bar, and sample the bar's on-screen top for 6 s (it stays within ±10 px); repeat for a category row.

### Documentation
6. `FE/UserManual.md` §5.1 (Annual Budget and Project Categories rows: the page stays where it is, and sections show **Updating…** while they reload) and the v3.13 changelog entry. Both are still uncommitted, so extend them.
7. Persist the plan as `documents/plans/dashboard-keep-scroll-position.md`; Completion Log.

## Files / Components Touched
- `FE/src/pages/Dashboard/hooks/holdScrollPosition.ts` (new), `hooks/useSectionData.ts`, `hooks/useDashboardBudgetBreakdown.ts`, `hooks/useDashboardRegionalBreakdown.ts`, `hooks/useDashboardStatuses.ts`
- `FE/src/pages/Dashboard/Dashboard.tsx`, `components/DashboardCharts.tsx`, `components/DashboardTrajectoryChart.tsx`, `components/DashboardMacroBudget.tsx`, `components/DashboardRegionalMatrix.tsx`
- `e2e/tests/dashboard-real-data.spec.ts`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`

## Verification
1. `tsc -b` (ignoring Rbac); ESLint.
2. Scratch API :5016 + Vite :8081: rerun `jump-check.cjs` (1366×768; FY2025 → FY2024 bar; category row). The chart and row tops stay within ±10 px; section heights no longer collapse during loading.
3. Pinned header check: change the year from the pinned header while scrolled to the region map; the map stays in place.
4. `dashboard-real-data.spec.ts` through the scratch config (`globalTeardown` null); no FE edits during the run.

## Risks / Open Questions / Assumptions
- **Previous data is shown dimmed for the second or two of a reload.** It is clearly marked Updating…, as the trend chart already does. The KPI cards keep their current loading behaviour, since they do not change height.
- **A hold cannot keep the spot if the page becomes too short below it** (the browser clamps the scroll); with sections no longer collapsing, that can only happen when the new data is genuinely shorter.
- **No browser scroll anchoring:** it is not relied on, because measurement shows it does not prevent the jump here. The hold computes from actual positions, so if the browser also adjusts, the two cannot compound.

## Completion Log
Date: 2026-10-14
- Implementation: all 5 tasks.
  - New `hooks/holdScrollPosition.ts`: a per-frame hold, with browser scroll anchoring switched off while active.
  - `useSectionData.keepPreviousData`, same data source only, enabled for BudgetBreakdown, RegionalBreakdown and Statuses.
  - Skeletons only on a first load in Total Program Outlays, the region map, Project Categories and the island cards; otherwise dimmed with a shared `UpdatingBadge`, which the trend chart now uses too.
  - `holdView` in `Dashboard.tsx` for the trend bars, category rows and Clear Filter, the trajectory year cards and bars, and the pinned header's year, Category, Program Type, Stage and Live/Demo controls.
  - e2e: "selecting a year or a category keeps the page in place".
- Documentation: `FE/UserManual.md` §5.1 (new "Changing the year or a filter" note; v3.13 history row) and the v3.13 changelog entry (Section 4 row 6, Commits).
- Verification (scratch API :5016 + Vite :8081, 1366×768):
  - before the fix, a FY2025 → FY2024 bar click moved the chart from 406 px to −110 px (Total Program Outlays 689 → 399 px, region map 956 → 455 px while loading);
  - after it, 0 px drift for a bar click through the whole reload (10–15 s, FY2024 outlays landing at ₱1,340.82 B), 0 px for a category click, and 0 px for a pinned-header year change with the map on screen;
  - a wheel scroll during a hold moves the page the full 500 px;
  - `tsc -b` 0 errors outside Rbac; ESLint 0 errors; `dashboard-real-data.spec.ts` 13/13.
Deviations / flags:
- **The hold checks the anchor every animation frame** instead of using a `ResizeObserver` on the root: a section shrinking above while another grows below leaves the root's height unchanged but still moves the anchor.
- **Browser scroll anchoring is off while a hold is active** (`overflow-anchor: none` on `<html>`, restored on release). Then any scroll the hold did not make is the user's (including dragging the scrollbar, which fires no event) and ends the hold. The first version missed a script scroll made in the same frame as a layout change, which failed the "program type and stage" e2e test.
- **Cap raised from 20 s to 30 s:** a cold FY2024 reload took about 17 s.
- **Category rows hold the whole Project Categories box,** not the row: rows come and go as the list reloads.
Files changed: `FE/src/pages/Dashboard/hooks/{holdScrollPosition.ts (new), useSectionData.ts, useDashboardBudgetBreakdown.ts, useDashboardRegionalBreakdown.ts, useDashboardStatuses.ts}`, `FE/src/pages/Dashboard/{Dashboard.tsx, components/UpdatingBadge.tsx (new), components/DashboardCharts.tsx, components/DashboardTrajectoryChart.tsx, components/DashboardMacroBudget.tsx, components/DashboardRegionalMatrix.tsx}`, `e2e/tests/dashboard-real-data.spec.ts`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/dashboard-keep-scroll-position.md` (new).
