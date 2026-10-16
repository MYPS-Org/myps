# Plan: KPI detail modal — projects grouped per Program

Status: Implemented
Created: 2026-10-14
Source: User request (this session): "show in the modal the lists of projects per Programs … same [as Program Details] and not confuse the user … when clicked, go to the specific project detail page of [the] specific stage". Follows the user's question about P00968001LZ showing ₱17.31B in the modal vs ₱58.47B on its details page.

## Context

The FY Infrastructure Budget, Active Portfolio Projects and Publication Compliance cards open a modal with one flat project list (`DashboardKpiDetailModal.tsx`). It shows each project's **FY-scheduled amount**: for P00968001LZ that is ₱17.31B. The project's details page shows its **multi-year component Total** (₱58.47B). The difference is real data: ₱41.16B of its cost was never scheduled to any year (619 imported components carry ₱297B like this). But the two figures side by side confuse users.

The user wants the modal to list projects **per Program**, like the Program Details page (`FE/src/pages/Program/Views/ProgramDetail.tsx`), which has **no per-project amount**. Each project should open its own details page at its stage.

User decisions (asked this session):
- **Program row amount:** the dashboard's FY amount, so the programs add up to the card. It differs from the Programs module's cost for some programs. (The Programs module's stored Cost is also stale for some programs, e.g. GAA 2025 FAPs: ₱197.86B stored vs ₱57.29B live.)
- **Projects listed:** only those counted in the figure. GAA 2025 FAPs lists 14, and its row reads "14 of 22 projects".
- **Cards:** all three project lists (budget, projects incl. its For Publish / Published tabs, publication). The Lump Sum and revision views are unchanged.

Facts verified (read-only, `myps_db_dev`):
- **Display source:** Program Details' list comes from the inline TVF `fProgramProjects(@ProgramId = ProgramPK, @StageId)` (`ProgramController.ShowProjectsInProgram`). It returns CategoryName, ThrustName (SubProgram), ImplementingOfficeName, OperatingUnitName, IsPublishable and IsPublished. 10 keys of the largest program take 83 ms.
- **Projects at a different stage than their program:** `fProgramProjects(SSP, GAA-R)` returns 15,758 projects while the dashboard counts 17,172 for SSP. About 1,400 counted projects sit at another stage, so display rows must be read at each project's own stage.
- **Display columns:** `vProjectLatest` has no SubProgram or Operating Unit.
- **EF column pruning:** EF prunes unused columns from the cost-row UNION ALL (checked on BudgetBreakdown's SQL), so adding a column to the cost row does not change other sections' SQL.

## Acceptance Criteria

As a DPWH executive user, I want a KPI card's details to list its projects program by program, the way Program Details does, so that I can see where the figure comes from without comparing a per-project FY amount against the project's multi-year total.

- [ ] AC1: In Live DB, the budget, projects and publication modals show one row per program contributing to the figure, largest FY amount first. Each row shows the program name, its stage, "N of M projects" (M = the program's project count) and its FY amount. The flat 200-row list is gone.
- [ ] AC2: The program amounts add up exactly to the card's total, and the program project counts add up exactly to the card's project count (checked for FY2024 and FY2025, no filters and one stage + type filter).
- [ ] AC3: Expanding a program lists only its counted projects, 10 per page with the shared PaginationBar. The columns match Program Details: Project ID, Description (in full), Category, SubProgram, Implementing Office, Operating Unit, Publishable, Published. The values come from `fProgramProjects`, so they match Program Details for the same project. Paging through a program yields exactly its project count (spot-check GAA 2025 FAPs = 14 and one large program).
- [ ] AC4: Clicking a project opens `/projects/project-details/<ProjectId>:<its stage>`, and a Lump Sum Project opens `/lumpsum/<id>`. The footer "Project Repository" still opens `/projects`.
- [ ] AC5: The Active Portfolio tabs For Publish and Published show only programs with such projects. The rows and lists hold only those projects, and the tab counts are exact (sum of the programs) instead of the publishable − published approximation.
- [ ] AC6: The Category / Program Type / Program Stage Name header filters and the fiscal year apply to the program rows and their lists.
- [ ] AC7: In Demo Data, the modal shows the sample projects under their sample program, and clicking a project still opens the Projects list.
- [ ] AC8: No section gets slower. The new Programs request is in line with Kpis (FY2024 flags ~2 s), and one program page is under ~3 s for the largest program. Other endpoints' SQL is unchanged.

## Approach

**Backend (`WebAPI/Controllers/Dashboard`)**
- `ScopedProject`, `BranchCostRow` and `DashboardCostRow` carry `ProgramPK`, taken from the `tPrograms` row both halves already join. EF prunes it from every query that doesn't use it.
- `DashboardFilter` gains an internal `ProgramPK`. It is not bound from the request DTOs: the Projects endpoint sets it from its new filter. `GetCostRowSourcesAsync` applies it as `programs.Where(p => p.ProgramPK == pk)`: an equality on the program's unique key, which estimates correctly, unlike the derived StageName.
- **New `[HttpPost] Programs(DashboardRequestDTO)`**, per half of `GetCostRowSourcesAsync`, in the same shape that made Kpis fast:
  1. group the cost rows by {ProjectPK, ProgramPK};
  2. join `tProjects` flags;
  3. group by {ProgramPK, IsPublished, IsPublishable} into Budget and Count.

  The halves are rolled up in memory per program into Budget, ProjectCount, PublishedBudget, PublishedCount, ForPublishBudget and ForPublishCount ("for publish" = publishable and not published). Name, current StageName and NumberOfProjects come from `vProgramLatest` for those few programs. Rows are ordered by Budget, descending.
- **`Projects` endpoint:** `ShowDashboardProjectsFilterDTO` gains `ProgramPK` and `Publication` ("forpublish" | "published").
  - `PageProjectsAsync` passes ProgramPK through the header filter.
  - `Publication` narrows the per-project budgets by joining `tProjects` flags after `ToProjectBudgets` for the base half, and in memory for the revised half, before count and paging. Ranking and `DashboardPageMerge` are unchanged.
  - When ProgramPK is set, the page rows' display fields come from `fProgramProjects(ProgramPK, stageId)`, read once per distinct stage among the page's rows (≤ 10 keys). That covers projects whose stage differs from the program's. The rows fill new `DashboardProjectDTO.SubProgram` and `OperatingUnit`, plus Category, Implementing Office, IsPublishable and IsPublished as Program Details shows them. A row the function doesn't return keeps today's values.
- Reuse: `GetCostRowSourcesAsync`, `ToProjectBudgets`, `DashboardPageMerge`, the `EnumProgramStage` parse from `ShowProjectsInProgram`, and `GetVisibleProjects`/visibility (unchanged).

**Frontend (`FE/src/pages/Dashboard`)**
- **`Service.ts`:**
  - `fetchDashboardPrograms(year, isBenchmark, filters)`. In Demo Data it groups the sample projects by ProgramName.
  - `DashboardProjectsFilter` gains `ProgramPK` and `Publication`; `paginateBenchmarkProjects` honours ProgramPK, matched on the sample program name.
  - `WatchlistProject` gains `subProgram` and `operatingUnit`.
- **New `components/DashboardProgramGroups.tsx`:**
  - program rows (name, stage badge, "N of M projects", FY amount, chevron);
  - an expanded row renders `ProgramProjectList`, with its own `usePagination` (as the watchlist uses) over `fetchDashboardProjects` with `{ ProgramPK, Publication }`, limit 10, and the shared `PaginationBar`;
  - Program Details' columns, with the description in full and the stage badge nowrap;
  - a row click calls `onOpenProject`.
- **`DashboardKpiDetailModal.tsx`:**
  - the budget, projects (all / forpublish / published) and publication views render `DashboardProgramGroups` instead of the flat table;
  - the modal's own 200-row fetch (`fetchedProjects`, `MODAL_PROJECT_FETCH_LIMIT`) is removed;
  - the For Publish / Published tab tallies use the programs' exact sums;
  - the Lump Sum and revision views and the sticky header are untouched.
- `Dashboard.tsx` routing stays as it is: `projectDetailsPath` uses the project's own stage, a Lump Sum Project goes to `/lumpsum/<id>`, and Demo Data goes to `/projects`.

## Tasks

### Implementation
1. Backend: `ProgramPK` on the cost rows; `DashboardFilter.ProgramPK`; the `Programs` endpoint and its DTOs; the `Projects` filters (ProgramPK, Publication) and the `fProgramProjects` display rows; `DashboardProjectDTO.SubProgram` and `OperatingUnit`.
2. Contract tests: `Programs` is an HTTP POST action; `ShowDashboardProjectsFilterDTO` carries `ProgramPK` and `Publication`.
3. FE service: `fetchDashboardPrograms` (with Demo Data), the new filters, the new row fields.
4. FE: `DashboardProgramGroups` with `ProgramProjectList`.
5. FE: modal wiring for the three views and their tabs; remove the 200-row fetch; exact For Publish tally.
6. e2e (`dashboard-real-data.spec.ts`): update the "opens its own details page" test to expand the first program and click a project, and assert that the Programs response budgets sum to Kpis.TotalBudget.

### Documentation
7. `FE/UserManual.md` §5.1: describe the Summary-card details as per-program lists; update the existing v3.13 Revision History row (still uncommitted) rather than bumping.
8. `documents/UserManual_Changelog.md`: extend the v3.13 entry.
9. Persist this plan as `documents/plans/dashboard-kpi-modal-projects-per-program.md`; on completion, add the Completion Log.

## Files / Components Touched
- `WebAPI/Controllers/Dashboard/DashboardController.cs`, `WebAPI/Controllers/Dashboard/DTODashboard.cs`
- `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`
- `FE/src/pages/Dashboard/Service.ts`, `components/DashboardKpiDetailModal.tsx`, `components/ProjectQuickDetailModal.tsx` (row type), new `components/DashboardProgramGroups.tsx`
- `e2e/tests/dashboard-real-data.spec.ts`
- `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/dashboard-kpi-modal-projects-per-program.md`

## Verification
1. Build the scratch API (`-o <scratch>/apibuild`); run the contract tests (`--filter Controller=Dashboard`); FE `tsc -b` (ignoring Rbac) and ESLint on `src/pages/Dashboard`.
2. Scratch API :5016 + Vite :8081 (never :5015/:8080). A script against the API, for FY2024 and FY2025, unfiltered and with GAA-R + type 1:
   - Σ program Budget == Kpis.TotalBudget (centavos), Σ ProjectCount == ActiveProjects, Σ PublishedCount == PublishedProjects;
   - paging `Projects{ProgramPK}` through GAA 2025 FAPs gives 14 rows; the first page of SSP has SubProgram and Operating Unit filled;
   - one row compared field by field against `/Program/ShowProjectsInProgram` for the same project;
   - timings for Programs and an SSP page vs Kpis.
3. Browser check (logged in as `abdonslt`, who has Lump Sum access): FY2025 budget modal shows the program rows; expanding FAPs shows 14 rows; clicking P00968001LZ opens `/projects/project-details/P00968001LZ:GAA`; the For Publish tab; Demo Data.
4. `dashboard-real-data.spec.ts` through the scratch config (`globalTeardown` confirmed null); don't edit FE files during the run.

## Risks / Open Questions / Assumptions
- **Order inside a program:** largest FY amount first (the dashboard's existing ranking, with revised projects merged by `DashboardPageMerge`). No amount column is shown, so a caption says "Largest FY <year> cost first". Program Details itself orders by newest record.
- **Programs endpoint cost:** it groups by {ProjectPK, ProgramPK} at cost-row grain, like Kpis' fast flags shape. If it measures slow, group per project first (`ToProjectBudgets`-style) and join the program key afterwards.
- **Publication narrowing on very large programs** (SSP: 17k projects) joins flags after the per-project aggregate (Kpis' fast shape). Measure; acceptable if the page stays under ~3 s.
- **The stale stored program Cost** on Program Details (e.g. FAPs) is a separate data issue. Not fixed here; it can be reported.
- **Unchanged:** the Lump Sum card and revision views, and the watchlist section.

## Completion Log
Date: 2026-10-14
- Implementation: all 6 tasks.
  - Backend: `ProgramPK` on the cost rows; `DashboardFilter.ProgramPK` (internal); new `Programs` endpoint (per half: project budget → `tProjects` flags → per program and flags, rolled up in memory; names, stage and project count from `vProgramLatest`); `Projects` filters `ProgramPK` and `Publication` (flags joined after the per-project aggregate; revised half filtered in memory); display rows from `fProgramProjects`, read per stage of the page's rows (`GetProgramProjectRowsAsync`); `DashboardProjectDTO.SubProgram` and `OperatingUnit`; contract tests.
  - Frontend: `fetchDashboardPrograms` (Demo Data grouped by sample program); new `DashboardProgramGroups` (program rows; expandable `ProgramProjectList` with `usePagination`, `PaginationBar` and Program Details' columns); the modal's flat 200-row list and its browser-side tab filtering removed; exact For Publish tally from the programs.
  - e2e: the modal test now expands the largest program, checks that the Programs response adds up to Kpis, checks Program Details' columns, and checks the project link.
- Documentation: `FE/UserManual.md` §5.1 (Summary cards row; new Common Outcome on project total vs FY amount; v3.13 Revision History row extended); `documents/UserManual_Changelog.md` v3.13 entry extended.
- Verification (scratch API :5016 + Vite :8081 on `myps_db_dev`; the user's :5015/:8080 untouched):
  - contract tests 13/13; `tsc -b` 0 errors outside Rbac; ESLint 0 errors;
  - `dashboard-real-data.spec.ts` 11/11 through the scratch config (`globalTeardown` null).
  - Programs add up to Kpis exactly in decimals, FY2024 and FY2025, unfiltered and GAA-R + type 1. Project counts and published counts match too.
  - Every FY2025 program's list total equals its count (all / published / for publish). GAA 2025 FAPs = 14 of 22, paged to 14 unique rows including P00968001LZ.
  - 3 SSP rows equal `/Program/ShowProjectsInProgram` field by field.
  - Published lists checked where data has them (FY2026, FY2027: one each).
  - Browser: program rows, the FAPs expansion, the P00968001LZ link, the Published tab, Demo Data.
Deviations / flags:
- **Added during implementation (user request):** a project can be opened in a new tab. The Project ID is a real link (`<a href>`): right-click > Open link in new tab, middle-click, Ctrl/⌘-click. Ctrl/⌘-click or middle-click anywhere on the row opens a new tab too; a plain click navigates as before (one history entry). The row cancels middle-button mousedown on non-link cells, because Chrome's auto-scroll in the scrollable list otherwise swallows the auxclick. The link target comes from one `projectHref` in `Dashboard.tsx`, shared with the click handler.
- The program list is keyed by card, not by tab: the program rows carry every tab's counts, so switching tabs doesn't refetch them. Groups collapse on a tab change.
- **For Publish** is verified only at zero: no year on `myps_db_dev` has a publishable, unpublished project. The filter shares its code path with Published, which was verified on real rows.
- **Timings (FY2024/2025):** Programs 1.7–2.6 s, Kpis' range. One program page: 0.5–1.5 s unfiltered (3.4 s the first time for SSP, cold). With a Published / For Publish tab, 1.7–3.0 s.
- **The stored Program Details Cost is stale for some programs** (GAA 2025 FAPs: ₱197.86B stored, ₱57.29B live). Not changed here.
Files changed: `WebAPI/Controllers/Dashboard/{DashboardController.cs, DTODashboard.cs}`, `MYPS.ApiIntegrationTests/DashboardControllerContractTests.cs`, `FE/src/pages/Dashboard/{Dashboard.tsx, Service.ts, components/DashboardKpiDetailModal.tsx, components/ProjectQuickDetailModal.tsx, components/DashboardProgramGroups.tsx (new)}`, `e2e/tests/dashboard-real-data.spec.ts`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `documents/plans/dashboard-kpi-modal-projects-per-program.md` (new). The other files in `git status` belong to the earlier, still-uncommitted plans this session.
