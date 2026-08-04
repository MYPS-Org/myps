# Plan: LSWallet UI Visual Parity with Project Module

Status: Implemented
Created: 2026-07-10
Source: User conversation — LSWallet was extracted into its own module from what used to be a Project record (`IslandCode === 'LS'`), and its UI diverged stylistically from Project's during that build. User wants it restyled to look/feel consistent with Project's UI conventions — explicitly UI/structure only, no data or logic changes.

## Context

`FE/src/pages/Project/` is the mature reference module (card chrome, collapsible sections, shared `Table` component, consistent dialog chrome). `FE/src/pages/LSWallet/` was built fast against mock data (see `documents/plans/lump-sum-wallet.md`) and ended up with its own divergent conventions: flat non-collapsible cards, raw HTML tables in two places, three different competing dialog chrome styles even within LSWallet's own dialogs, and one component (`WalletBalanceWidget`) using `dark:` classes that don't exist anywhere else in the app (confirmed dead code — `FE/tailwind.config.js:7` sets `darkMode: false`).

An Explore agent read every relevant file pair in full and produced a structural diff; a senior-engineer planning pass turned that into concrete per-axis decisions. I independently verified the two highest-risk claims by reading the actual files: (1) `CreateWalletDialog.tsx` already wraps `WalletDetailsSection`/`FundingProfileSection`/`WalletComponentSection` in its own `border border-gray-200` + chevron-header card — so those three components currently render a **redundant nested card-in-card** there today; stripping their internal card+h3 fixes an existing bug in `CreateWalletDialog`, not just a new inconsistency in `LSWalletDetail`. (2) `DeleteItemizedProjectDialog.tsx` and `PublishItemizedProjectDialog.tsx` both import `XMarkIcon` and use the bordered-header-with-close-button chrome, confirming they need the same conversion as `CreateItemizedProjectDialog.tsx`.

## Goal

Make LSWallet's pages, forms, and dialogs visually/structurally match Project's established conventions (card chrome, collapsible sections, shared Table component, one consistent dialog chrome, one badge convention, list-page layout, page width) — with zero changes to `Model.d.ts`, `Service.ts`, the mock store, validation rules, business logic, routing, or RBAC.

## Acceptance Criteria

As a user navigating LSWallet, I want the pages and forms to look and feel consistent with the Project module, so that the two feel like parts of the same application.

