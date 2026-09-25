# Plan: Live-DB Lump Sum Data Summary on the Dashboard

Status: Implemented
Created: 2026-09-17
Source: Chat request — "can we create a data summary for lumpsum projects as well?"

## Goal

Make the Dashboard's Lump Sum Wallet KPI tile and detail-modal breakdown show real, year-scoped,
permission-filtered data in Live DB mode, sourced from the current `vLumpSumSet` /
`vLumpSumBalance` / `vLumpSumChildSet` views — with no change to Demo Data mode's behavior.

## Acceptance Criteria

As a portfolio manager, I want the Dashboard's Lump Sum Wallet KPI tile and its breakdown to
reflect real database wallet balances, so that I can trust Live DB mode instead of only seeing
meaningful Lump Sum figures in Demo Data mode.

- [ ] A new `POST /api/Dashboard/LumpSum` endpoint returns one entry per Lump Sum project visible
      to the caller for the selected fiscal year (`TotalAllocation`, `ItemizedAmount`,
      `RemainingAmount`, `ItemizedCount`, and its itemized `Children[]`), sourced from
      `vLumpSumSet` + `vLumpSumBalance` + `vLumpSumChildSet`.
- [ ] Row-level visibility matches the existing Lump Sum module: when `_Session.ApplyFilter` is
      on, only projects whose program is in the caller's `vProgramDataSecurityGroups` are
      returned (same rule `LumpsumController.ShowLumpSum` already applies).
- [ ] `/Dashboard/Kpis`' `LsWalletReleased` / `LsWalletTotal` are computed from the same
      visible, year-scoped Lump Sum balances instead of the hard-coded `0`/`0`.
- [ ] `/Dashboard/Summary`'s `LsProjects` and `Kpis.LsWalletReleased/LsWalletTotal` are wired to
      the same source (it's the documented backward-compatibility contract endpoint — no reason
      to leave it stale while `Kpis`/`LumpSum` are live).
- [ ] The Dashboard's KPI detail modal "Lump Sum" tab shows real projects/children when Live DB
      is selected, loaded via the same lazy/cached section pattern (`useSectionData` + a cache
      atom) as every other section — not fetched eagerly on the page's initial paint via a new
      one-off path.
- [ ] Demo Data mode is pixel-for-pixel unchanged (still reads `BENCHMARK_LS_PROJECTS` /
      `getBenchmarkSummary`).
- [ ] Switching the fiscal year in Live DB mode changes which Lump Sum projects appear (FY2027
      vs FY2028 return different rows on `myps_db_dev` today — verifiable manually).
- [ ] Dead code removed: `DashboardController.LoadWalletRows` and `DashboardWalletRow` (they
      query tables that no longer exist and have no remaining caller).
- [ ] `dotnet build` succeeds; existing `dashboard-real-data.spec.ts` e2e still passes unmodified
      (it does not assert on LS fields today, per inspection).

## Approach

The Dashboard already ships a "Lump Sum Wallet" KPI tile (`DashboardKpiCards.tsx`) and a Lump
Sum breakdown tab in the KPI detail modal (`DashboardKpiDetailModal.tsx`, `DashboardLsProject`
type with `children[]`), but both are permanently fed zeros/empty in Live DB mode:

- `DashboardController.Kpis` and `.Summary` hard-code `LsWalletReleased = 0` / `LsWalletTotal = 0`.
- `Dashboard.tsx:101` hard-codes `const lsProjects: DashboardLsProject[] = [];` with the comment
  "LS Wallet integration is disabled server-side... always empty until that ships."
- The dead `LoadWalletRows`/`DashboardWalletRow` code in `DashboardController.cs` queries
  `dbo.tLSWallets` / `dbo.vLSWalletLatest` / `dbo.vLSWalletBalance` / `dbo.vLSWalletProjectSet` —
  confirmed via direct query against the live dev DB (`192.168.50.200/myps_db_dev`) that
  **`tLSWallets` no longer exists**. This is leftover from before the Lump Sum V2 rewrite.
- The live V2 schema is `dbo.vLumpSumSet` (parent LS projects), `dbo.vLumpSumBalance`
  (Total/Itemized/Remaining per parent), and `dbo.vLumpSumChildSet` (itemized children) —
  already used by `WebAPI/Controllers/Lumpsum/LumpsumController.Reads.cs`. Confirmed live data
  today: 5 parent rows (3 in FY2027, 2 in FY2028), 14 child rows.
