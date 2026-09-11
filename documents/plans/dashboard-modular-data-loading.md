# Plan: Dashboard Modular Data Loading

Status: Implemented
Created: 2026-09-11
Revised: 2026-09-11 (v2 — reworked from "eager parallel" to genuinely lazy per-section loading after
re-assessment; added the Jotai cache layer and code-splitting)
Source: Conversation request — redesign how FE/src/pages/Dashboard loads data

## Context
The Executive Dashboard currently makes exactly one API call, `POST /Dashboard/Summary`
(`WebAPI/Controllers/Dashboard/DashboardController.cs`), which computes and returns KPIs,
annual trend, budget breakdown, statuses, islands, project list, LS projects, activities, and
revisions all in one payload via several sequential DB queries. The frontend
(`FE/src/pages/Dashboard/Dashboard.tsx:225-273`) gates the *entire* page behind one `isLoading`
flag and wipes all section state on every refetch, so one slow section (e.g. the full project
list, or the separate `fRevisionQueue` call) blocks every other section from rendering, and the
watchlist renders an unbounded in-memory array with no pagination.

The ask: (1) each component shows its own loading state, (2) the monolithic call is broken into
a separate API per component, (3) the "FY Regional Infrastructure Portfolio" watchlist is
paginated, and (4) each component/card **lazy loads** — it does work when it's actually needed,
not all at once on page load.

Two things already exist independently of this plan and must be preserved, not reverted:
- `DashboardController.cs` was scoped to `TemporaryDashboardYear = 2027` as a stopgap (live DB
  data for other years isn't clean yet).
- `Dashboard.tsx` defaults `dataSourceMode` to `'benchmark'` (Demo Data) as a stopgap.

## Goal
Replace the monolithic `POST /Dashboard/Summary` call with per-section endpoints that each load
lazily — on scroll-into-view or tab-open rather than all at page load — with per-section loading
states, a cache so already-loaded sections survive tab switches, and server-side cursor
pagination for the project watchlist.

## Acceptance Criteria
As a DPWH dashboard user, I want each dashboard section to load its own data only when I
actually need to see it, and the project list to page through results, so that the page paints
fast, a slow section never blocks the rest, and it stays fast as the live database grows.

- [ ] The dashboard no longer has one global `isLoading`/`loadError` gate around the whole page
      body; each section (KPI cards, charts, macro budget, trajectory chart, regional matrix,
      project watchlist, activity feed) shows its own loading skeleton while its own data is in
      flight, and its own inline error state if its own fetch fails — one section's failure
      doesn't blank the others.
- [ ] On initial page load, **only the KPI cards fetch**. Every other section's request fires
      only when that section scrolls into view or its tab is opened — verifiable in the browser
      Network tab.
- [ ] Switching perspective tabs, or scrolling a section out of view and back, does **not**
      refetch data already loaded for the current year + data-source mode. Changing the year,
      switching Live DB/Demo Data, or pressing the header Refresh button *does* refetch.
- [ ] `/Dashboard/Summary` is replaced by separate backend endpoints, one per section's data need
      (Kpis, Trend, BudgetBreakdown, Statuses+Islands, RegionalBreakdown, Projects, Activities,
      Revisions), each independently callable and independently fast.
- [ ] `RegionalBreakdown` data (region/island budget totals feeding `DashboardRegionalMatrix`) is
      computed server-side and returned pre-aggregated, not derived client-side from a full
      project array.
- [ ] The FY Regional Infrastructure Portfolio watchlist (`DashboardProjectWatchlist`) is
      paginated using the existing cursor-pagination convention (`EnumPagination<T>` /
      `FilterDataCursor` on the backend, `usePagination` + `PaginationBar` on the frontend)
      instead of receiving and rendering an unbounded in-memory array; search and status/island
      filters are applied server-side as pagination filters, with the search box debounced.
- [ ] The heavy sections (`DashboardRegionalMatrix`, `DashboardMacroBudget`, `DashboardCharts`)
      are code-split with `React.lazy`, so their JS is not parsed until the section is reached.
- [ ] Demo/"Benchmark" mode continues to work identically from the user's perspective (instant,
      client-generated data) after the split.
