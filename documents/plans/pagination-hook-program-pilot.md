# Plan: Shared Pagination Hook — BE Keyset Contract, Piloted on Program.tsx

Status: Implemented
Created: 2026-07-27
Source: Conversation — user pointed at FE/src/pages/Program/Views/Program.tsx pagination and a new BE pagination contract sample, asked whether to build a shared utility.

## Goal

Replace the hand-rolled, per-page pagination pattern (currently duplicated across ~10 pages) with a shared `usePagination` hook + `PaginationBar` component that speaks the backend's new keyset-augmented pagination contract, piloted end-to-end on the Program list page before rolling out elsewhere.

## Context

Pagination is currently duplicated by hand across ~10 pages (Program, Project, ProjectGroup, Modification, five Rbac tabs, CodeTables). Each page has its own `Paginate(page)` handler, its own inline "First / windowed page numbers / Last" JSX with duplicated window-math, and its own copy of the request/response typing. The backend is now changing its pagination contract to add a keyset fast-path for Next/Previous navigation (avoiding OFFSET scans on large tables), while still supporting arbitrary page-jump via plain `page`/`limit`:

Request:
```json
{
  "Filters": { "Name": "", "StartYear": null, "StageName": "", "Type": "" },
  "limit": 10,
  "page": 0,
  "Direction": 1,          // 1 = Next, 2 = Previous — present only for Next/Previous clicks
  "PreviousFilteredId": 0,
  "NextFilteredId": 0
}
```
Response:
```json
{
  "lists": [], "page": 2, "limit": 10, "total": 0, "totalPages": 0,
  "PreviousFilteredId": null, "NextFilteredId": null,
  "HasPrevious": true, "HasNext": false
}
```

Rather than copy the new fields into 10 files, this plan extracts the logic into a shared `usePagination` hook + `PaginationBar` component, and migrates **Program.tsx only** as the pilot. The other ~9 pages are explicitly out of scope — they migrate in follow-up work once the pattern is validated.

## Acceptance Criteria

As a user browsing the Program list, I want paginated navigation to use keyset cursors for Prev/Next clicks and page-based lookup for numbered page jumps, so that sequential navigation stays fast regardless of dataset size, while direct page-jump still works as before.

