# Plan: Module 11 — LS Wallet (Lump Sum Wallet) Frontend

Status: Implemented
Created: 2026-07-09
Source: `lumpsum-wallet-workflow.md`, `ls-wallet-schema.md`, `lumpsum-wallet-process-flow.md` (ADR-021/ADR-025-based reference docs) — user request to build the frontend module against mock data ahead of backend schema finalization.

> **Supersedes** the earlier version of this file (created 2026-07-01), which described a different, full-stack design (`LumpSumWallets`/`LumpSumWalletProjects` tables connecting an existing LS project to existing regular projects). That design predates the ADR-021 (2026-07-01 + amendments) / ADR-025 (2026-07-06) decisions captured in the reference docs above, and is not backend-scoped for this phase. Replaced in full per user confirmation (2026-07-09).

## Context

MYPS needs a new "LS Wallet" concept: a budget container owned by a Program that itemized AIP projects draw funding from (8 workflows, WF-1–WF-8, fully specified in the three reference docs above). The backend schema is still on hold (pending a schema session), so this phase is **frontend-only**: build the full UI against mock data shaped exactly like the eventual API contracts, so swapping mock → real API later only touches the inside of service functions, never components.

Two naming/routing decisions were confirmed with the user before designing:
- Claim the already-reserved, unwired route placeholders `LumpSumList` (`/lumpsum`) and `LumpSumDetails` (`/lumpsum/:projectId`, renamed to `:walletId`) from `FE/src/utils/appRouteList.ts` — avoids extra RBAC route-sync work. A matching sidebar entry already exists, commented out, in `FE/src/layouts/AppSidebar.tsx` (lines 113–116) — re-enable it with the standard `ViewAccess`/`protectedRoutes` permission guard used by the other sidebar items.
- Model the itemized-project revision UI on this codebase's **actual** Modification module pattern (2-stage Region→CO), not the source docs' literal "IO→RO→CO" wording, which doesn't exist anywhere in this codebase.

Deep exploration (3 parallel Explore agents) confirmed the codebase conventions this module must follow: per-feature `Model.d.ts`/`Service.ts`/`Views/`/`components/`/`dialogs/`/`rules/` folder structure, plain-React-state forms validated via `FormValidation.ts`, `SearchableDropdown` for server-driven options, the `GisPlayground/mockData/` precedent for typed mock data, `CollapsibleTable`+`Pagination` for lists, and the declarative `{show, disabled, onClick}[]` action-button pattern from `actionButtons/revisionActions.ts`.

**Critical naming guardrail:** this codebase already has an unrelated existing concept — `ProjectDetails.IslandCode === 'LS'` marks a legacy "Lump Sum project type" with its own "Itemized Lump Sum Import" dialog in `FE/src/pages/Project/`. The new module must never share a type name or folder with that feature. New module folder: `FE/src/pages/LSWallet/`.

## Goal

Ship a frontend-only LS Wallet module covering all 8 workflows against typed mock data, structured so that a later backend integration only requires editing `Service.ts` function bodies — no component changes.

## Acceptance Criteria

As a Program Coordinator, I want to create and manage LS Wallet containers for Programs, link itemized AIP projects to them, and track live funding balances, so that lump-sum budget allocations are controlled and auditable within the MYPS workflow.

