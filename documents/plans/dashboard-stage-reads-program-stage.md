# Plan: Dashboard reads each program at a program stage, as Program Details does

Status: Implemented
Created: 2026-10-15
Source: User report (this session). With Program Stage = GAA, the KPI modal showed "GAA 2025 OO-1 · GAA-R · 2 of 6,449 projects", while Program Details `:GAA` has 513 pages and /programs shows 5,121 projects for its GAA stage. With Program Stage = NEP, the Program Budget panel showed "GAA 2025 …" names and the modal showed a GAA-R program whose projects were "at NEP".

## Goal
The dashboard reads each program at one program stage, the way /programs and Program Details do. With a stage chosen, that stage. With none, the program's current (latest) stage. The program name, stage badge, project list, project count and amounts then agree with Program Details for that stage.

## Context (verified read-only on `myps_db_dev`)
- Each program stage is its own project set: `tProjectStages` (ProgramFK, StageId, RevisionId). Each stage row has its own `tProjectRevisions` row, with its own costs. The program has its own name per stage (`tProgramStages.RevisionId → tProgramRevisions.Name`): BP 2025 OO-1, NEP 2025 OO-1, NEP 2025 OO-1 with Errata, GAA 2025 OO-1 as Approved, GAA 2025 OO-1.
- The dashboard instead reads every project once, at **its own** latest stage (`vProjectLatest.StageName`). GAA 2025 OO-1's 6,449 projects are spread as 5,119 GAA-R, 790 NEP-E, 521 NEP, 17 BP and 2 GAA. So "GAA" found 2 projects, and "NEP" found the 521 that stopped at NEP.
- Program Details lists `fProgramProjects(program, stage)`: the stage rows with a live revision (`pr.IsDeleted = 0`). For GAA 2025 OO-1 that is 5,121 at GAA and 5,119 at GAA-R. The 2 GAA-R rows whose revision is deleted are the 2 "at GAA" projects.
- Costing a stage's rows at their own revision reproduces /programs' stage amounts to the centavo: GAA ₱295,301,759,000.0464 and GAA-R ₱295,018,797,743.4164 (FY 2025).
- **User decision:** with no stage chosen, each program is read at its current stage. FY 2025 changes from ₱1,333.06B (34,010 projects) to ₱1,152.91B (30,425). The 3,585 projects (₱180B) that stopped at BP/NEP/NEP-E/HGAB and never reached their program's GAA are no longer counted.
- Only one approved formal revision exists. It revises a GAA-R stage revision (FY 2026).
- Duplicate project-stage rows exist only at RBP (planning, not counted). There are no duplicate program-stage rows.

## Acceptance Criteria
As a DPWH executive user, I want the dashboard's figures for a program stage to be the ones Program Details shows for that stage, so that the dashboard and the Programs module never disagree.

- [x] AC1: With Program Stage = GAA, FY 2025, the KPI modal lists GAA 2025 OO-1 under its GAA-stage name ("GAA 2025 OO-1 as Approved"), with a **GAA** badge and "5,121 of 5,121 projects". Paging it yields 5,121 projects, every one opening `/projects/project-details/<id>:GAA`.
- [x] AC2: With Program Stage = NEP, every program name in the Program Budget panel, the modal and the watchlist is the program's NEP-stage name (no "GAA 2025 …"), with an NEP badge. No project row carries an "at <other stage>" badge.
- [x] AC3: With no stage chosen, each program is read at its current stage. GAA 2025 OO-1 shows GAA-R and "5,119 of 5,119", and every project is at GAA-R.
- [x] AC4: A program row's FY amount equals the sum of its FY component-cost-per-year amounts at that stage's revisions. It equals /programs' stage Amount wherever the program has no Lump Sum and its single-year projects are scheduled in the program year (checked: GAA 2025 OO-1 at GAA and GAA-R).
- [x] AC5: The sections still agree under any filter: the Programs rows sum to Kpis (budget, project count, published count); BudgetBreakdown and RegionalBreakdown sum to Kpis.TotalBudget.
- [x] AC6: "N of M": M is the program's project count at the stage it is read at (live revisions, as Program Details lists them).
- [x] AC7: Wording: the title line and map badge read "Current program stages" with no stage chosen. The modal methodology texts describe the stage rule.
- [x] AC8: No section is noticeably slower than before (compare Kpis, Statuses, Programs and one Projects page timings, FY 2024 and FY 2025).

## Approach

