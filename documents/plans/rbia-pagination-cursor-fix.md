# Plan: Fix RBIA Pagination (Road / Road Section / Bridge)

Status: Implemented
Created: 2026-10-20
Source: User report — "the pagination [in the RBIA module] is not working", surfaced from FE/src/pages/Rbia/hooks/useRoadData.ts

## Goal

Fix pagination on the RBIA module's three admin list screens (Roads, Road Sections, Bridges), where clicking any page number, Next, or Last silently re-renders page 1 every time, by adopting the same keyset-pagination pattern (`usePagination` + `PaginationBar`) already used correctly elsewhere in the codebase (`AddInfraDialog.tsx` against the sibling Infra endpoints).

## Acceptance Criteria

As a DPWH RBIA administrator, I want the Roads/Road Sections/Bridges list pagination controls to actually move between pages, so that I can browse past the first page of records.

- [ ] On the Roads list, clicking a numbered page button loads that page's data (not page 1's), and the clicked page is shown as current.
- [ ] On the Roads list, Next/Previous move one page at a time and disable correctly at the first/last page.
- [ ] On the Roads list, First/Last jump to page 1 / the last page in one request.
- [ ] Applying a filter or search term resets pagination to page 1, and subsequent page navigation on the filtered result set still works correctly.
- [ ] Deleting a row re-fetches from the backend (via `applyFilters()`, not `refresh()` — see Approach) so the list stays consistent, instead of only splicing the row out of local state.
- [ ] All of the above also hold for the Road Sections list and the Bridges list.
- [ ] Every pagination request sent to the backend includes a `Navigation` value and the matching cursor field (`PreviousFilteredId`/`NextFilteredId`/`PageCursorId` as appropriate) — verified via the browser Network tab.
- [ ] `FE` type-checks clean (`tsc`) with no `any`-typed gaps introduced in the new adapter functions.

## Approach

The backend's `ShowFutureRoads` / `ShowFutureRoadSections` / `ShowFutureBridge` endpoints all use `FilterDataCursor` (`EnumPagination<T>` — `DBHelper/Models/Enums/Pagination.cs`), which is keyset/cursor pagination, not offset pagination. Every request must carry a `Navigation` enum (`First`/`Previous`/`Next`/`Last`/`Page`) plus the matching cursor id. If `Navigation` is omitted, the DTO defaults to `Navigation.First`, so the backend silently always returns page 1 — which is exactly what RBIA's three hooks do today (they only ever send `{ page, limit, filters }`).

This exact problem is already solved correctly elsewhere: `FE/src/hooks/usePagination.ts` is a shared hook that speaks the full keyset contract (tracks cursors, walks to unvisited pages, exposes `goToPage`/`goNext`/`goPrevious`/`goFirst`/`goLast`/`hasPrevious`/`hasNext`), and `FE/src/pages/Project/dialogs/AddInfraDialog.tsx` already uses it against the sibling `ShowInfraRoadSections`/`ShowInfraBridges` endpoints (same `FilterDataCursor` backend mechanism), paired with the shared `FE/src/components/tailwindui/PaginationBar.tsx` UI component. The fix adopts this existing, proven pattern rather than inventing a new one — "pagination works the same as others," per user direction.

For each of the three RBIA hooks (`useRoadData.ts`, `useRoadSectionData.ts`, `useBridgeData.ts`), wire `usePagination` in as the thing that actually talks to the backend, replacing the current hand-rolled fetch/page logic, while keeping each hook's external API (what `Road.tsx`/`RoadSection.tsx`/`Bridge.tsx` consume) stable so component changes stay scoped to the pagination UI:

1. Add an inline adapter function per hook (same shape as `fetchRoadSectionsForDialog`/`fetchBridgesForDialog` in `AddInfraDialog.tsx`) translating `usePagination`'s `PaginatedRequest<TFilter>` (capital `Filters`/`SortField`) into the lowercase-`filters` shape the existing `fetchRoads`/`fetchRoadSectionData`/`fetchBridgeData` service calls expect, forwarding `Navigation`/cursor fields through untouched.
2. Instantiate `usePagination<TFilter, TItem>(adapter, { initialFilters, limit, sortField, sortDirection })` inside the hook. Mirror its `data` into the existing Jotai data atom (`roadDataAtom`/`roadSectionDataAtom`/`bridgeDataAtom`) via a `useEffect` so other code reading those atoms (counts, legacy list atoms) keeps working unchanged.
3. Rewire the hook's actions to delegate to `usePagination`:
   - `handlePagination(page)` → `pagination.goToPage(page)`; also expose `goNext`/`goPrevious`/`goFirst`/`goLast`/`hasNext`/`hasPrevious` pass-through for the pagination bar.
   - `handleSearch`/`handleFilterChange`/`handleClearSearch` → update the filters atom as today (keeps `hasActiveFilters`/dialog `initialData` working), then call `pagination.applyFilters(...)` so page resets to 1 and stale cursors are cleared (a real gap today too).
   - The "remove from state" optimistic helper (the only one actually wired to a dialog today, via delete) → call `pagination.applyFilters(pagination.currentFilters ?? {})` instead of locally splicing the list, since a keyset page's cursors can't be trusted after a local splice. **Not `refresh()`**: `refresh()` re-requests the same page number, which breaks if the deleted row was the last one on the last page (that page no longer exists, its cursor is stale) — the same fix is already applied for this exact reason in `FE/src/pages/Program/Views/ProgramDetail.tsx`'s `refreshProjects`. The unused `add`/`update` optimistic helpers are already dead code per `Rbia.md`'s own note — leave them untouched.
   - `initializeData` drops its own `fetchRoads`/equivalent call — `usePagination`'s own mount-time `Navigation: First` fetch covers that; `initializeData` only fetches classifications/DEO init data now.
   - Returned `isLoading` becomes the existing loading flag OR'd with `pagination.isLoading`.
