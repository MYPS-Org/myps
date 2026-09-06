# Dashboard Live Data Integrity

Status: Implemented

## Goal

Keep the NEP presentation dataset available as an explicitly labelled comparison while ensuring every figure shown in Live DB mode is calculated from persisted MYPS data.

## Acceptance Criteria

- Live DB is the default dashboard source.
- The compiled API exposes `Dashboard/Summary` and applies existing project/program visibility rules.
- KPI, annual trend, project-stage, island, program-allocation, project, LS wallet, child-project, and activity figures originate from database records.
- Presentation constants are used only after the user selects NEP Presentation.
- Live API failures are visible and never replaced by benchmark or generated values.
- Dashboard aggregates reconcile to their returned detail rows.
- Both the legacy and normalized LS wallet schemas are read without inventing missing values.

## Approach

1. Trace every rendered dashboard component to its service/API source.
2. Restore the excluded dashboard controller to the WebAPI build.
3. Extend the live summary with distinct annual project counts and persisted program-budget groups.
4. Route the macro-budget and trajectory panels to those live aggregates while retaining isolated presentation datasets.
5. Read LS wallet totals and balances from the schema actually installed in each database version.
6. Add reconciliation assertions and run read-only database checks plus frontend/backend compilation.

## Files Touched

- `WebAPI/WebAPI.csproj`
- `WebAPI/Controllers/Dashboard/DashboardController.cs`
- `WebAPI/Controllers/Dashboard/DTODashboard.cs`
- `FE/src/pages/Dashboard/Service.ts`
- `FE/src/pages/Dashboard/Dashboard.tsx`
- `FE/src/pages/Dashboard/components/DashboardMacroBudget.tsx`
- `FE/src/pages/Dashboard/components/DashboardTrajectoryChart.tsx`
- `FE/src/pages/Dashboard/components/DashboardCharts.tsx`
- `FE/src/pages/Dashboard/components/DashboardKpiDetailModal.tsx`
- `FE/src/pages/Dashboard/components/DashboardProjectWatchlist.tsx`
- `e2e/tests/dashboard-real-data.narrated.spec.ts`

## Completion Log

- Removed the project-level compile exclusion that made the live summary endpoint unavailable.
- Replaced stale LS view/property references with a read-only compatibility query over persisted legacy or normalized wallet sources.
- Added `ProjectCount` to annual trends and `BudgetBreakdown` to the API contract.
- Made Live DB the initial source and removed silent all-zero failure substitution.
- Made macro allocation and trajectory components switch sources explicitly.
- Removed the dummy wallet id pre-expanded by the KPI modal.
- Removed presentation-era currency unit guessing so persisted peso amounts are displayed without rescaling.
- Added API/detail reconciliation coverage for program budgets and annual project counts.