**Backend (`WebAPI/Controllers/Dashboard/DashboardController.cs`)**
- **One definition of "the stage a program is read at".** New `GetProgramStages(year, filter)` returns `IQueryable` of {ProgramPK, ProgramYear, StageId, StageName, ProgramRevisionId}, one row per program in scope:
  - **Stage chosen:** the program's `tProgramStages` row at that stage.
  - **No stage chosen:** `vProgramLatest`, the view /programs uses, held to the budget allow-list.
  - The programs are filtered by year, type and ProgramPK, as today.
  - Stage ids come from `DashboardFilter.CountedStageIds`, `EF.Constant` lists as today.
- **`GetCostRowSourcesAsync`:**
  - The scope's project rows become `tProjectStages` joined to `GetProgramStages` on (ProgramFK, StageId), then to the live `tProjectRevisions` row of that stage. This seeks `IX_tProjectStages_ProgramFK_StageId`.
  - Category, province, ID and description come from that revision. Visibility is `fUserVisibleProjects` on ProjectPK, as before.
  - `vProjectLatest` no longer drives the scope.
  - An approved formal revision applies when it revises that stage's revision (`tRevisionDetails.ProjectRevisionFK = stage RevisionId`). Its category, ID and description come from `vProjectLatest`, as today for the revised few.
  - `ScopedProject` loses `Project` (vProjectLatest) and gains ProjectPK, StageName, RevisionId and ImplementingOffice.
  - The cost rows drop ProgramName.
- **Names in memory:** `GetProgramStageInfoAsync(year, filter, keys)` materialises `GetProgramStages` for the programs an aggregate returned, adding Name (`tProgramRevisions`) and the project count at the stage (live revisions).
- **`BudgetBreakdown`** groups by ProgramPK and names the rows from that info.
- **`Programs`** takes Name, StageName and ProgramProjectCount from that info instead of `vProgramLatest`.
- **`PageProjectsAsync`:**
  - The status filter reads `item.StageName`.
  - The page rows' stage, revision, ID, description, category and office come from the scope itself (`CostRowSources.Projects`, restricted to the page keys). Program name comes from the stage info, and funding sources from the stage revision.
  - `vProjectLatest` still supplies the flags and the update date.
  - `GetProgramProjectRowsAsync` is read at each row's own stage, which is now its program's stage.
- **Unchanged:** the Lump Sum card and the revision queue (both keep their current stage rule), and the legacy `Summary` endpoint.

**Frontend (`FE/src/pages/Dashboard`)**
- `DashboardProgramGroups.tsx`: remove the "at <stage>" badge, which can no longer occur. A project's stage is its program's stage.
- `Dashboard.tsx`: with no stage chosen, the title line and map badge read "Current program stages".
- `DashboardKpiDetailModal.tsx` and `DashboardMacroBudget.tsx`: the methodology texts describe the program-stage rule.

## Tasks

### Implementation
1. Backend: `CountedStageIds`, `GetProgramStages`, the stage-row scope in `GetCostRowSourcesAsync`, `ScopedProject` / cost-row fields, `GetProgramStageInfoAsync`, `BudgetBreakdown`, `Programs`, `PageProjectsAsync`.
2. Frontend: the badge removal, the "Current program stages" wording and the methodology texts.
3. e2e `dashboard-real-data.spec.ts`: the two "All budget stages" assertions become "Current program stages".

### Documentation
4. `FE/UserManual.md` §5.1: describe the stage rule (bump the manual version) and add a `documents/UserManual_Changelog.md` entry.
5. Mark this plan Implemented, with a Completion Log.

## Files / Components Touched
- `WebAPI/Controllers/Dashboard/DashboardController.cs`
- `FE/src/pages/Dashboard/{Dashboard.tsx, components/DashboardProgramGroups.tsx, components/DashboardKpiDetailModal.tsx, components/DashboardMacroBudget.tsx}`
- `e2e/tests/dashboard-real-data.spec.ts`
- `FE/UserManual.md`, `documents/UserManual_Changelog.md`, this plan

## Risks / Open Questions / Assumptions
- **Headline change (user-approved):** with no stage chosen, FY totals drop to the programs' current-stage figures (FY 2025 ₱1.333T → ₱1.153T).
- **/programs' stage row counts deleted revisions.** `fProgramStages.ProjectCount` and Cost do not check `pr.IsDeleted`; Program Details does. The dashboard follows Program Details, so GAA 2025 OO-1 at GAA-R reads 5,119 here and 5,121 on /programs. That is a separate data-function issue; report it, don't change it here.
- **Amounts vs /programs' stage Amount:** /programs adds Lump Sum totals to every stage and takes all years' cost for single-year projects. The dashboard sums the FY's cost rows. They agree for most programs; the differences are expected and documented.
- **Performance:** the scope's driver changes from `vProjectLatest` to a small program-stage set seeking into `tProjectStages`. Measure (AC8). If a plan regresses, materialise `GetProgramStages` first and inline its keys with `EF.Constant`.
- **C: drive is full** (0 GB free before cleanup; tempdb could not grow). Heavy verification queries may fail until space is freed.