4. In each list component, replace the hand-rolled `<Pagination>...</Pagination>` JSX block (whose "First"/"Last" buttons are mislabeled — they jump to page 1 / last page while visually styled as Previous/Next) with `<PaginationBar currentPage=... totalPages=... hasPrevious=... hasNext=... onGoToPage=... onNext=... onPrevious=... onFirst=... onLast=... isLoading=... />`, matching `AddInfraDialog.tsx`'s existing usage.

`RoadSectionPagination`/`BridgePagination` in `Model.d.ts` already declare the optional keyset fields; `RoadPagination` is missing them and needs the same addition for parity.

### Out of scope
- Column sorting in `Road.tsx` (`handleSortWithDirection`) is local-only UI state that never calls `handleSort` or triggers a re-fetch — a pre-existing, separate bug, not touched here.
- The dead `add`/`update` optimistic-state helpers across all three hooks are left as-is.

## Tasks

### Implementation
- Add `Navigation`/`PreviousFilteredId`/`NextFilteredId`/`PageCursorId` optional fields to `RoadPagination` in `FE/src/pages/Rbia/Model.d.ts` (parity with `RoadSectionPagination`/`BridgePagination`).
- Refactor `FE/src/pages/Rbia/hooks/useRoadData.ts` to use `usePagination` + an adapter for `fetchRoads`, per the Approach above.
- Refactor `FE/src/pages/Rbia/hooks/useRoadSectionData.ts` to use `usePagination` + an adapter for `fetchRoadSectionData`, per the Approach above.
- Refactor `FE/src/pages/Rbia/hooks/useBridgeData.ts` to use `usePagination` + an adapter for `fetchBridgeData`, per the Approach above.
- Update `FE/src/pages/Rbia/components/Road.tsx` to use `PaginationBar` wired to the new hook outputs, removing the old hand-rolled pagination block.
- Update `FE/src/pages/Rbia/components/RoadSection.tsx` to use `PaginationBar` wired to the new hook outputs, removing the old hand-rolled pagination block.
- Update `FE/src/pages/Rbia/components/Bridge.tsx` to use `PaginationBar` wired to the new hook outputs, removing the old hand-rolled pagination block.
- Type-check (`tsc`) and manually verify all Acceptance Criteria in a running dev instance (Roads, Road Sections, Bridges), including Network tab inspection of the `Navigation`/cursor fields.

### Documentation
- Update `FE/src/pages/Rbia/Rbia.md` / `README_State_Management.md` pagination sections to describe the new `usePagination`-backed flow instead of the old hand-rolled `page`-only requests, and correct the stale note about optimistic add/update helpers if it no longer applies.

## Files / Components Touched
- `FE/src/pages/Rbia/Model.d.ts`
- `FE/src/pages/Rbia/hooks/useRoadData.ts`
- `FE/src/pages/Rbia/hooks/useRoadSectionData.ts`
- `FE/src/pages/Rbia/hooks/useBridgeData.ts`
- `FE/src/pages/Rbia/components/Road.tsx`
- `FE/src/pages/Rbia/components/RoadSection.tsx`
- `FE/src/pages/Rbia/components/Bridge.tsx`
- `FE/src/pages/Rbia/Rbia.md`, `FE/src/pages/Rbia/README_State_Management.md` (docs)
- Reused, not modified: `FE/src/hooks/usePagination.ts`, `FE/src/components/tailwindui/PaginationBar.tsx` (pattern source: `FE/src/pages/Project/dialogs/AddInfraDialog.tsx`)