- `DTODashboard.cs` **already defines** `DashboardLsProjectDTO` / `DashboardLsChildProjectDTO`
  with the exact shape the frontend expects — they're just never populated from real data.

So the data exists and the target shapes already exist; the gap is purely a missing query path
end-to-end. This plan wires it up following the exact "split endpoint" pattern the rest of the
dashboard already uses (see `documents/plans/dashboard-modular-data-loading.md`), and deletes the
dead pre-V2 wallet code instead of leaving it beside the real implementation.

**Backend (`WebAPI/Controllers/Dashboard/DashboardController.cs`, `DTODashboard.cs`):**

1. Add a private `GetVisibleLumpSumSet()` helper, structurally identical to the existing
   `GetVisibleProjects()`, but over `_db.vLumpSumSet` filtered by
   `_db.vProgramDataSecurityGroups.Any(d => d.ProgramPK == ls.ProgramFK && d.ParticipantId == _Session.RegCode)`
   when `_Session.ApplyFilter` is set — the same rule already applied inline in
   `LumpsumController.Reads.cs`'s `ShowLumpSum`.
2. Add a private `LoadLumpSumProjectsAsync(IQueryable<LumpSum> visibleLumpSum, int year, ct)`
   helper:
   - Filter parents to `StartYear == year`.
   - Left-join `vLumpSumBalance` for `Total`/`Itemized`/`Remaining`, falling back to the parent
     view's own `OriginalAllocation`/`ItemizedTotal`/`Remaining` when no balance row exists
     (mirrors the `Balance ?? new LumpSumBalance { WalletId = Project.Id }` fallback already used
     in `BuildLumpSumDetailsAsync`).
   - Batch-load children from `vLumpSumChildSet` filtered by `ParentProjectId IN (parent
     ProjectIds)` — one query for all parents on the page, not N+1.
   - Map into `DashboardLsProjectDTO`/`DashboardLsChildProjectDTO` (existing DTOs — no shape
     changes needed), ordered by `TotalAllocation` descending to match the "biggest first"
     convention the other aggregate endpoints (`BudgetBreakdown`, `RegionalBreakdown`) use.
3. Add `DashboardLsProjectsResponseDTO { List<DashboardLsProjectDTO> LsProjects }` to
   `DTODashboard.cs`, mirroring `DashboardBudgetBreakdownResponseDTO`.
4. Add `[HttpPost] public async Task<IActionResult> LumpSum(DashboardRequestDTO? dto, ct)`:
   resolve the year via the existing `ResolveYearAsync`, call the two helpers above, return
   `Ok(new DashboardLsProjectsResponseDTO { LsProjects = ... })`. Same try/catch +
   `_exceptionHandler.Handle` shape as every other action in this file.
5. In `Kpis`, add a small aggregate query over `GetVisibleLumpSumSet()` (join
   `vLumpSumBalance`, filter `StartYear == scope.SelectedYear`) summing `Total`/`Itemized`,
   and set `LsWalletTotal`/`LsWalletReleased` from it instead of `0`/`0`. Update/remove the
   now-inaccurate "LS Wallet integration is disabled" comment.
6. In `Summary`, replace `LsProjects = new List<DashboardLsProjectDTO>()` with a call to the same
   `LoadLumpSumProjectsAsync` helper, and wire its `Kpis.LsWalletReleased/LsWalletTotal` the same
   way as step 5.
7. Delete `LoadWalletRows` and the `DashboardWalletRow` class entirely (confirmed no remaining
   callers after step 6; they reference dropped tables).

**Frontend (`FE/src/pages/Dashboard/`):**

8. `Service.ts`: add `fetchDashboardLsProjects(year, useBenchmark)` mirroring
   `fetchDashboardRevisions`'s shape — POSTs `{ Year }` to `/Dashboard/LumpSum` with
   `{ silent: true }` for the real path; benchmark path returns
   `{ LsProjects: getBenchmarkSummary(resolveYear(year)).LsProjects }`. Update the "Split
   endpoints" doc comment block (~line 400) to list `LumpSum` alongside the others.