- [ ] `TemporaryDashboardYear = 2027` scoping in the backend is preserved (not silently reverted)
      across all the new split endpoints.
- [ ] Backend builds with 0 errors; `npm run typecheck` passes; a manual smoke test of both Live
      DB and Demo Data tabs confirms every section renders, cross-filtering still works, and the
      watchlist pagination works.

## Approach

### Why not Hangfire (for this pass)
Researched the codebase: there is no existing pattern of a Hangfire job pre-computing/caching
query results for a read endpoint to serve (the only Hangfire usage is fire-and-forget
report/import jobs with a job-status polling table — async file generation, not query caching).
There's also no `IMemoryCache`/`IDistributedCache`/Redis usage anywhere in the backend.
Introducing a caching job here would be new architecture, not reuse, and the queries are already
scoped to a single fiscal year (`TemporaryDashboardYear`), so they're no longer the expensive
full-history scans they used to be. **Recommendation: skip Hangfire for this pass**; revisit only
if a specific split endpoint is measured slow after this ships (a follow-up could mirror the
existing `ImportJobResult`/`GetImportStatus` job-plus-poll shape).

### Backend: split `DashboardController.Summary` into per-section actions
Keep `DashboardController.cs` as the controller (same route convention, same
`[PermissionFilter("ProjectController", "ShowProjects")]`), add separate `[HttpPost]` actions
instead of one `Summary` action:

| New action | Returns | Feeds |
|---|---|---|
| `Kpis` | `SelectedYear`, `AvailableYears`, `Kpis` | `DashboardKpiCards` |
| `Trend` | `AnnualTrend[]` | `DashboardCharts` (monthlyData), `DashboardTrajectoryChart` (liveData) |
| `BudgetBreakdown` | `BudgetBreakdown[]` | `DashboardMacroBudget` |
| `Statuses` | `Statuses[]`, `Islands[]` | `DashboardCharts` (statusData/islandData) |
| `RegionalBreakdown` (new) | `{ Region, Island, Budget, ProjectCount }[]` | `DashboardRegionalMatrix` |
| `Projects` (paginated) | Cursor-paginated project rows | `DashboardProjectWatchlist` |
| `Activities` | `Activities[]` | `DashboardActivityFeed` |
| `Revisions` | `DashboardRevisionSummaryDTO` (from `fRevisionQueue`, logic unchanged) | `DashboardKpiCards` (revision tile), `DashboardKpiDetailModal` |