- [ ] **WF-1 Create Wallet**: "Add Wallet" opens a 3-section dialog (Project Details / Funding Profile / Component locked to `'LS'`, Total auto = Amount); Program required; new wallet appears in list without reload; `CurrentStage` inherits from Program.
- [ ] **WF-2 Stage Cascade**: dev simulation action bulk-advances `CurrentStage` on all wallets for a Program; reflected on List/Detail; no per-wallet opt-out.
- [ ] **WF-3 Replenish**: decrease blocked (UI + mock service layer); increase raises `Amount`/`Available` live; stage-gated with tooltip explanation when blocked.
- [ ] **WF-4 Create Itemized Project**: Option A (manual Wallet ID entry + validation messages) and Option B (from Wallet Detail, pre-linked) both gated on GAA-R + Available > 0; populate matrix respected (details+funding auto-fill except Amount, component cost never pre-filled); `'LS'` excluded from all project component-type dropdowns; only the wallet-flagged funding line draws down Available.
- [ ] **WF-5 Live Balance**: `WalletBalanceWidget` shows Total/Used/Available live; the doc's worked scenario (10M→12M→itemize 3M→edit to 3.5M→publish freezes 3.5M→later revision doesn't move it→delete unpublished 1M project returns Available) passes end-to-end against seed data.
- [ ] **WF-6 Revision**: "Request Revision" on a published itemized project follows the Region→CO 2-stage chain; wallet `Used` for that project stays frozen at `PublishedDrawAmount` throughout; pre-publish edits bypass revision entirely and flow live.
- [ ] **WF-7 Delete**: 3-tier hard/soft/blocked matrix implemented identically for Wallet and Itemized Project per the decision table; deleting/soft-deleting an unpublished itemized project returns its draw to Available immediately.
- [ ] **WF-8 Publish**: mocked 13-rule check blocks with a specific failing-rules list on failure; on all-pass, mock PCMA accept flips status to Published and captures the `PublishedDrawAmount` snapshot at that exact moment; no "publish wallet" action exists anywhere.
- [ ] **Mock/API-swap**: all data access goes through `Service.ts` only (no component imports `mockData/` directly); every service function has the real `httpClient.post<T>()` shape ready; swapping to real API touches only `Service.ts` function bodies.
- [ ] **Routes/RBAC**: `appRouteList.ts` and `Routes.tsx` updated for `LumpSumList`/`LumpSumDetails` (`:walletId`), sidebar entry re-enabled with permission guard, confirmed with team before merge given RBAC is already synced to these route names.

## Approach

**Module structure** — new self-contained module at `FE/src/pages/LSWallet/`: `Model.d.ts` (all schema-derived TS interfaces, PascalCase, no aliases), `Service.ts` (every function has the real `httpClient.post<T>()` call shape ready/commented, resolves from mock data internally — this is the only file that changes when a real API lands), `mockData/` (typed mock store + seed data, following `GisPlayground/mockData/` provenance-commented precedent), `store/` (Jotai atoms wrapping the mock store so mutations trigger re-renders), `Views/` (`LSWalletList.tsx`, `LSWalletDetail.tsx`), `components/` (form sections, balance widget, action buttons), `dialogs/` (one per user action), `rules/` (validation arrays), `hooks/`, `utils/`.

**Live balance engine (WF-5)** — a pure function `computeWalletBalance(wallet, itemizedProjects)` computes `Total = wallet.Amount`, `Used = SUM(project.PublishedDrawAmount ?? project.CurrentDrawAmount)` over active (non-deleted, non-cancelled) itemized projects, `Available = Total - Used`. `PublishedDrawAmount` is `null` until WF-8 publish captures a snapshot — this is the FE mock's answer to the source docs' unresolved "frozen-Used mechanism" open item. A `walletStoreAtom` (Jotai) backs all reads so every mutation (replenish, itemize, delete, publish) is reflected live without page reload.

**Stage cascade (WF-2)** — since there's no real user-facing trigger for this (it's a side effect of Program stage advance, which is out of scope/backend), it's simulated via a clearly-labeled dev/demo dialog that bulk-updates `CurrentStage` on all wallets matching a `ProgramId` in the mock store.

**Revision (WF-6)** — mirrors `FE/src/pages/Modification/` structurally (Region→CO status codes 1/2/3, Approve/Reject/ForReview dialog trio, Jotai field-permission-store pattern) rather than inventing new revision UI.

**Routing** — rename `:projectId`→`:walletId` in `appRouteList.ts` (safe: routes are currently unwired, zero existing callsites), add `Routes.tsx` entries for `LumpSumList`/`LumpSumDetails`, re-enable the existing commented-out sidebar item in `AppSidebar.tsx`.