## Completion Log
Date: 2026-10-15
- Implementation: tasks 1–3.
  - **Backend:** `DashboardFilter.CountedStageIds`; `GetProgramStages` (chosen stage from `tProgramStages`, else `vProgramLatest`); the `GetCostRowSourcesAsync` scope driven by `tProjectStages` at each program's stage, with the live stage revision. A formal revision counts at the stage whose revision it revises.
  - **Backend, continued:** `ScopedProject` without vProjectLatest; `CostRowSources.Projects`; `GetProgramStageInfoAsync` (name at the stage, project count at the stage); `BudgetBreakdown` grouped by program key; `Programs` names, stages and counts at the stage; `PageProjectsAsync` rows (stage, revision, ID, description, category, office, funding) at the stage.
  - **Frontend:** the "at <stage>" badge removed; "Current program stages" title line and map badge (Demo Data keeps "All budget stages"); the dropdown's first choice is "Current stages"; the methodology texts updated.
  - **e2e:** the live test's two stage-line assertions.
- Documentation: tasks 4–5. `FE/UserManual.md` v3.14 (§5.1 Title, Program Stage Name row, "What counts", Summary cards row, map badge, new Common Outcome) and a v3.13 → v3.14 entry in `documents/UserManual_Changelog.md`.
- Verification (scratch API :5016 built to `Main/bin/claude-scratch` + Vite :8081, `myps_db_dev`, read-only):
  - API checks for FY2024–2027 × current / NEP / GAA / GAA-R, plus a type + category filter. Programs, BudgetBreakdown and RegionalBreakdown sum to Kpis in centavos; project and published counts match.
  - Every project row is at its program's stage, and every program carries its name at that stage.
  - GAA 2025 OO-1: GAA 5,121 of 5,121 at ₱295,301,759,000.0464, equal to /programs; GAA-R 5,119 of 5,119; NEP "NEP 2025 OO-1" 5,019 of 5,019.
  - FY2025 with no stage: ₱1,152,910,761,255.14 / 30,425 projects (was ₱1,333.06B / 34,010).
  - FY2026's one approved formal revision counts at GAA-R and not at GAA.
  - `dashboard-real-data.spec.ts` 13/13 through a scratch config with `globalTeardown` undefined. A temporary scenario spec (deleted) passed: the GAA modal's OO-1 list pages to 513, no "at" badge, NEP names in the modal and the Program Budget panel.
  - FE `tsc -b`: 0 errors outside Rbac. ESLint `src/pages/Dashboard`: 0 errors.
  - Timings (warm): FY2024 Kpis 6.7 s (previously ~7.0 s); FY2025 Kpis ~1.0–1.4 s; Programs 0.9–1.6 s; Statuses 0.6–1.1 s; one program page 0.5–1.5 s; watchlist page 1.3–2.4 s.
Deviations / flags:
- **Year as a literal (added during verification).** With the fiscal year sent as a parameter, the plan compiled for FY2026 (8 projects) was reused for FY2024 and FY2025, and the Kpis flag query timed out at 90 s. The first e2e run failed 3 tests this way. The program year and the cost year are now `EF.Constant`, so each year gets its own plan.
- **The /programs stage row differs from Program Details in three ways** (documented as a manual Common Outcome, not changed):
  - `fProgramStages` counts project-stage rows whose revision is deleted (GAA-R: 5,121 vs 5,119);
  - it adds the program's Lump Sum total to every stage row (NEP: ₱254.56B vs ₱253.76B; OO-1's Lump Sum parents exist only at GAA/GAA-R);
  - it counts all years' cost for single-year projects.
- The Lump Sum card and the revision queue keep their own stage rule (`vLumpSumSet.StageName`, `vProjectLatest.StageName`); the legacy `Summary` endpoint is unchanged.
- Contract tests were not rerun: no DTO or action signature changed.
- The C: drive was full (tempdb could not grow); about 0.9 GB was freed by removing earlier sessions' scratch build outputs. Builds and logs for this run went to `Main/bin/claude-scratch` on D: (gitignored).
Files changed: `WebAPI/Controllers/Dashboard/DashboardController.cs`, `FE/src/pages/Dashboard/{Dashboard.tsx, components/DashboardKpiDetailModal.tsx, components/DashboardMacroBudget.tsx, components/DashboardProgramFilters.tsx, components/DashboardProgramGroups.tsx, components/DashboardRegionalMatrix.tsx}`, `e2e/tests/dashboard-real-data.spec.ts`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`, this plan.