Each action runs its own scoped version of the existing `visibleProjects`/`projectBudgets` join
(cheap now that it's pinned to `TemporaryDashboardYear`). This trades a little query duplication
for independently callable, independently lazy requests — the right trade now that the dataset is
a single year, and more so now that most of these endpoints won't be called at all on a typical
page view.

`RegionalBreakdown` is a new, smaller, cheaper query than what exists today: instead of shipping
the full `projects` array so `DashboardRegionalMatrix` can group it by region in-browser
(`DashboardRegionalMatrix.tsx:96-104`), the group-by moves server-side, mirroring the existing
`islands`/`budgetBreakdown` groupby pattern already in the controller
(`DashboardController.cs:275-305`); only aggregated rows go over the wire. The component's
existing `regionGroup()`-based subgroup bucketing (Northern/Southern Luzon, NCR) stays
client-side unchanged — it only needs `{region, island, budget, count}` inputs, not raw projects
(confirmed against `DashboardRegionalMatrix.tsx:90-147`).

`Projects` is the only paginated endpoint, modeled on `ProgramController`'s existing pagination
(`ProgramController.cs:122-146`): a `ShowDashboardProjectsFilterDTO` (search text, island,
stage/status) wrapping `EnumPagination<T>`, calling `_db.FilterDataCursor<...>(...)` — the
codebase's one established pagination convention (`Helpers/CursorPagination.cs`). Do not invent
Skip/Take/PageNumber pagination; none exists here.

### Loading strategy — three tiers
This is the core of the redesign. Sections are not all equal, so they don't all load the same way.

**Tier 1 — eager on mount: `DashboardKpiCards` only.** It renders outside the tab
`AnimatePresence` (`Dashboard.tsx:457`), is always visible above the fold, and is the cheapest
meaningful thing to show first. It fetches `Kpis` and `Revisions` (two independent requests; the
revision tile resolves on its own without blocking the other cards).

**Tier 2 — lazy on visible: every other section.** Each section's data fetch is gated behind an
`enabled` flag driven by a new shared `useInViewport` hook (thin `IntersectionObserver` wrapper;
none exists in the FE today) with a small `rootMargin` so it prefetches just before the section
scrolls in. Because a section sitting in a non-active tab is unmounted and therefore never
observed, **tab-gating falls out of the same mechanism for free** — no separate tab logic needed.

**Tier 3 — lazy on open: `DashboardKpiDetailModal`.** Fetches its filtered project list when the
modal is opened, reusing the paginated `Projects` service function with a filter matching the
selected KPI tab (e.g. `isPublishable=true`), instead of receiving a full array from the parent.

### Cache layer — so "lazy" doesn't degrade into "refetch constantly"
Lazy loading without a cache would make things *worse* than today: the three perspective tabs
render via `AnimatePresence` with conditional rendering (`Dashboard.tsx:465-607`), so switching
tabs **unmounts** the previous tab's components, and `DashboardMacroBudget`,
`DashboardRegionalMatrix`, `DashboardCharts`, `DashboardProjectWatchlist` and
`DashboardActivityFeed` each appear in two or three tabs. Component-owned fetches alone would
re-fire on every tab switch and every scroll-away-and-back; today the single payload lives in
`Dashboard.tsx` and survives tab switches for free.

There is no React Query/SWR in this frontend (checked `FE/package.json`) — only Jotai. So the
cache is hand-rolled on the pattern the codebase already uses for shared, remount-surviving
state: atoms plus a hook that reads/writes them, as in
`FE/src/pages/Modification/atoms/majorItemOfWorks.atom.ts` +
`FE/src/pages/Modification/hooks/useComponentCosts.ts`.

- One atom per section, holding `{ key, data, status, error }` where `key` is
  `` `${dataSourceMode}:${year}` ``.
- Each section hook: if the atom's `key` matches the current year+mode, render its data
  immediately — no fetch, no skeleton. Otherwise fetch once the section is visible, then write to
  the atom.
- Changing year or data-source mode changes the key, which invalidates every section naturally.
  The header Refresh button clears the atoms for the current key; visible sections refetch
  immediately, off-screen ones simply refetch next time they're scrolled to.

### Frontend wiring
Replace the single `useEffect` in `Dashboard.tsx` (`Dashboard.tsx:225-273`) with one small hook
per section (`useDashboardKpis`, `useDashboardTrend`, `useDashboardBudgetBreakdown`,
`useDashboardStatuses`, `useDashboardRegionalBreakdown`, `useDashboardActivities`,
`useDashboardRevisions`), each taking `(year, dataSourceMode, enabled)`, reading/writing its
cache atom, and returning `{ data, isLoading, error }`. In benchmark mode each resolves
synchronously from the existing `getBenchmarkSummary(year)` generator by slicing out the relevant
field (e.g. `getBenchmarkSummary(year).Kpis`), so Demo Data behaves exactly as it does today.

`DashboardProjectWatchlist` uses
`usePagination<DashboardProjectsFilter, WatchlistProject>(fetchDashboardProjects, { enabled })` —
the hook already supports gating its initial mount fetch via `enabled`
(`FE/src/hooks/usePagination.ts:18-23`, `:127-130`), so it needs no new mechanism for laziness,
only the viewport flag. Search/status/island filtering moves from the component's client-side
`useMemo` (`DashboardProjectWatchlist.tsx:35-48`) into `applyFilters` params, with the search
input debounced (~300ms) so typing doesn't fire a request per keystroke.

`Dashboard.tsx` keeps only genuinely cross-cutting state: `selectedYear`, `dataSourceMode`,
`activeStatusFilter`/`activeIslandFilter`, and `selectedKpi`/`selectedProject` modal state. It no
longer holds any section payloads, and no longer holds a full `projects` array at all.

### Code splitting
`React.lazy` already has a precedent on this very page — the deck.gl map is lazily imported at
`DashboardRegionalMatrix.tsx:4`. Extend it to the heavy sections themselves:
`DashboardRegionalMatrix` (851 lines + map + GeoJSON), `DashboardMacroBudget` (486),
`DashboardCharts` (407).

Implementation detail that matters: an `IntersectionObserver` needs a mounted DOM node to watch,
so a fully lazy-imported component can't observe its own visibility. Use one small always-mounted
`<LazySection>` wrapper per section that (a) renders the skeleton div the observer watches, and
(b) once visible, renders the `React.lazy` inner component and flips the section hook's `enabled`
flag. The `Suspense` fallback is the same skeleton as the data-loading state, so there's a single
visual loading treatment whether JS or data is in flight.

The region GeoJSON fetch inside `useRegionBoundaries.ts:19` rides along for free — it lives
inside the lazily-mounted matrix, so it no longer loads for users who never scroll that far.

## Tasks

### Implementation — backend
- Add `RegionalBreakdown` DTO + query to `DashboardController.cs`, grouping the existing
  `projects` list by `Region` (mirrors the existing `islands`/`budgetBreakdown` pattern).
- Split the rest of `Summary` into `Kpis`, `Trend`, `BudgetBreakdown`, `Statuses`, `Activities`,
  `Revisions` actions, reusing/trimming the per-section logic already in the file.
- Add a paginated `Projects` action + `ShowDashboardProjectsFilterDTO`, following
  `ProgramController`'s `FilterDataCursor` pattern.
- Remove the monolithic `Summary` action once the split actions are confirmed equivalent (confirm
  no caller besides `FE/src/pages/Dashboard/Service.ts` first).

### Implementation — frontend infrastructure
- Add a shared `useInViewport` hook (thin `IntersectionObserver` wrapper with `rootMargin`, fires
  once and disconnects) — new, no equivalent exists in the FE.
- Add a `<LazySection>` wrapper component: renders an observed skeleton, then mounts its
  `React.lazy` child and reports visibility so the section hook can enable its fetch.
- Add `FE/src/pages/Dashboard/atoms/` with one cache atom per section, keyed by
  `` `${dataSourceMode}:${year}` `` (follow `Modification/atoms/*.atom.ts`).
- Add `FE/src/pages/Dashboard/hooks/` with one fetch hook per section, each reading/writing its
  atom and honoring an `enabled` gate.
- Add the per-endpoint `Service.ts` functions (one per new endpoint, plus a paginated
  `fetchDashboardProjects`), each with a benchmark branch slicing `getBenchmarkSummary(year)`.

### Implementation — frontend components
- Update `Dashboard.tsx`: drop the single effect and all section payload state; wrap each section
  in `<LazySection>`; keep only cross-cutting state; wire Refresh to clear the cache atoms.
- Add `isLoading` prop + skeleton UI to `DashboardCharts`, `DashboardMacroBudget`,
  `DashboardTrajectoryChart`, `DashboardRegionalMatrix`, `DashboardActivityFeed` (mirror the
  existing skeleton at `DashboardKpiCards.tsx:176-180`); keep their existing empty-states for the
  genuinely-empty case.
- Change `DashboardRegionalMatrix` to accept pre-aggregated region rows instead of `projects`;
  drop its client-side `regionMap` build (`DashboardRegionalMatrix.tsx:96-104`) and its unused
  `islands` prop.
- Rework `DashboardProjectWatchlist` onto `usePagination` + `PaginationBar` with `enabled`; move
  search/status/island filtering into filter params; debounce the search input; replace the
  hardcoded "17 Regions" copy (`DashboardProjectWatchlist.tsx:155`) with the server-reported
  total.
- Rework `DashboardKpiDetailModal` to fetch its own filtered list on open instead of deriving
  from a full `projects` prop.
- Convert `DashboardRegionalMatrix`, `DashboardMacroBudget`, `DashboardCharts` to `React.lazy`
  imports behind their `<LazySection>` wrappers.

### Documentation
- Short comment block at the top of the new `hooks/`/`atoms/` folders describing the
  lazy-plus-cache convention, so the next contributor to this page follows it rather than
  reverting to a page-level fetch.

## Files / Components Touched
- `WebAPI/Controllers/Dashboard/DashboardController.cs`, `WebAPI/Controllers/Dashboard/DTODashboard.cs`
- `FE/src/pages/Dashboard/Dashboard.tsx`, `FE/src/pages/Dashboard/Service.ts`
- `FE/src/pages/Dashboard/components/*` — `DashboardKpiCards.tsx`, `DashboardCharts.tsx`,
  `DashboardMacroBudget.tsx`, `DashboardTrajectoryChart.tsx`, `DashboardRegionalMatrix.tsx`,
  `DashboardProjectWatchlist.tsx`, `DashboardActivityFeed.tsx`, `DashboardKpiDetailModal.tsx`
- New: `FE/src/pages/Dashboard/hooks/`, `FE/src/pages/Dashboard/atoms/`, a `LazySection`
  component, and a shared `useInViewport` hook
- Reused, not modified: `Helpers/CursorPagination.cs`, `FE/src/hooks/usePagination.ts`
  (already supports `enabled`), `FE/src/components/tailwindui/PaginationBar`

## Risks / Open Questions / Assumptions
- **Large monitors weaken the viewport win**: on a tall screen several sections may be in view at
  once on first paint, so the load degenerates toward parallel-eager. That's acceptable (it's
  still never worse than today), but keep `rootMargin` modest so it doesn't prefetch the whole
  page.
