# Plan: Dashboard "Program Stage" title with Program Type and Program Stage Name filters

Status: Implemented
Created: 2026-10-14
Source: User request (this session): rename "National Expenditure Program & Portfolio Matrix" to "Program Stage"; add Program Type and Program Stage Name filters beside Category; show the chosen stage under the title.

## Context

The Dashboard header title reads **National Expenditure Program & Portfolio Matrix** (`FE/src/pages/Dashboard/Dashboard.tsx:279`). That is wrong whenever the figures cover more than NEP, which on Live DB they always do (all nine budget stages are counted). The only filter besides the fiscal year is **Category** (`DashboardCategoryFilter.tsx`). The user wants:

1. The title renamed to **Program Stage**.
2. Two new header filters beside Category: **Program Type** and **Program Stage Name**.
3. Under the title, the chosen stage's name once the user filters by Program Stage Name.

Facts verified this session (read-only, `myps_db_dev`):
- Program Type is `tPrograms.Type` (`EnumProgramType`), which stores `tOptionProgramType.NameId`: 1 Regular Infrastructure, 2 External Infrastructure, 3 Trust Fund, 4 Automatic Appropriation. `ProgramController.AddProgram` validates it the same way (`NameId == (int)dto.Type`).
- Stage names are `tOptionProgramStage.Name`. The dashboard counts only `DashboardController.BudgetStageNames` (BP, NEP, NEP-E, HGAB, HGAB-I, GAA, GAA-R, TF, TF-R). `DisplayName` is NULL for most stages, so it cannot supply full names.
- Every section reads one query, `GetCostRowSourcesAsync` (`DashboardController.cs:1202`). It already joins `tPrograms` (so Type is free) and filters `vProjectLatest.StageName` against the allow-list (so an equality on it adds no new column cost; see that method's PERFORMANCE note).

User decisions (asked this session):
- Under the title: **code + full name**, e.g. `NEP-E · National Expenditure Program with Errata`. With no stage chosen: **All budget stages**. The existing description sentence stays below it.
- The region map badge `FY {year} National Expenditure Program` (`DashboardRegionalMatrix.tsx:261`) **follows the stage filter**: `FY 2027 General Appropriations Act – Revision`, or `FY 2027 All budget stages` when none is chosen.

## Acceptance Criteria

As a DPWH executive user, I want to narrow the Dashboard by program type and budget stage and see which stage I am looking at, so that I can read one stage's (e.g. NEP's or GAA's) portfolio without leaving the page.

- [ ] AC1: The header title reads **Program Stage**. The text "National Expenditure Program & Portfolio Matrix" no longer appears anywhere on the page.
- [ ] AC2: A **Program Type** dropdown sits beside Category. It offers "All program types" plus the four types from `tOptionProgramType`, in NameId order.
- [ ] AC3: A **Program Stage Name** dropdown sits beside it. It offers "All stages" plus exactly the nine budget stages, in `StageHierarchy` order (BP … GAA-R, TF, TF-R). RBP, RDIP and PIP are not offered.
- [ ] AC4: Choosing a stage shows `<code> · <full name>` under the title (e.g. `GAA-R · General Appropriations Act – Revision`). With no stage chosen the line reads **All budget stages**.
- [ ] AC5: On Live DB, the region map badge reads `FY <year> <full stage name>`, or `FY <year> All budget stages` with no stage chosen.
- [ ] AC6: Every Live DB request (Kpis, Trend, BudgetBreakdown, Statuses, RegionalBreakdown, Projects, Revisions, LumpSum, and the KPI modal's project list) carries `ProgramType` and `StageName` alongside `CategoryId`. Each section's figures are narrowed by all three filters together (AND).
- [ ] AC7: Partition check (Live DB, one fiscal year, no category): the nine per-stage **FY Infrastructure Budget** totals add up exactly to the unfiltered total. The four per-type totals do too. Project counts add up the same way.
- [ ] AC8: Sections still agree under a filter: with a stage and a type chosen, the FY Infrastructure Budget card, the Total Program Outlays sum and the regional map total show the same amount.
- [ ] AC9: Changing either filter refetches each visible section once (the section cache key includes both); an unchanged combination never refetches. *(Corrected during implementation: the original wording said an earlier combination is served from cache, but each section's atom holds one entry, so returning to an earlier year, category or filter refetches, as it did before this change.)*
- [ ] AC10: Changing the header stage clears the Project Stages chart's stage filter on the project list, so the two cannot combine into an empty list.
- [ ] AC11: In Demo Data, both dropdowns are disabled (like Category) with the tooltip "… uses Live DB data. Switch to Live DB to filter …". Selecting Demo Data resets Category, Program Type and Stage to all. The title line reads "All budget stages", and the demo map badge keeps its NEP wording because the demo figures are the NEP presentation set.
- [ ] AC12: When the header is pinned on scroll, both dropdowns stay visible and usable in the compact row.
- [ ] AC13: No section's query is noticeably slower with the filters applied than without (compare EF command timings for Kpis, Statuses and Projects).

## Approach

**One filter object end to end.** The three header filters travel together everywhere `categoryId` does today. Instead of adding two more parameters to every helper, fetcher and hook, replace `categoryId` with one value:
- **Backend:** a private `DashboardFilter(int? CategoryId, int? ProgramType, string? StageName)` record in `DashboardController`, with `From(dto)`, `None` and `IsNarrowed`. `From` trims StageName and treats an empty one as null.
- **Frontend:** `DashboardFilters { categoryId; programType; stageName }` plus `NO_DASHBOARD_FILTERS` in `Service.ts`, and a `filterBody(filters)` helper that builds `{ CategoryId, ProgramType, StageName }` for every POST.

**Backend (`WebAPI/Controllers/Dashboard`)**
- `DashboardRequestDTO` and `ShowDashboardProjectsDTO` gain `int? ProgramType` (`tOptionProgramType.NameId`) and `string? StageName` (`[MaxLength(50)]`, the `TableEnum.Name` limit). An unknown stage needs no special handling: it is ANDed with the allow-list and returns nothing, which is honest.
- `GetCostRowSourcesAsync(year, filter, …)`: `programs.Where(p => p.Type == (EnumProgramType)type)` beside the existing `StartYear` filter. `projects.Where(p => p.StageName == stage)` beside the existing `BudgetStageNames.Contains`. Category stays in `Narrow`. Both branches (base and revised) inherit the change because they share `projects` and `programs`.
- `GetVisibleLumpSumSet(filter)`: `lumpSum.StageName == stage`. Program type via `_db.tPrograms.Any(p => p.ProgramPK == lumpSum.ProgramFK && p.Type == type)`. `GetLumpSumItemizedByYearAsync` and `LoadLumpSumProjectsAsync` callers pass the filter through.
- `GetRevisionSummaryAsync(visibleProjects, filter, …)`: add `project.StageName == stage` and the same `tPrograms.Any` type check on `revisionProjects`. The "narrow the queue" branch tests `filter.IsNarrowed` instead of `categoryId.HasValue`.
- `PageProjectsAsync` takes the filter. `Summary` passes `DashboardFilter.None` (it is unfiltered today).
- New `[HttpPost] FilterOptions` endpoint, modelled on `Categories`. It returns `ProgramTypes [{ ProgramType (NameId), Name }]` from `tOptionProgramType`, and `Stages [{ StageName, FullName }]` from `tOptionProgramStage` where `Name ∈ BudgetStageNames`, ordered by `StageHierarchy`. That keeps the allow-list and full names server-side, in one place.
- Full names live in one static map beside `BudgetStageNames`, from the names the manual already uses: BP Budget Proposal · NEP National Expenditure Program · NEP-E National Expenditure Program with Errata · HGAB House General Appropriations Bill · HGAB-I House General Appropriations Bill with amendments · GAA General Appropriations Act · GAA-R General Appropriations Act – Revision · TF Trust Fund · TF-R Trust Fund – Revision. `ReportingController.GetStageFullName` is deliberately not reused: it merges NEP-E into NEP, etc., for report headings.

**Frontend (`FE/src/pages/Dashboard`)**
- `Service.ts`: every live fetcher takes `filters: DashboardFilters = NO_DASHBOARD_FILTERS` and posts `filterBody(filters)`. Revisions posts no Year, as today. Benchmark paths ignore filters, as they ignore category today. Add `fetchDashboardFilterOptions()`.
- `atoms/dashboardSectionCache.atom.ts`: `sectionCacheKey(mode, year, filters)` becomes `` `${mode}:${year}:${categoryId??'all'}:${programType??'all'}:${stageName??'all'}` ``.
- `hooks/useSectionData.ts` and the seven section hooks: replace `categoryId` with `filters`. The effect re-runs on `key`, which already encodes the filters, so an object identity change cannot cause a refetch loop. `Dashboard.tsx` still memoises `filters`.
- New `components/DashboardProgramFilters.tsx`: two native `<select>`s styled like the header controls (`aria-label` "Filter by program type" / "Filter by program stage name"). The option lists load once, on first enable in Live DB, via `fetchDashboardFilterOptions`. A failed load shows a disabled "Could not load …" option and retries on the next enable. **Dropdowns, not autocompletes**, per the pick-list rule: each is a fixed, code-bound set under 10 (4 values bound by `EnumProgramType`; 9 by the `BudgetStageNames` allow-list). Category keeps its existing combobox.
- `Dashboard.tsx`:
  - state `selectedProgramType` and `selectedStage ({ stageName, fullName } | null)`; `filters` built with `useMemo` (all null in benchmark);
  - the Demo Data button resets all three filters;
  - render `<DashboardProgramFilters>` beside `<DashboardCategoryFilter>`;
  - title **Program Stage**, with a stage line under it (`code · full name`, or "All budget stages") and the description sentence kept;
  - changing the stage calls `setActiveStatusFilter(null)` (AC10);
  - pass `filters` to the watchlist and KPI modal, and `stageLabel` to the regional matrix.
- `DashboardRegionalMatrix.tsx`: new optional `stageLabel` prop. The badge renders `FY {year} {stageLabel}`. Dashboard passes the full name, "All budget stages", or (Demo Data) "National Expenditure Program".
- `DashboardKpiDetailModal.tsx` and `DashboardProjectWatchlist.tsx`: `categoryId` prop becomes `filters`; effect and `useCallback` dependencies list the three fields.

## Tasks

### Implementation
1. Backend DTOs: add `ProgramType` and `StageName` to both request DTOs. Add the `DashboardFilterOptionsResponseDTO`, `DashboardProgramTypeOptionDTO` and `DashboardStageOptionDTO` classes.
2. Backend controller: add the `DashboardFilter` record and the full-name map, then thread the filter through `GetCostRowsAsync` / `GetCostRowSourcesAsync`, the Lump Sum helpers, `GetRevisionSummaryAsync`, `PageProjectsAsync` and every action; add `FilterOptions`.
3. Contract tests (`MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`): both request DTOs carry `ProgramType` (`int?`) and `StageName` (`string?`); `FilterOptions` is an HTTP POST action.
4. FE service, cache key, `useSectionData` and the seven hooks: `categoryId` becomes `filters`; add `fetchDashboardFilterOptions`.
5. FE: new `DashboardProgramFilters` component.
6. FE `Dashboard.tsx`: state, title, stage line, Demo reset, stage-change cross-filter clear, prop wiring. Update the regional matrix badge, KPI modal and watchlist props.
7. e2e (`e2e/tests/dashboard-real-data.spec.ts`):
   - the pinned-header test asserts the **Program Stage** heading and both selects in the pinned row (replaces line 307);
   - the demo test asserts both selects are disabled;
   - new live test: pick a stage, so Kpis' `StageName` is sent and the title line plus the map badge show its full name; pick a type, so `ProgramType` is sent; reset both, so nulls are sent and "All budget stages" shows.

### Documentation
8. `FE/UserManual.md` §5.1:
   - Header Controls table: add Program Type and Program Stage Name rows, and describe the Program Stage title and stage line;
   - Step-by-Step: add the optional filter steps; mention both selects in the pinned-header line;
   - Common Outcomes: Demo Data disables all three filters; a type/stage combination with no projects shows ₱0;
   - "On Success": mention the type and stage;
   - bump the manual version (v3.12 → v3.13).
9. `documents/UserManual_Changelog.md`: before/after entry for v3.13 (the `update-manual-changelog` skill).
10. Persist this plan as `documents/plans/dashboard-program-stage-type-filters.md`. On completion, mark it `Status: Implemented` with a Completion Log.

## Files / Components Touched
- `WebAPI/Controllers/Dashboard/DTODashboard.cs`, `WebAPI/Controllers/Dashboard/DashboardController.cs`
- `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`
- `FE/src/pages/Dashboard/Service.ts`, `Dashboard.tsx`, `atoms/dashboardSectionCache.atom.ts`, `hooks/useSectionData.ts` plus the 7 `hooks/useDashboard*.ts` that take `categoryId`
- `FE/src/pages/Dashboard/components/DashboardProgramFilters.tsx` (new), `DashboardRegionalMatrix.tsx`, `DashboardKpiDetailModal.tsx`, `DashboardProjectWatchlist.tsx`
- `e2e/tests/dashboard-real-data.spec.ts`
- `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/dashboard-program-stage-type-filters.md`

## Verification
1. Build the API to a scratch folder: `dotnet build Main/Main.csproj -c Debug -p:SkipFrontendBuild=true -o <scratch>/apibuild`. The user's own Main.exe locks `Main/bin`.
2. `dotnet test MYPS.ApiIntegrationTests --filter "Controller=Dashboard" -o <scratch>/tests`.
3. FE type check: `tsc -b`, ignoring the known `src/pages/Rbac/` errors, plus `npx vite build --outDir <scratch>/fe`.
4. Run the scratch API on **:5016** (Development; EF command logging on for AC13) and Vite on **:8081**. Log in as `asisjnt`; BypassLogin is on in Development. Never touch the user's :5015 / :8080.
5. Run only `dashboard-real-data.spec.ts`, through a **scratch Playwright config** (`channel: 'chrome'`, `globalTeardown: undefined`). The project config's teardown calls DeleteLumpSum against `myps_db_dev`, which the database-safety rule forbids.
6. AC7/AC8 partition check against :5016: call Kpis for one FY once per stage (9 calls) and once per type (4 calls), then unfiltered. Assert the sums match exactly. Spot-check that BudgetBreakdown and RegionalBreakdown totals equal Kpis.TotalBudget under one stage + type.
7. Click through manually on :8081: title, stage line, map badge, Demo reset, pinned header, Project Stages cross-filter clear.

## Risks / Open Questions / Assumptions
- **Stage = the project's stage** (`vProjectLatest.StageName`, the latest `tProjectStages` row). That is what the allow-list and the Project Stages chart already use, so the filter and the chart agree. A program at NEP whose projects are still at BP will show those projects under BP.
- **Query plans.** `GetCostRowSourcesAsync` has a history of SQL Server choosing much slower plans when predicates move (see its PERFORMANCE note). The two predicates sit on rows already joined and filtered, and use constants rather than lists, so a regression is unlikely; AC13 checks it. If a plan regresses, apply the type filter through `programs` only (already the plan) and the stage through `Narrow`, before the cost joins.
- **Full names for GAA-R and TF-R** ("– Revision") are inferred from `tOptionProgramStage.DisplayName` ("GAA-Revisions") and the GAA-R revision workflow. Nothing in the DB names TF-R. Adjust the map if DPWH uses other wording.
- **Demo Data map badge** keeps "National Expenditure Program", because the demo figures are the NEP presentation set (assumption; the user's choice covered Live DB wording).
- **Revision queue** stays year-independent. Type and stage narrow it by the revised project's current program type and stage.
- The `Summary` endpoint (kept for the integrity spec) stays unfiltered.

## Completion Log
Date: 2026-10-14
- Implementation: all 7 tasks. The backend filter record (`DashboardFilter`) and the stage full-name map are threaded through every section, the Lump Sum helpers and the revision queue; new `FilterOptions` endpoint; contract tests. On the frontend, `DashboardFilters` replaces `categoryId` from `Service.ts` through the cache key, `useSectionData`, the 7 hooks, the KPI modal and the watchlist. New `DashboardProgramFilters` dropdowns; "Program Stage" title with the stage line; region map badge; Demo Data reset; header stage change clears the Project Stages chart's stage filter. e2e spec: Demo Data disables the new filters, the pinned header shows them, and a new live test checks stage/type requests, the stage line and the map badge.
- Documentation: `FE/UserManual.md` §5.1 (v3.13) and the v3.12 → v3.13 entry in `documents/UserManual_Changelog.md`.
- Verification (scratch API :5016 + Vite :8081 on `myps_db_dev`; the user's :5015/:8080 untouched):
  - Contract tests: 10/10 passed.
  - FE: `tsc -b` shows 0 errors outside the known Rbac ones; ESLint shows 0 errors in `src/pages/Dashboard`.
  - `dashboard-real-data.spec.ts`: 10/10 passed, via a scratch config with `globalTeardown` confirmed null.
  - AC7: FY2024 per-stage and per-type totals equal the unfiltered total exactly (budget in centavos, 35,553 projects, Lump Sum total).
  - AC8: BudgetBreakdown and RegionalBreakdown sums equal Kpis.TotalBudget under GAA-R + Regular Infrastructure.
  - AC13: filtered times equal unfiltered (FY2024: Kpis ~7.1 s, Statuses ~0.95 s, Projects ~2.5 s).
  - Unfiltered Kpis for all five fiscal years: all 8 fields identical to the pre-change build on :5015.
Deviations / flags:
- **Stage and type are sent as SQL literals, not parameters.** As planned (`StageName = @stage`), FY2024 Statuses and RegionalBreakdown went from about 1 s to 9.5 s. The stage now narrows the inlined allow-list (`DashboardFilter.CountedStageNames` via `EF.Constant`), so the query keeps the unfiltered shape; an unknown stage yields an empty list rather than an arbitrary literal. The program type uses `EF.Constant` too.
- **Kpis flag totals restructured** (`GetFlagTotalsAsync`). Joined to `tProjects` at cost-row grain, any filter took the flags query from ~0.9 s to 5–7.5 s. It now sums each project's budget first (`ToProjectBudgets`) and joins per half (base / revised). Measured trade-off: unfiltered FY2024 Kpis goes from ~6.2 s to ~7.0 s, because the revised half is its own statement. Filtered Kpis goes from ~11–12 s to ~7.0 s. FY2027 is ~0.95 s either way. One statement over both halves was tried and was worse (5–6 s for the flags query).
- AC9 wording corrected (see the AC).
- The pinned header now wraps to two lines at 1440 px (the 3 extra controls don't fit one line with 5 year buttons). The manual says "compact form" instead of "single row".
- `DashboardProgramFilters` retries a failed option load when either dropdown is focused, instead of "on the next enable" as planned.
- The existing category e2e test counted every `option` on the page. It is now scoped to the category listbox, because the new dropdowns add options.
Files changed: `WebAPI/Controllers/Dashboard/DTODashboard.cs`, `WebAPI/Controllers/Dashboard/DashboardController.cs`, `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`, `FE/src/pages/Dashboard/{Dashboard.tsx, Service.ts, atoms/dashboardSectionCache.atom.ts, hooks/useSectionData.ts, hooks/useDashboard{BudgetBreakdown,Kpis,LsProjects,RegionalBreakdown,Revisions,Statuses,Trend}.ts, components/{DashboardProgramFilters.tsx (new), DashboardKpiDetailModal.tsx, DashboardProjectWatchlist.tsx, DashboardRegionalMatrix.tsx}}`, `e2e/tests/dashboard-real-data.spec.ts`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/dashboard-program-stage-type-filters.md` (new).