- [ ] Clicking a numbered page button sends `{ Filters, limit, page: N }` — no `Direction`/cursor fields — and the table updates to that page.
- [ ] Clicking "Next" sends `{ Filters, limit, page: currentPage+1, Direction: 1, NextFilteredId: <prior response's NextFilteredId> }`.
- [ ] Clicking "Previous" sends `{ Filters, limit, page: currentPage-1, Direction: 2, PreviousFilteredId: <prior response's PreviousFilteredId> }`.
- [ ] "Previous" is disabled when the last response's `HasPrevious` is `false`; "Next" is disabled when `HasNext` is `false`.
- [ ] "First"/"Last" are plain page-jump buttons (`page: 1` / `page: totalPages`), disabled at the respective boundary, with no `Direction`/cursor fields sent.
- [ ] Search submit, Clear, and Apply Filters all reset to `page: 1` and clear cursor state (no stale `PreviousFilteredId`/`NextFilteredId` sent after a filter change).
- [ ] After a successful delete, the list refreshes at the current page/filters (no cursors sent).
- [ ] "Showing X to Y of Z" summary still renders correctly off the hook's data.
- [ ] Program.tsx's local `PaginationResponse<T>` interface (current lines 8-15) is removed; the global type is used instead.
- [ ] Pagination bar renders nothing when `totalPages <= 1`.
- [ ] `npx tsc --noEmit` (or the project's existing type-check script) passes with no new errors in the touched files.

## Approach

**Types (`FE/src/types/Pagination.d.ts`)** — extend, don't replace. Add four *optional* fields to `PaginationResponse<T>` (`PreviousFilteredId?`, `NextFilteredId?`, `HasPrevious?`, `HasNext?`) so the ~9 un-migrated pages keep compiling untouched. Add a new ambient generic `PaginatedRequest<TFilters>` shape (`Filters?`, `limit`, `page`, `Direction?: 1 | 2`, `PreviousFilteredId?`, `NextFilteredId?`) that the hook constructs and `fetchProgram` accepts.

**`usePagination<TFilters, TItem>` hook** (`FE/src/hooks/usePagination.ts`) — follows this codebase's existing hook style (`useDialog.ts`, `usePermittedRoutes.ts`: plain `useState`/`useCallback`, no Jotai). Takes the page's own fetch function as a parameter (each page hits a different endpoint) plus `{ initialFilters, limit }`. Tracks `data`, `isLoading`, `currentFilters` in state; tracks the last response's cursor ids in a `useRef` (cursor changes shouldn't trigger re-renders — they're only read on the next Next/Previous call). Exposes:
- `goToPage(n)` — plain page-jump, no `Direction`/cursors.
- `goNext()` / `goPrevious()` — sends `Direction` + the matching cursor id from the ref.
- `applyFilters(filters)` — resets to page 1 and **clears the cursor ref** (critical: stale cursors after a filter change would make the BE's keyset lookup return rows from the old filter set).
- `refresh()` — re-fetches current page/filters, no cursors (used after delete).
- `hasPrevious`/`hasNext` derived as `data.HasPrevious ?? data.page > 1` / `data.HasNext ?? data.page < data.totalPages`, so it degrades gracefully if a response omits the new fields.

**`PaginationBar` component** (`FE/src/components/tailwindui/PaginationBar.tsx`) — new component built on the existing presentational primitives in `FE/src/components/tailwindui/pagination.tsx` (which need no changes). This also fixes a latent naming bug in Program.tsx today: `PaginationPrevious`/`PaginationNext` are currently used to render "First"/"Last" jump buttons. The new component gives correct semantics — separate First/Last (page-jump, page-boundary-disabled) from Prev/Next (keyset, `hasPrevious`/`hasNext`-disabled) — and owns the page-window math (`Math.max(1, page-3)+index`) in one place instead of copy-pasted per page.

**Program.tsx migration** — remove `ProgramData`/`ProgramFilters`/`isLoading` state, the local `PaginationResponse<T>` interface, `Paginate`, and the mount `useEffect`; replace with one `usePagination(fetchProgram, {...})` call. Rewire `handleSearchSubmit`, `handleClearSearch`, `handleApplyFilters`, and the delete dialog's `onDeleteSuccess` to go through the hook's `applyFilters`/`refresh` instead of calling `fetchProgram` directly. Swap the pagination JSX block for `<PaginationBar>`.

**`FilterDialogProgramList.tsx` — needs real logic changes, not just a type rename.** On inspection, this dialog's internal state (`localFilters`) is currently typed and used as a full `ProgramPagination` (spreads `page`/`limit` fields, calls `onApplyFilters({...localFilters, page: 1})`), not just the filter fields. Narrowing its props to `ProgramFilter` requires updating `handleApply`, `handleClear`, and `handleFilterChange` to manage `ProgramFilter`-only local state and drop the manual `page: 1` reset (the hook's `applyFilters` already does that). This is folded into the Program.tsx migration task, not a trivial prop-type edit.

**Two BE contract details need confirmation before/while implementing** (see Risks) — the `Filters` casing (current code sends lowercase `filters`) and whether `ProgramFilter.YearStart` should become `StartYear` to match the sample. Where unconfirmed, the plan defaults to matching the BE sample literally (`Filters`, `StartYear`) since that's the newer, explicitly-provided source of truth — but this should be verified against a real BE response before merging, not just inferred from the sample.

## Tasks

### Senior (senior-engineer implements directly)
- Design and implement `usePagination<TFilters, TItem>` hook (`FE/src/hooks/usePagination.ts`), including cursor-ref handling and the four navigation methods described above.
- Implement `PaginationBar` component (`FE/src/components/tailwindui/PaginationBar.tsx`) — window math, First/Prev/numbered/Next/Last semantics, returns `null` when `totalPages <= 1`.
- Migrate `Program.tsx` to the hook + component (state removal, handler rewiring, JSX swap).
- Update `FilterDialogProgramList.tsx` internal state/handlers to work with `ProgramFilter` directly (not `ProgramPagination`), and update its prop types.

### Junior (delegate to junior-engineer)
- Update `FE/src/types/Pagination.d.ts`: add the four optional response fields and the new `PaginatedRequest<TFilters>` interface; leave `PaginationParams` untouched.
- Update `FE/src/pages/Program/Model.d.ts`: remove `ProgramPagination` (superseded by `PaginatedRequest<ProgramFilter>`); update `ProgramFilter.YearStart` → `StartYear` if confirmed with BE (flag as blocked/TODO in the PR if not confirmed by implementation time).
- Update `fetchProgram`'s parameter type in `FE/src/pages/Program/Service.ts` from `ProgramPagination` to `PaginatedRequest<ProgramFilter>` (body unchanged).

### Documentation (tech-writer)
- Update `FE/src/pages/Program/program.md`: replace the `ProgramData`/`ProgramFilters`/`isLoading` rows in the state table with the `usePagination` hook; update the `ProgramPagination`/`ProgramFilter` row in the Data Models table (line ~71) to reflect `PaginatedRequest<ProgramFilter>`; add `usePagination` and `PaginationBar` to any dependencies/component listing.

## Files / Components Touched

- `FE/src/types/Pagination.d.ts` — extend response type, add request type
- `FE/src/hooks/usePagination.ts` — new
- `FE/src/components/tailwindui/PaginationBar.tsx` — new
- `FE/src/pages/Program/Views/Program.tsx` — migration
- `FE/src/pages/Program/Model.d.ts` — type updates
- `FE/src/pages/Program/Service.ts` — `fetchProgram` signature only
- `FE/src/pages/Program/dialogs/FilterDialogProgramList.tsx` — internal state + prop types
- `FE/src/pages/Program/program.md` — doc update

**Out of scope / follow-up** (not touched by this plan): `FE/src/pages/Project/Views/Project.tsx`, `FE/src/pages/ProjectGroups/Views/ProjectGroup.tsx`, `FE/src/pages/Modification/views/ModifcationList.tsx`, `FE/src/pages/Rbac/components/{UsersTab,RoutePermissionsTab,UserGroupsTab,ApiPermissionsTab,AppModuleTab}.tsx`, `FE/src/pages/CodeTables/tables/*`.

## Risks / Open Questions / Assumptions

- **`Filters` casing**: current live code sends lowercase `filters`; the new BE sample uses `Filters`. If the deployed endpoint hasn't switched yet, sending `Filters` could silently return unfiltered results. Verify against the actual `/program/showprogram` deployment before merging.
- **`YearStart` vs `StartYear`**: `ProgramFilter` currently has `YearStart`; the BE sample shows `StartYear`. Confirm which the live endpoint expects — affects `Model.d.ts`, the filter badges in `Program.tsx`, and `FilterDialogProgramList.tsx`.
- **Page indexing**: BE sample shows `"page": 0`; current FE starts at `page: 1`. Confirm whether this is 0-indexed now or just an illustrative placeholder — decrementing incorrectly would silently fetch the wrong page.
- **`sortField`/`sortDirection`**: present in today's `ProgramPagination` but absent from the new contract sample and from the proposed `PaginatedRequest<TFilters>`. Confirm whether `showprogram` still accepts sort params; if so, add them back as optional fields.
- **Cursor invalidation on filter change**: `applyFilters()` must clear the cursor ref before the next Next/Previous call, or a stale cursor from the old filter set could return incorrect rows via the BE's keyset lookup. Must be covered by manual testing, not just typed away.
- **Empty-page-after-delete edge case**: if the deleted row was the last one on the last page, `refresh()` re-fetching that page number returns an empty result; no auto-decrement is implemented in this pilot. Acceptable for now, flagged as a future improvement.

## Verification

- Run the FE type-check (`npx tsc --noEmit` or equivalent existing script) — no new errors in touched files.
- Manually exercise the Program list in the browser: numbered page jump, Next, Previous, First, Last, search submit, clear search, apply/clear filters from the dialog, and delete-then-refresh — for each, inspect the network request payload (DevTools) to confirm it matches the "Payload construction per action" behavior above, and confirm the UI (table rows, disabled states, "Showing X to Y of Z" text) updates correctly.

## Completion Log
Date: 2026-07-27
- Senior: Implemented `usePagination<TFilters, TItem>` hook (`FE/src/hooks/usePagination.ts`) and `PaginationBar` component (`FE/src/components/tailwindui/PaginationBar.tsx`); migrated `Program.tsx` to use both, removing `ProgramData`/`ProgramFilters`/the old combined `isLoading` state, the local `PaginationResponse<T>` shadow interface, `Paginate()`, and the mount `useEffect`; rewired search/clear/filter/delete/add handlers through `pagination.applyFilters`/`refresh`; reworked `FilterDialogProgramList.tsx`'s internal state and props from `ProgramPagination` to `ProgramFilter` directly (not just a type rename — `handleApply`/`handleClear`/`handleFilterChange` logic changed).
- Junior: (1) extended `PaginationResponse<T>` with optional `PreviousFilteredId`/`NextFilteredId`/`HasPrevious`/`HasNext` and added ambient `PaginatedRequest<TFilters>` in `FE/src/types/Pagination.d.ts`; (2) removed `ProgramPagination` and renamed `ProgramFilter.YearStart` → `StartYear` in `FE/src/pages/Program/Model.d.ts`; (3) updated `fetchProgram`'s parameter type to `PaginatedRequest<ProgramFilter>` in `FE/src/pages/Program/Service.ts`.
- Documentation: Updated `FE/src/pages/Program/program.md` — removed the `ProgramPagination` row and corrected `ProgramFilter`'s field list in the Data Models table, updated the `fetchProgram` service signature/notes, replaced the `ProgramData`/`ProgramFilters` state-table rows with `pagination` (`usePagination`) and `isEnumsLoading`, updated Key Behaviors bullets, documented `FilterDialogProgramList`'s new prop types, and added `usePagination`/`PaginationBar` to the dependencies table.

Deviations / flags:
- `AddProgramDialog.onSubmit` was changed from an optimistic local-state push (which no longer exists) to `pagination.refresh()` — a deliberate equivalent, not in the original task text but required by the state removal.
- The `Filters` casing and `YearStart`→`StartYear` rename were applied per the plan's stated assumption (matching the BE sample literally); **still needs verification against the live `/program/showprogram` deployment** before this is safe to merge — see Risks section above, unchanged/unresolved.
- Empty-page-after-delete edge case (no auto-decrement) is present as originally scoped — not fixed in this pilot.
- Migration of the other ~9 duplicated pages remains out of scope, as planned.

Files changed:
- `FE/src/types/Pagination.d.ts` (modified)
- `FE/src/pages/Program/Model.d.ts` (modified)
- `FE/src/pages/Program/Service.ts` (modified)
- `FE/src/pages/Program/Views/Program.tsx` (modified)
- `FE/src/pages/Program/dialogs/FilterDialogProgramList.tsx` (modified)
- `FE/src/pages/Program/program.md` (modified)
- `FE/src/hooks/usePagination.ts` (new)
- `FE/src/components/tailwindui/PaginationBar.tsx` (new)