**Cross-module touch** — the wallet-exclusive `'LS'` component type must be filtered out of the Project module's component-type dropdown (`ComponentCostDialog.tsx`) via an exported constant `WALLET_EXCLUSIVE_COMPONENT_TYPES`, kept traceable to the LSWallet module.

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- `Model.d.ts` — all schema-derived interfaces + Dto wire types
- Mock store (`mockData/walletMockStore.ts`) — mutation functions (create/replenish/delete/itemize/publish/cascade), each returning shallow copies
- Seed data (`mockData/walletSeedData.ts`) — must reproduce the WF-5 worked numeric scenario exactly
- `Service.ts` — full service layer with the mock/real-API swap seam
- Live balance engine — `computeWalletBalance` pure fn + `walletStoreAtom`/`walletBalanceAtom` (Jotai) + `useWalletBalance` hook
- Declarative action-button config — `walletActions.ts` (stage/balance-gated show/disabled logic) + `WalletActionButtons.tsx`
- Route wiring — rename param, add `Routes.tsx` entries, re-enable sidebar item (verify zero existing callsites first)
- Revision store — Jotai atoms mirroring `fieldPermissionStore.ts` (Region/CO status)
- `'LS'` component-type exclusion — constant + filter change in `Project/dialogs/ComponentCostDialog.tsx`
- `LSWalletDetail.tsx` — master orchestrator page (all section state, mutation callbacks, live recalculation wiring)

### Junior (precise, scoped — delegate to junior-engineer)
- `walletFormRules.ts` validation rules
- `WalletStatusBadge.tsx` (stage/status pill)
- `WalletBalanceWidget.tsx` (Total/Used/Available cards + progress bar, presentational only)
- `WalletDetailsSection.tsx`, `FundingProfileSection.tsx`, `WalletComponentSection.tsx` (form sections)
- `CreateWalletDialog.tsx`, `ReplenishWalletDialog.tsx`, `DeleteWalletDialog.tsx`
- `CreateItemizedProjectDialog.tsx`, `PublishItemizedProjectDialog.tsx`, `DeleteItemizedProjectDialog.tsx`
- `ItemizedProjectRevisionDialog.tsx` + `ApproveRevisionDialog.tsx`/`RejectRevisionDialog.tsx`/`ReturnRevisionForReviewDialog.tsx`
- `AdvanceProgramStageDialog.tsx` (dev/demo cascade simulation, clearly labeled)
- `LSWalletList.tsx` (list page, `CollapsibleTable` + `Pagination`, mirrors `Program.tsx`/`Project.tsx`)

### Documentation (tech-writer)
- Inline comments in `walletBalance.ts` documenting the draw-sync formula and its future SQL-view correspondence
- Inline comments in `walletMockStore.ts` flagging `PublishedDrawAmount` as a stand-in for the unresolved backend snapshot mechanism
- Inline "REAL API SWAP" comment blocks in every `Service.ts` function (endpoint, payload shape, response type)

## Files / Components Touched

**New** (`FE/src/pages/LSWallet/`): `Model.d.ts`, `Service.ts`, `mockData/{walletMockStore,walletSeedData}.ts`, `store/{walletStore,revisionStore}.ts`, `hooks/{useWalletBalance,useWalletActions}.ts`, `utils/{walletBalance,walletActions,walletStatusBadge,constants}.ts`, `rules/walletFormRules.ts`, `components/{WalletDetailsSection,FundingProfileSection,WalletComponentSection,WalletBalanceWidget,WalletActionButtons}.tsx`, `dialogs/*` (11 dialogs listed above), `Views/{LSWalletList,LSWalletDetail}.tsx`.

**Modified**: `FE/src/utils/appRouteList.ts` (rename `:projectId`→`:walletId`), `FE/src/components/Routes.tsx` (add `LumpSumList`/`LumpSumDetails` entries), `FE/src/layouts/AppSidebar.tsx` (re-enable the commented `/lumpsum` `SidebarItem`, lines 113–116, with a `ViewAccess` guard matching the `/projects` item just above it), `FE/src/pages/Project/dialogs/ComponentCostDialog.tsx` (component-type filter only, no other Project module changes).