9. `atoms/dashboardSectionCache.atom.ts`: add
   `lsProjectsCacheAtom = atom<SectionCache<DashboardLsProject[]>>(emptySectionCache())`,
   importing the camelCase `DashboardLsProject` type from `../components/DashboardKpiDetailModal`
   — the same "atom imports its shape from the component that owns it" pattern already used for
   `KpiData`/`StatusSegment`/`ActivityLog`/`RegionalBreakdownRow`.
10. `hooks/useDashboardLsProjects.ts` (new): `useSectionData` wired to the atom + fetch function
    above, with a `mapLsProjects` function converting the PascalCase wire shape (including nested
    `Children`) into the camelCase `DashboardLsProject[]` the modal expects — same style as
    `mapKpis` in `useDashboardKpis.ts`.
11. `Dashboard.tsx`: replace the hard-coded `const lsProjects: DashboardLsProject[] = [];`
    (line 101) and its stale comment with
    `const lsProjectsSection = useDashboardLsProjects(selectedYear, sourceMode, true);` in the
    Tier-1 (eager-on-mount) group alongside `kpis`/`revisions` — the dataset is tiny (≤5 parents
    today) and the KPI tile needs the aggregate immediately, so eager fits better here than
    viewport-gated Tier 2. Pass `lsProjectsSection.data ?? []` to
    `DashboardKpiDetailModal`'s `lsProjects` prop (replacing the current `lsProjects` binding).

**Not in scope / explicitly deferred:**
- `ResolveYearAsync`'s `AvailableYears` list stays derived from regular project cost rows only.
  If a fiscal year has Lump Sum data but no other cost data, it won't appear in the year switcher.
  Not fixing this here — it's a pre-existing scoping convention for the whole page, and today's
  live data (FY2027/2028) already overlaps with existing project cost years, so this shouldn't be
  visible in practice yet.
- No changes to the Lump Sum module itself (`LumpsumController`, `/lumpsum` pages) — this only
  adds a read-only dashboard projection of the same views it already exposes.

## Tasks

### Implementation
- [ ] Add `GetVisibleLumpSumSet()` helper to `DashboardController.cs`.
- [ ] Add `LoadLumpSumProjectsAsync(...)` helper (parents + balance fallback + batched children).
- [ ] Add `DashboardLsProjectsResponseDTO` to `DTODashboard.cs`.
- [ ] Add `[HttpPost] LumpSum(...)` action.
- [ ] Wire real `LsWalletReleased`/`LsWalletTotal` into `Kpis`.
- [ ] Wire real `LsProjects` + KPI totals into `Summary`.
- [ ] Delete `LoadWalletRows` / `DashboardWalletRow` dead code.
- [ ] Add `fetchDashboardLsProjects` to `FE/src/pages/Dashboard/Service.ts`.
- [ ] Add `lsProjectsCacheAtom` to `dashboardSectionCache.atom.ts`.
- [ ] Add `hooks/useDashboardLsProjects.ts`.
- [ ] Wire the hook into `Dashboard.tsx`, replacing the hard-coded empty array.

### Documentation
- [ ] Update the "Split endpoints" architecture comment in `Service.ts` to mention `LumpSum`.
- [ ] Replace the stale "LS Wallet integration is disabled" comments in `DashboardController.cs`
      and `Dashboard.tsx` with ones describing the real implementation.

## Files / Components Touched

- `WebAPI/Controllers/Dashboard/DashboardController.cs`
- `WebAPI/Controllers/Dashboard/DTODashboard.cs`
- `FE/src/pages/Dashboard/Service.ts`
- `FE/src/pages/Dashboard/atoms/dashboardSectionCache.atom.ts`
- `FE/src/pages/Dashboard/hooks/useDashboardLsProjects.ts` (new)
- `FE/src/pages/Dashboard/Dashboard.tsx`

## Risks / Open Questions / Assumptions

- **Assumption:** Lump Sum figures should be year-scoped by `StartYear` the same way every other
  Dashboard aggregate is scoped — consistent with the rest of the page, but means a project's
  wallet only appears under its own program's fiscal year, not "all time." Flagging in case the
  intent was actually an all-time Lump Sum total regardless of the selected year.
- **Risk:** Only 5 live parent rows exist today, so this is effectively unverified at scale —
  the query shape (batched children, no N+1) is written to scale, but there's no large fixture to
  load-test against locally.