- **Cross-filter clicks become round-trips**: `activeStatusFilter`/`activeIslandFilter` are set by
  *other* components (charts, regional matrix) and today filter the watchlist instantly in
  memory. After this change each click is a server request that resets to page 1. Accepted trade
  for unbounded lists; the debounce covers the search box but the filter clicks will have visible
  latency.
- **AnnualTrend under `TemporaryDashboardYear`**: the trend endpoint still returns a single year's
  point while FY2027-only scoping stands (a deliberate prior stopgap this plan doesn't change) —
  the trend chart will look sparse until that constant is lifted. Flagged so it isn't mistaken
  for a bug introduced here.
- **`DashboardKpiDetailModal` behavior change**: fetch-on-open rather than instant from an
  already-loaded array, so the modal gets a brief spinner. Assumed acceptable.
- **Cache invalidation is the main correctness risk** in this design: a stale key comparison would
  show one year's data under another year's label. Keep the key derivation in one place and
  assert it in the hook, rather than re-deriving per section.
- **Old `Summary` endpoint removal**: assumed fine once the split endpoints are verified
  equivalent; will confirm no other caller first.
- **Hangfire deferred, not rejected**: if a split endpoint proves slow under real data volume, a
  follow-up can add the job/cache-table pattern (mirroring `ImportJobResult`/`GetImportStatus`).
  Nothing here should be pre-built for it.

## Verification
- `dotnet build WebAPI/WebAPI.csproj` — 0 errors; `cd FE && npm run typecheck` — clean.
- Network-tab check on a cold load: only the KPI requests fire. Scroll down and confirm each
  section's request fires as it comes into view; scroll back up and confirm nothing refires.
- Switch perspective tabs back and forth: sections already loaded for the current year+mode
  render instantly with no new requests; sections first seen in a newly-opened tab fetch once.
- Change the fiscal year and toggle Live DB / Demo Data: every section invalidates and reloads.
  Press Refresh: visible sections refetch.
- Exercise status/island cross-filtering, watchlist pagination and debounced search, and open a
  KPI detail modal to confirm its list loads on open.

## Completion Log
Date: 2026-09-11

### Implementation
Backend (`WebAPI/Controllers/Dashboard/DashboardController.cs`, `DTODashboard.cs`): re-applied the
`TemporaryDashboardYear = 2027` stopgap (it had been lost — never committed in an earlier session),
then split `Summary` into `Kpis`, `Trend`, `BudgetBreakdown`, `Statuses`, `RegionalBreakdown`
(new), `Projects` (paginated), `Activities`, `Revisions`, sharing a `GetYearScopedProjectsAsync`/
`GetVisibleProjects`/`GetActivitiesAsync`/`GetRevisionSummaryAsync` helper set instead of
duplicating the join five times. `Summary` itself was **kept**, composed from the same helpers —
see Deviations below.

Frontend: added `useInViewport` (shared hook), `LazySection` (viewport-gated Suspense wrapper),
one Jotai cache atom + fetch hook per section (`atoms/dashboardSectionCache.atom.ts`,
`hooks/useDashboard*.ts`), and the matching `Service.ts` functions (benchmark-aware, each slicing
`getBenchmarkSummary`). Reworked `Dashboard.tsx` to the three-tier lazy model, `Dashboard
ProjectWatchlist` onto `usePagination` (in-memory paginated — see Deviations), `DashboardRegional
Matrix` onto server-aggregated region rows, and `DashboardKpiDetailModal` onto fetch-on-open.
Added `isLoading` + skeletons to `DashboardCharts`, `DashboardMacroBudget`,
`DashboardTrajectoryChart`, `DashboardRegionalMatrix`, `DashboardActivityFeed`. Code-split
`DashboardRegionalMatrix`, `DashboardMacroBudget`, `DashboardCharts` via `React.lazy`.

### Documentation
Doc comments explaining the lazy-plus-cache convention live at the top of
`atoms/dashboardSectionCache.atom.ts`, `hooks/useSectionData.ts`, and `useInViewport.ts` (the
"short comment block" the plan asked for) rather than a separate doc file. Rewrote
`e2e/tests/dashboard-real-data.spec.ts` (replacing the deleted `.narrated.spec.ts`) and updated
its row in `e2e/CLAUDE.md`'s coverage map.

### Deviations / flags
- **Projects pagination is in-memory, not `FilterDataCursor`.** Flagged and confirmed with the
  user mid-implementation: `FilterDataCursor` pages a single SQL table/view/TVF directly, but
  `DashboardProjectDTO` is a multi-join, per-year-computed, C#-enriched shape with no backing
  view. `PaginateProjects` in `DashboardController.cs` reimplements the same page/limit/
  HasNext/HasPrevious/PageCursorId JSON contract by paging the already year-scoped, materialized
  list in memory — the frontend `usePagination` hook is unaware of the difference. Building a new
  SQL view instead was considered and rejected as disproportionate scope for this pass.
- **`Summary` endpoint kept, not removed.** The plan called for removing it once the split
  endpoints were verified equivalent. Mid-implementation this was found to conflict with a prior,
  separately completed plan (`documents/plans/dashboard-live-data-integrity.md`, Status:
  Implemented) whose acceptance criteria include "the compiled API exposes `Dashboard/Summary`",
  backed by an e2e regression spec. Confirmed with the user: kept `Summary`, composed from the
  same shared helpers, for backward compatibility — nothing on the frontend calls it anymore.
- **`e2e/tests/dashboard-real-data.narrated.spec.ts` fully rewritten, not just updated.**
  Discovered it was already broken independent of this work: it imported `qa-kit/narrate.js`,
  a package not declared in `e2e/package.json` and not present in `node_modules`, and asserted on
  a `"Welcome back, {name}!"` heading / `"Role:"` text that don't exist anywhere in the current
  `/dashboard` flow (confirmed via search — the closest match is an unrelated orphaned component
  at a different route, `/layout`). `git log` shows the file was touched only twice ever (creation
  + one unrelated rename), suggesting it was never re-verified against the current dashboard
  redesign. Confirmed with the user: rewrote it in plain Playwright (dropping the narrator
  pattern, matching every other spec in this suite and `e2e/CLAUDE.md`'s documented conventions)
  against the actual current UI and the new split-endpoint/lazy-loading architecture, and deleted
  the old file. **Not executed against a live environment from here** — needs a real run
  (`npm test` in `e2e/`, against a live FE + backend + DB with FY2027 data) to confirm
  timing/selectors before being trusted as a passing suite.
- **`useInViewport` needed a callback-ref redesign.** The first draft used a plain `useRef`;
  since several sections (e.g. `DashboardMacroBudget`) render inside more than one tab and only
  one tab is mounted at a time, a `useRef`'s effect only ever observes the first-mounted DOM node
  and silently stops working after a tab switch remounts a different node under the same ref.
  Fixed by switching to a callback ref (`useState` + a stable setter) so the observer re-attaches
  on every mount — see the comment in `FE/src/hooks/useInViewport.ts`.
- **Watchlist pagination doesn't survive a tab-switch remount.** Unlike the six atom-backed
  sections, `DashboardProjectWatchlist` owns its pagination state locally via `usePagination`
  (deliberately not modified, per the plan). Switching away and back re-fetches page 1 rather than
  resuming the exact page/cursor. Accepted as a disclosed gap rather than modifying the shared
  `usePagination` hook to add cross-remount persistence — documented in
  `atoms/dashboardSectionCache.atom.ts`.
- **KPI detail modal's "For Publish" tab count is an approximation.** `forPublishCount` is derived
  as `max(0, publishableProjects - publishedProjects)` from the exact server-wide `Kpis` totals,
  rather than an exact "publishable AND not yet published" server count (the paginated `Projects`
  filter DTO only supports `Search`/`Island`/`Status`, not publish-state booleans). The underlying
  table rows shown in that tab come from one 200-row page of the paginated endpoint rather than a
  true unbounded list, matching the modal's pre-existing (un-paginated) UI, which has no page
  controls.
- **Frontend production build (`vite build`) was not run** — `npm run build` chains `tsc -b` first,
  which fails on pre-existing, unrelated errors in `FE/src/pages/Rbac/*` (confirmed via `git
  status` that this session never touched those files). `npm run typecheck` (`tsc -b` alone) is
  clean for every file this plan touched.

### Files changed
Backend: `WebAPI/Controllers/Dashboard/DashboardController.cs`, `WebAPI/Controllers/Dashboard/DTODashboard.cs`

Frontend — modified: `FE/src/pages/Dashboard/Dashboard.tsx`, `Service.ts`,
`components/DashboardActivityFeed.tsx`, `components/DashboardCharts.tsx`,
`components/DashboardKpiDetailModal.tsx`, `components/DashboardMacroBudget.tsx`,
`components/DashboardProjectWatchlist.tsx`, `components/DashboardRegionalMatrix.tsx`,
`components/DashboardTrajectoryChart.tsx`

Frontend — new: `FE/src/hooks/useInViewport.ts`, `FE/src/pages/Dashboard/atoms/
dashboardSectionCache.atom.ts`, `FE/src/pages/Dashboard/components/LazySection.tsx`,
`FE/src/pages/Dashboard/hooks/{useSectionData,useDashboardKpis,useDashboardTrend,
useDashboardBudgetBreakdown,useDashboardStatuses,useDashboardRegionalBreakdown,
useDashboardActivities,useDashboardRevisions}.ts`

e2e: `e2e/CLAUDE.md` (coverage map), `e2e/tests/dashboard-real-data.spec.ts` (new, replaces
deleted `e2e/tests/dashboard-real-data.narrated.spec.ts`)