## Risks / Open Questions / Assumptions

- **OPEN-1 (upstream, unresolved)**: frozen-Used snapshot mechanism unspecified in source docs. *Assumption*: mock `PublishedDrawAmount: number | null`, set at publish time, formula reads `PublishedDrawAmount ?? CurrentDrawAmount`. Must be re-sourced from the real API response later, not computed client-side.
- **OPEN-2 (upstream, unresolved)**: replenish window (GAA-only vs GAA+). *Assumption*: allow at GAA and all later stages via a single stage-order constant, easy to tighten to GAA-only later.
- **RISK**: renaming `:projectId`→`:walletId` — confirmed safe (routes unwired, no callsites), but re-verify with a repo-wide search before editing.
- **RISK**: `LumpSumList`/`LumpSumDetails` are already present in `appRouteList.ts`, meaning RBAC may already grant access to some roles the moment `Routes.tsx` wires a real component — confirm with team before merging the route change.
- **RISK**: Option A (manual Wallet ID entry on the existing Project creation form) touches `FE/src/pages/Project/` — keep this a single optional field + blur-validation call to minimize blast radius on that already-large form; Option B (from Wallet Detail) is the safer primary path if Option A proves risky mid-implementation.
- **RISK**: the "13-rule compliance check" content isn't enumerated in any source doc — mock with 13 placeholder named rules (12 auto-pass, 1 checks draw ≤ available); real rule content needs confirmation before backend wiring.
- **Naming guardrail**: no type/dialog in the new module may be named ambiguously close to the existing `IslandCode === 'LS'` "Lump Sum project type" / "Itemized Lump Sum Import" feature already in `Project/`.
- **Superseded design**: the previous version of this plan (`LumpSumWallets`/`LumpSumWalletProjects` backend tables, connecting an existing LS project to existing regular projects) is fully replaced. If any of that earlier work was already implemented in code, reconcile/remove it during implementation — not verified as part of this planning pass.

## Verification

Since this is FE-only with no backend, verification is manual UI walkthrough against the seeded mock scenario:
1. `npm run dev` in `FE/`, navigate to `/lumpsum`.
2. Walk the WF-5 worked scenario end-to-end (create 10M wallet → replenish to 12M → itemize 3M draw → edit draw to 3.5M → publish → attempt a revision → delete a different unpublished 1M-draw project) and confirm Total/Used/Available match the doc's numbers at every step.
3. Exercise each WF-7 delete tier (hard/soft/blocked) for both entities.
4. Confirm `'LS'` is absent from the component-type dropdown on both a regular and an itemized project.
5. Confirm no component file imports anything from `LSWallet/mockData/` directly (only via `Service.ts`).

## Completion Log

Date: 2026-07-09