- [ ] `LSWalletList` and `LSWalletDetail` outer wrappers use `max-w-10xl mx-auto` (matches Project's constrained width)
- [ ] `LSWalletList` header, search, table, and pagination are enclosed in one `bg-white rounded-lg shadow-sm border border-gray-200` card with a `px-6 py-4 border-b` header strip, matching `Project.tsx`
- [ ] `LSWalletList` search input has the magnifying-glass icon inlined as an absolute left-icon with `pl-10` padding (not a separate button)
- [ ] `LSWalletDetail`'s five main blocks (Wallet Details, Funding Profile, Component Details, Itemized Projects, Revision History) each render as a collapsible `ring-1 ring-gray-900/5 sm:rounded-xl` card with a clickable header strip (title + `ChevronDownIcon`/`ChevronRightIcon`), matching `ProjectForm.tsx`'s pattern; all expanded by default; toggling works without error
- [ ] `WalletDetailsSection`, `FundingProfileSection`, `WalletComponentSection` no longer render their own outer card/h3 — content nests cleanly inside whichever parent provides the chrome (`LSWalletDetail`'s collapsible sections, or `CreateWalletDialog`'s existing nested cards, which must still render correctly afterward)
- [ ] Itemized Projects table and Revision History table use the shared `Table`/`TableHead`/`TableBody`/`TableRow`/`TableCell`/`TableHeader` components — no raw `<table>` elements remain in `LSWalletDetail.tsx`
- [ ] Per-project revision expansion uses chevron+state (keyed by `project.Id`, default collapsed), not native `<details>`/`<summary>`
- [ ] `WalletBalanceWidget` and `WalletStatusBadge` have no `dark:` classes remaining; all other visuals unchanged
- [ ] Revision status pills use `rounded-full` consistently (fixing the current `rounded` outlier)
- [ ] `CreateItemizedProjectDialog`, `PublishItemizedProjectDialog`, `DeleteItemizedProjectDialog` all use the plain-inline-`DialogTitle` chrome (no bordered header strip, no `XMarkIcon` close button, no `dark:` classes) — matching `CreateWalletDialog`/`ReplenishWalletDialog`, which stay visually unchanged
- [ ] No fields added/removed/renamed in any Model; no validation, service, store, routing, or RBAC code touched

## Approach

Eight styling axes, one canonical pick each, all sourced from Project's existing conventions:

1. **Page width** — `max-w-10xl mx-auto` on both LSWallet pages.
2. **Card chrome** — `LSWalletDetail`'s top-level sections adopt ProjectForm's `ring-1 ring-gray-900/5 sm:rounded-xl` + clickable header-strip pattern; `LSWalletList` gets one bordered card wrapping the whole page body (matches `Project.tsx`, not `ProjectForm.tsx` — list vs. detail use different chrome in Project too); `CreateWalletDialog`'s nested sub-cards keep `border border-gray-200` (dialog context, lighter weight is fine and already consistent internally).
3. **Section components lose their own chrome** — `WalletDetailsSection`/`FundingProfileSection`/`WalletComponentSection` drop their outer card div and internal `h3`; the parent (collapsible section in `LSWalletDetail`, or the existing nested card in `CreateWalletDialog`) supplies both.
4. **Collapsible sections** — adopt ProjectForm's chevron + boolean-state pattern for all five `LSWalletDetail` blocks (`isDetailsOpen`, `isFundingOpen`, `isComponentOpen`, `isProjectsOpen`, `isRevHistoryOpen`, all default `true`); per-project revision rows convert from `<details>` to chevron + `Record<number, boolean>` keyed by `project.Id` (default collapsed, matching current `<details>` behavior).
5. **Tables** — replace both raw `<table>` blocks in `LSWalletDetail.tsx` with the shared `Table` components already used by `ComponentCostForm.tsx`/`Project.tsx`.
6. **Dialog chrome** — canonicalize on the plain-inline-`DialogTitle` style already used by the majority of LSWallet's own dialogs (`ReplenishWalletDialog`, `EditDrawAmountDialog`, `CreateWalletDialog`, `DeleteWalletDialog`, etc.); convert the three outliers (`CreateItemizedProjectDialog`, `PublishItemizedProjectDialog`, `DeleteItemizedProjectDialog`) to match, and strip their `dark:` classes.
7. **Badges** — `WalletStatusBadge` keeps its border + `rounded-full` chrome (appropriate for a stage pill) but drops all `dark:` variants; fix `revisionStatusClass` in `LSWalletDetail.tsx` to use `rounded-full` instead of `rounded` for consistency with the publish-status pill next to it.
8. **List page** — inline the search icon into the input, wrap header+search+table+pagination in one card, downgrade the page title from `h1` to the `h3.text-lg font-medium` strip style Project uses.

Everything under `dark:` is safe to remove outright: `tailwind.config.js` disables dark mode entirely, so those classes currently compile to no CSS and have zero user-visible effect.

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- `LSWalletDetail.tsx` full orchestrator rework: add 5 section-collapse states + 1 per-project revision-expansion state map, wrap all five blocks in the ring-1/chevron pattern, swap both raw tables for shared `Table` components, convert the `<details>` revision rows to chevron+state, fix `revisionStatusClass` to `rounded-full`, apply `max-w-10xl mx-auto`. This is the one file where card-chrome, collapsible state, and table-component changes all interact and need a single coherent pass.

### Junior (precise, scoped — delegate to junior-engineer, can run in parallel since files are disjoint)
- Strip outer card wrapper + internal `h3` from `WalletDetailsSection.tsx`, `FundingProfileSection.tsx`, `WalletComponentSection.tsx` (3 separate scoped edits; verify `CreateWalletDialog.tsx` still renders cleanly after each, since it consumes all three)
- Strip all `dark:` classes from `WalletBalanceWidget.tsx` (keep light-mode logic/colors intact)
- Strip all `dark:` classes from `walletStatusBadge.tsx` (keep border + `rounded-full` + light-mode colors)
- Restyle `LSWalletList.tsx`: `max-w-10xl mx-auto` wrapper, single bordered card around header/search/table/pagination with `px-6 py-4 border-b` header strip, inline search icon with `pl-10`
- Convert `CreateItemizedProjectDialog.tsx` from bordered-header+X chrome to plain inline `DialogTitle`, strip `dark:` classes, standardize footer to `flex justify-end gap-3 border-t pt-6`
- Convert `PublishItemizedProjectDialog.tsx` — same chrome conversion, preserve the compliance-check grid/pass-fail icons/loading state as-is
- Convert `DeleteItemizedProjectDialog.tsx` — same chrome conversion, preserve the 3-tier (hard/soft/blocked) logic and messaging as-is

### Documentation (tech-writer)
- None required — this is a pure visual restyle with no new user-facing behavior or workflow change to document. (If `LSWallet.md` contains screenshots or written descriptions of the old flat-card layout, a quick check/update is optional but not required for this plan.)

## Files / Components Touched

**Modified:**
- `FE/src/pages/LSWallet/Views/LSWalletDetail.tsx` (senior)
- `FE/src/pages/LSWallet/Views/LSWalletList.tsx` (junior)
- `FE/src/pages/LSWallet/components/WalletDetailsSection.tsx` (junior)
- `FE/src/pages/LSWallet/components/FundingProfileSection.tsx` (junior)
- `FE/src/pages/LSWallet/components/WalletComponentSection.tsx` (junior)
- `FE/src/pages/LSWallet/components/WalletBalanceWidget.tsx` (junior)
- `FE/src/pages/LSWallet/utils/walletStatusBadge.tsx` (junior)
- `FE/src/pages/LSWallet/dialogs/CreateItemizedProjectDialog.tsx` (junior)
- `FE/src/pages/LSWallet/dialogs/PublishItemizedProjectDialog.tsx` (junior)
- `FE/src/pages/LSWallet/dialogs/DeleteItemizedProjectDialog.tsx` (junior)

**Confirmed NOT touched:** `ReplenishWalletDialog.tsx`, `EditDrawAmountDialog.tsx`, `CreateWalletDialog.tsx`, `ItemizedProjectRevisionDialog.tsx`, `ApproveRevisionDialog.tsx`, `RejectRevisionDialog.tsx`, `ReturnRevisionForReviewDialog.tsx`, `DeleteWalletDialog.tsx`, `AdvanceProgramStageDialog.tsx`, `WalletActionButtons.tsx`, and everything in `Model.d.ts`/`Service.ts`/`store/`/`hooks/`/`rules/`/`mockData/` (already visually consistent or out of scope by design).

**Reused as-is (already correct):** `FE/src/components/tailwindui/table.tsx`, `FE/src/components/tailwindui/button.tsx`, `FE/src/components/tailwindui/pagination.tsx`, `FE/src/components/tailwindui/collapsible-table.tsx`, `FE/src/components/tailwindui/date-input.tsx`, `FE/src/components/ui/SearchableDropdown.tsx`, `@heroicons/react/24/outline` (`ChevronDownIcon`/`ChevronRightIcon` already used elsewhere).

## Risks / Open Questions / Assumptions

- **CreateWalletDialog nesting** — stripping the three section components' own card verified safe: `CreateWalletDialog.tsx` already wraps each in `border border-gray-200` + chevron-header + `px-6 py-4` content div, so the naked content nests correctly (verified by reading the file directly). Junior implementors should still visually check the dialog after each strip.
- **Revision expansion key** — must key the new `Record<number, boolean>` by `project.Id` (numeric PK), not `project.ProjectId` (string AIP code) — a mix-up would break per-row toggle state. Default state `{}` (all collapsed) to match current `<details>` behavior.
- **Dark-mode removal is confirmed safe** — `FE/tailwind.config.js:7` sets `darkMode: false`; every `dark:` class in the touched files currently produces no CSS. No visual regression risk.
- **Table component padding/reflow** — the shared `Table` components may impose slightly different default spacing than the current raw `<table>` markup; verify the 5-column Itemized Projects and 6-column Revision History layouts stay readable at standard widths after the swap.
- **CreateWalletDialog's `max-h-96 overflow-y-auto` scroll cap** — once the three section components lose their own padding, their content is slightly more compact inside `CreateWalletDialog`'s nested cards. Leave the scroll cap as-is; only revisit if the implemented result looks obviously wrong.

## Verification

No automated test suite covers this module — verify by running the app and visually walking through:
1. `npm run dev` in `FE/`, navigate to `/lumpsum`.
2. On the list page: confirm the card wrapper, inline search icon, and `max-w-10xl` width match `/projects`' list page look.
3. Open a wallet detail page: confirm all five sections are collapsible (ring-1 card + chevron), expanded by default, and toggle correctly.
4. Confirm Itemized Projects and Revision History render via the shared `Table` component (visually: consistent header/row styling with other `Table`-based pages) and that per-project revision rows expand/collapse via chevron, not native disclosure triangles.
5. Open `CreateWalletDialog`, confirm the three section forms still render cleanly nested inside its existing chevron cards (no double-border/double-title).
6. Open `CreateItemizedProjectDialog`, `PublishItemizedProjectDialog` (against a wallet with itemized projects), and a delete-itemized-project flow for each of the three tiers — confirm all three now match the plain-`DialogTitle` chrome of `ReplenishWalletDialog`/`CreateWalletDialog`.
7. Confirm `WalletBalanceWidget` and `WalletStatusBadge` render identically to before (just without inert dark-mode classes) — no visual difference expected since the app has no dark mode toggle wired up.

## Completion Log
Date: 2026-07-13
- Senior: Reworked `LSWalletDetail.tsx` — added `max-w-10xl mx-auto` wrapper, converted all five main blocks (Wallet Details, Funding Profile, Component Details, Itemized Projects, Revision History) to `ring-1 ring-gray-900/5 sm:rounded-xl` collapsible cards with chevron headers (5 new boolean states, all default `true`), replaced both raw `<table>` blocks with the shared `Table`/`TableHead`/`TableBody`/`TableRow`/`TableCell`/`TableHeader` components, converted per-project revision `<details>`/`<summary>` to chevron + `Record<number, boolean>` state keyed by `project.Id` (default `{}`), and fixed `revisionStatusClass` pill from `rounded` to `rounded-full`.
- Junior:
  - Stripped outer card + `h3` from `WalletDetailsSection.tsx`, `FundingProfileSection.tsx`, `WalletComponentSection.tsx`; verified clean nesting inside `CreateWalletDialog.tsx`'s existing chevron cards (no double-border/double-title).
  - Stripped all `dark:` classes from `WalletBalanceWidget.tsx` (13 variants removed) and `walletStatusBadge.tsx` (all 5 stage colors), light-mode output unchanged.
  - Restyled `LSWalletList.tsx`: `max-w-10xl mx-auto` wrapper, single `bg-white rounded-lg shadow-sm border border-gray-200` card wrapping header/search/table/pagination with `px-6 py-4 border-b` header strip, title downgraded to `h3.text-lg font-medium`, search input got an inline absolutely-positioned `MagnifyingGlassIcon` with `pl-10`.
  - Converted `CreateItemizedProjectDialog.tsx`, `PublishItemizedProjectDialog.tsx`, `DeleteItemizedProjectDialog.tsx` from bordered-header+`XMarkIcon` chrome to the canonical plain-inline `DialogTitle` chrome (matching `ReplenishWalletDialog`/`CreateWalletDialog`), stripped all `dark:` classes, standardized footers to `flex justify-end gap-3 border-t pt-6`. All business logic (compliance check, 3-tier delete, draw validation, submit handlers) left untouched.
- Documentation: none required (pure visual restyle, no user-facing behavior/workflow change — per plan).

Deviations / flags: None reported by any agent. All acceptance criteria addressed as specified.

Files changed:
- `FE/src/pages/LSWallet/Views/LSWalletDetail.tsx`
- `FE/src/pages/LSWallet/Views/LSWalletList.tsx`
- `FE/src/pages/LSWallet/components/WalletDetailsSection.tsx`
- `FE/src/pages/LSWallet/components/FundingProfileSection.tsx`
- `FE/src/pages/LSWallet/components/WalletComponentSection.tsx`
- `FE/src/pages/LSWallet/components/WalletBalanceWidget.tsx`
- `FE/src/pages/LSWallet/utils/walletStatusBadge.tsx`
- `FE/src/pages/LSWallet/dialogs/CreateItemizedProjectDialog.tsx`
- `FE/src/pages/LSWallet/dialogs/PublishItemizedProjectDialog.tsx`
- `FE/src/pages/LSWallet/dialogs/DeleteItemizedProjectDialog.tsx`