## Risks / Open Questions / Assumptions
- Assumption: mirroring `usePagination`'s `data` into the existing Jotai atoms via `useEffect` is sufficient to keep `roadsCountAtom`/`roadsAtom`/etc. correct for any other code that reads them; no other code was found writing to these atoms independently, which would conflict.
- Behavior change: deleting a row now triggers a real re-fetch (`applyFilters()`, landing on page 1) instead of an instant local splice — a brief loading state may be visible where there wasn't one before, and the list always returns to page 1 after any delete (even when the current page would still be valid). This is considered more correct (keyset cursors can't be trusted after a local splice, and `refresh()` alone is unsafe on the last page) but is a user-visible change worth calling out in review.
- `handleSort` in all three hooks updates the filters atom and calls `pagination.applyFilters(filters)`, but `usePagination`'s `sortField`/`sortDirection` are frozen at hook-init time (by that hook's own design — "no column-sort UI wires this yet, set once at hook init") and `applyFilters` has no way to change them. Since `handleSort` is not wired to any component today (sorting UI only updates local arrow-indicator state, confirmed dead/unreachable — see Out of scope above), this doesn't regress any working behavior, but it means `handleSort` itself doesn't actually change the backend-requested sort order even if called. Documented in-code rather than fixed, since fixing it would require extending `usePagination` itself — out of scope for this pagination bug fix.
- `useRoadData.ts` also owns `roadClassificationsAtom`/`deoListAtom` init fetches unrelated to pagination — care needed to not disturb those while removing the hook's own `fetchRoads` call from `initializeData`.
- Sorting is confirmed broken independently of this fix (never wired to a backend call) — flagged as out of scope per the approved plan, not silently left for the user to assume is fixed.

## Completion Log
Date: 2026-10-20
- Implementation: Added `Navigation`/cursor fields to `RoadPagination`; refactored `useRoadData.ts`, `useRoadSectionData.ts`, `useBridgeData.ts` to delegate fetching to `usePagination` via per-hook adapters, mirroring results into the existing Jotai data atoms; rewired `handlePagination`/`handleSearch`/`handleClearSearch`/`handleFilterChange`/`handleSort` to use `pagination.goToPage`/`applyFilters`; `initializeData` in all three hooks now only fetches init enums (classifications/DEO lists), since `usePagination` owns the mount-time list fetch. Updated `Road.tsx`/`RoadSection.tsx`/`Bridge.tsx` to render the shared `PaginationBar` wired to the new hook outputs, replacing the old hand-rolled (and mislabeled First/Last) pagination block. Type-checked clean (`tsc -b`, same 25 pre-existing unrelated Rbac errors, 0 new) and lint-checked clean (only pre-existing `any` usages remain, same ones present before this change).
- Deviation (flagged, not in original plan): `FutureRoadDialog.tsx` also called `useRoadData()` solely to read `roadClassifications`. Since `useRoadData` now owns a `usePagination` instance that auto-fetches on mount, this would have made every Add/Edit Road dialog open trigger an extra, unwanted paginated-roads network request. Fixed by having `FutureRoadDialog.tsx` read `roadClassificationsAtom` directly via `useAtom` instead of calling the full hook. Verified (via grep) that no other dialog in the module calls `useRoadData`/`useRoadSectionData`/`useBridgeData` the same way.
- Code-review fix: initial implementation had `removeXFromState` call `pagination.refresh()`, which re-requests the *same* page number via its cached cursor. Review caught that this breaks if the deleted row was the last one on the last page (that page no longer exists, cursor is stale → empty/wrong page shown). Switched all three hooks to `pagination.applyFilters(pagination.currentFilters ?? {})` instead (resets to page 1, clears cursors) — the same fix already applied for the identical reason in `FE/src/pages/Program/Views/ProgramDetail.tsx`'s `refreshProjects`. Trade-off: the list now always returns to page 1 after a delete, even when the current page would still be valid. Docs and plan updated to match.
- Code-review note (documented, not changed): `handleSort` in all three hooks calls `pagination.applyFilters()`, but `usePagination`'s `sortField`/`sortDirection` are frozen at hook-init time by that hook's own design, so the new sort order never reaches the backend request. Confirmed via grep that `handleSort` is not called by any component today (sort headers only update local arrow-indicator state) — pre-existing dead code, out of scope for this fix, left in place with an explanatory comment rather than silently "fixed" in a way that would need `usePagination` itself extended.
- Code-review note (deferred, not changed): the adapter functions (`fetchRoadsForPagination` etc.) duplicate the same `PaginatedRequest`→lowercase-`filters` mapping already written in `AddInfraDialog.tsx`'s `fetchRoadSectionsForDialog`/`fetchBridgesForDialog`. Flagged as a worthwhile future simplification (a single generic helper) but left as-is — extracting it would touch files outside this plan's scope.
Deviations / flags: See the three code-review items above (one applied fix, two documented-not-fixed) plus the `FutureRoadDialog.tsx` deviation. No other deviations from the approved plan.
Files changed: `FE/src/pages/Rbia/Model.d.ts`, `FE/src/pages/Rbia/hooks/useRoadData.ts`, `FE/src/pages/Rbia/hooks/useRoadSectionData.ts`, `FE/src/pages/Rbia/hooks/useBridgeData.ts`, `FE/src/pages/Rbia/components/Road.tsx`, `FE/src/pages/Rbia/components/RoadSection.tsx`, `FE/src/pages/Rbia/components/Bridge.tsx`, `FE/src/pages/Rbia/Dialogs/FutureRoadDialog.tsx`, `FE/src/pages/Rbia/Rbia.md`, `FE/src/pages/Rbia/README_State_Management.md`