**Senior** (2 passes):
- Pass 1 — architecture: `Model.d.ts`, mock store (`walletMockStore.ts`), seed data reproducing the WF-5 worked scenario, `Service.ts` (18 functions, mock/API-swap seam), live balance engine (`walletBalance.ts` + `walletStore.ts` Jotai atom + `useWalletBalance.ts`), declarative action config (`walletActions.ts` + `WalletActionButtons.tsx`), route wiring (`:projectId`→`:walletId` rename confirmed safe via repo-wide search, `Routes.tsx`/`appRouteList.ts` entries, `AppSidebar.tsx` re-enabled), revision store scaffolding, `'LS'` component-type exclusion in `Project/dialogs/ComponentCostDialog.tsx`, and component-contract specs for the junior pass. A real correctness bug found during verification (missing `HasStageData` on `LSWallet`, causing `deleteWallet`'s hard/soft/blocked tier logic to key off itemized-projects' stage data instead of the wallet's own) was fixed before junior work began.
- Pass 2 — `LSWalletDetail.tsx` orchestrator page wiring every dialog/component together, plus a new `EditDrawAmountDialog.tsx` (missing from the original task list — the "Edit Draw Amount" action existed with no dialog behind it) and exporting `resolveWalletDeleteTier()`/`resolveProjectDeleteTier()` from `walletActions.ts` so delete tiers can be resolved before opening the delete dialogs.

**Junior** (6 parallel batches, all files disjoint): status/balance display (`walletStatusBadge.tsx`, `WalletBalanceWidget.tsx`); form sections + validation rules (`WalletDetailsSection`, `FundingProfileSection`, `WalletComponentSection`, `walletFormRules.ts`); wallet-level dialogs (`CreateWalletDialog`, `ReplenishWalletDialog`, `DeleteWalletDialog`); itemized-project dialogs (`CreateItemizedProjectDialog`, `PublishItemizedProjectDialog`, `DeleteItemizedProjectDialog`); revision dialogs (`ItemizedProjectRevisionDialog`, `Approve/Reject/ReturnRevisionForReviewDialog`); dev tooling + list page (`AdvanceProgramStageDialog`, `LSWalletList.tsx`).

**Documentation**: verified the plan's three inline-comment requirements were already satisfied by the implementation (draw-sync formula in `walletBalance.ts`, REAL API SWAP blocks in every `Service.ts` function, OPEN-1 snapshot comment in `walletMockStore.ts` — no edits needed). Added `FE/src/pages/LSWallet/LSWallet.md` (developer reference, following the `Modification.md`/`program.md` convention) and `FE/src/pages/LSWallet/UserManual.md` (end-user manual for a Project Coordinator, following the per-module UserManual.md convention used by every other module).

**Deviations / flags:**
- WF-4 Option A (manual Wallet ID entry on the regular Project-creation form) was **not built** — only Option B (from Wallet Detail, wallet pre-linked) exists, per the plan's own risk note recommending this as the safer primary path.
- `DeleteWalletDialog`/`DeleteItemizedProjectDialog`'s `tier` prop is **required**, not optional as originally specified — the caller resolves the tier via the newly-exported resolver functions before opening the dialog, avoiding a dry-run delete call.
- Revision review is a **simplified inline table** (expandable per published project on the Detail page with inline Approve/Reject/Return buttons), not a separate reviewer-queue page mirroring Modification's `ViewRevision.tsx`.
- `LSWalletList.tsx` row actions are limited to **View (navigate) + dev stage-cascade** — Replenish/Add Itemized Project/Delete require full itemized-project context for correct tier resolution, so they live only on the Detail page. The list page's originally-planned full `WalletActionButtons` row (which would have used an empty `itemizedProjects: []`, silently breaking delete-tier resolution) was caught and corrected during verification.
- `HasStageData` was added to `LSWallet` (not in the original schema doc list) specifically to fix the wallet-delete-tier bug noted above.
- Revision approval does not mutate a distinct "project cost" field, since `ItemizedProject.ComponentCosts` is an intentionally opaque placeholder pending the real backend schema — the load-bearing acceptance criterion (wallet `Used` stays frozen through revision) holds regardless.
- All six junior batches' output required a follow-up verification/fix pass (unused-variable lint errors, a few `any` types, missing `useToast` wiring in one dialog, placeholder `'current-user'` strings replaced with the real `useAuth()` hook in the four revision dialogs) — all resolved before proceeding to the next stage.

**Files changed:**
- New: 32 files under `FE/src/pages/LSWallet/` (see folder listing in `LSWallet.md`), including `Model.d.ts`, `Service.ts`, mock store + seed data, Jotai stores, balance engine, action config, 12 dialogs, 5 components, 2 views, validation rules, and the two documentation files.
- Modified: `FE/src/utils/appRouteList.ts`, `FE/src/components/Routes.tsx`, `FE/src/layouts/AppSidebar.tsx`, `FE/src/pages/Project/dialogs/ComponentCostDialog.tsx` (surgical component-type filter only).
- Verification: `npx tsc -b --noEmit` and `npx eslint` both run clean across every touched file (zero errors; 2 pre-existing-style `react-hooks/exhaustive-deps` warnings consistent with an existing warning already present elsewhere in the codebase before this work).