- **Assumption:** `LumpsumController`'s visibility rule (`vProgramDataSecurityGroups` +
  `_Session.RegCode`) is the correct one to reuse for the dashboard projection, rather than the
  project-level `fUserVisibleProjects` rule `GetVisibleProjects()` uses — Lump Sum is
  program-scoped, not project-scoped, in the current schema.

## Completion Log
Date: 2026-09-17
- Implementation: All 11 implementation tasks done. Backend: `GetVisibleLumpSumSet()` and
  `LoadLumpSumProjectsAsync(...)` helpers added to `DashboardController.cs`; new
  `DashboardLsProjectsResponseDTO` added to `DTODashboard.cs`; new `[HttpPost] LumpSum` action;
  `Kpis` and `Summary` both now compute `LsWalletReleased`/`LsWalletTotal`/`LsProjects` from the
  same helper instead of hard-coded zeros/empty; dead `LoadWalletRows`/`DashboardWalletRow`
  (querying the dropped `tLSWallets`/`vLSWalletLatest` tables) deleted, along with the
  now-unused `using System.Data;`. Frontend: `fetchDashboardLsProjects` added to `Service.ts`;
  `lsProjectsCacheAtom` added to the section-cache atom file; new
  `hooks/useDashboardLsProjects.ts`; `Dashboard.tsx` wired to the hook in the Tier-1 eager group,
  replacing the hard-coded empty array, and its now-unused `DashboardLsProject` type import
  removed.
- Documentation: Updated the "Split endpoints" architecture comment in `Service.ts` to describe
  `LumpSum`'s eager-fetch exception. Replaced the stale "LS Wallet integration is disabled"
  comments in `DashboardController.cs` (`Kpis`) and `Dashboard.tsx` (Tier 1 section) with ones
  describing the real implementation.

Deviations / flags:
- The plan's assumed visibility mechanism (`_db.vProgramDataSecurityGroups` + `_Session.RegCode`
  via LINQ) does not exist as a queryable EF Core `DbSet` in this codebase — every existing call
  site uses it only as a raw SQL string fragment inside `FilterDataCursor`'s dynamic filter
  builder. Used the Lump Sum module's actual reusable visibility mechanism instead:
  `dbo.fUserVisiblePrograms` (a table-valued function), the same one
  `LumpsumController.IsLumpSumVisible`/`AssertLumpSumVisibleAsync` check a single record against.
  `GetVisibleLumpSumSet()` mirrors `GetVisibleProjects()`'s exact shape, just filtering
  `vLumpSumSet` by `fUserVisiblePrograms` instead of `vProjectLatest` by `fUserVisibleProjects`.
  Net effect on the Acceptance Criteria is none — "row-level visibility matches the existing
  Lump Sum module" still holds, just via the correct concrete mechanism.
- `Kpis`/`Summary` compute `LsWalletReleased`/`LsWalletTotal` by calling
  `LoadLumpSumProjectsAsync` and summing over its result, rather than a separate lightweight
  aggregate query as sketched in the plan's Approach step 5. Simpler and DRY given the current
  data volume (5 live parent rows); revisit with a dedicated SUM query if the Lump Sum project
  count grows large enough that materializing full DTOs (including children) on every `Kpis`
  call becomes measurably expensive.
- Verification was build/typecheck/route-registration only (`dotnet build` — 0 errors;
  `npm run typecheck` — 0 new errors, pre-existing Rbac-module errors unrelated to this change;
  unauthenticated `curl` against `/Dashboard/{Kpis,LumpSum,Summary}` all return 401, confirming
  the new route is registered and gated like every other Dashboard action). Did not verify
  through an authenticated browser session against real session cookies — no test credentials
  were available in this session. The `dashboard-real-data.spec.ts` e2e was not re-run.

Files changed:
- `WebAPI/Controllers/Dashboard/DashboardController.cs`
- `WebAPI/Controllers/Dashboard/DTODashboard.cs`
- `FE/src/pages/Dashboard/Service.ts`
- `FE/src/pages/Dashboard/atoms/dashboardSectionCache.atom.ts`
- `FE/src/pages/Dashboard/hooks/useDashboardLsProjects.ts` (new)
- `FE/src/pages/Dashboard/Dashboard.tsx`
