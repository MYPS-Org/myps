# Plan: LSWallet Add-Flow Restructure (mirror Project module's two-phase pattern)

Status: Implemented
Created: 2026-07-20
Source: Conversation with user — see chat history for full rationale (also documented in Context below)

## Goal

Restructure the LSWallet "Add Wallet" flow to mirror the Project module's `AddProject.tsx`/`ProjectForm.tsx` two-phase pattern: save Program Details + Wallet Details first to get a real backend-generated wallet Id (the foreign key Funding Profile / Component Cost / Itemized Projects all attach to), then make Funding Profile and Component Cost generally editable afterward via a persistent "Update Wallet" action on the detail page — exactly like Project's edit mode.

## Acceptance Criteria

As a user, when I add an LSWallet I only provide Program Details and Wallet Details (getting a real wallet Id), and when I view/edit that wallet I can freely update its Funding Profile and Component Cost via a persistent "Update Wallet" button — mirroring exactly how the Project module's Add/Edit flow works.

- [ ] `WalletForm mode="add"` renders only Program Details and Wallet Details sections; Funding Profile and Component Cost are hidden in add mode.
- [ ] "Create Wallet" succeeds with valid Program Details + Wallet Details and empty funding/component arrays — the old "at least one funding profile" gate is removed.
- [ ] On successful create, navigates to `/lumpsum/{wallet.Id}` with the real generated Id (unchanged from today).
- [ ] `WalletForm mode="edit"` renders all four sections, all editable (not disabled) whenever `wallet.IsDeleted === false`.
- [ ] A persistent "Update Wallet" button appears in edit mode, opens a confirm dialog, and on confirm calls a new `updateWallet()` service call.
- [ ] `updateWallet()` persists Program/Wallet Details + Funding Profile + Component Cost together (mirrors `updateEntireProject`), and the resulting `wallet.Amount` always equals `SUM(non-deleted WalletFundingProfile.Amount)` (Amount invariant).
- [ ] Reducing Funding Profile total below the wallet's current `balance.Used` (itemized-project draws) is blocked — client-side toast before the confirm dialog opens, and a store-side throw as backstop.
- [ ] Replenish, Delete Wallet, Advance Stage, and all itemized-project actions continue to work unchanged.
- [ ] `WalletComponentCostForm`'s row-level Edit (pencil) button respects `disabled` (currently it doesn't, unlike Delete) — fixed so a locked/disabled wallet can't be edited via that path either.
- [ ] `AddWallet.tsx` and `LSWalletDetail.tsx` need no changes — `WalletForm` owns the new save path, reactive refresh already flows through the existing `walletDataAtom`/`syncAtom()` pipeline (same path `replenishWallet()` already uses).

## Approach

**Phase 1 (add mode)**: Keep `store.createWallet()` and its DTO unchanged — it already tolerates empty `fundingProfiles`/`componentCosts` arrays with zero store-level validation; the only blocker today is the client-side "at least one funding profile" gate in `WalletForm.handleSaveWallet()`, which gets deleted. `WalletForm` mode="add" hides the Funding Profile / Component Cost `CollapsibleSection`s (matching how `ProjectForm` hides Funding/Component/MajorItems in add mode). `walletFormRules.ts` needs no changes — it already validates only the 3 flat fields (`ProgramId`, `CategoryId`, `Tier`) that stay in add mode.

**Phase 2 (edit mode, always editable)**: LSWallet has no `IsActive`/`IsPublished`/`IsLocked` field (unlike Program/Project), so there's no existing analog to Project's lock gate. Recommendation: `isDisabled = Boolean(initialData?.IsDeleted)` — the only genuinely terminal state on the current model. This is flagged as the top open risk (see below) and is a single-line, easily-swapped decision point if a real "locked" field is added later. `HasStageData` and `CurrentStage` are explicitly ruled out as lock conditions since they change too early in a wallet's normal lifecycle.

A new `updateWallet()` function is added end-to-end (`Model.d.ts` → `DtoUpdateWallet`, `Service.ts` → `updateWallet()`, `walletMockStore.ts` → `store.updateWallet()`), mirroring `updateEntireProject()`'s shape: full composite payload (wallet flat fields + all three arrays), replacing the wallet's arrays wholesale, then re-deriving `Amount` via the existing `recomputeWalletAmount()` invariant helper. New IDs for added rows use existing/new module-level counters (fixing a latent ID-collision bug in `createWallet`'s component-cost ID assignment, which used array index + 1, only in the new update path — not touching `createWallet` itself).

**Integrity guard**: before allowing an Update Wallet save, both the client (`WalletForm`, using the already-available `useWalletBalance` hook) and the store (`updateWallet()`) verify the derived `Amount` from submitted funding profiles is not less than `balance.Used` (sum of itemized-project draws) — otherwise a reduction could push `Available` negative. This mirrors `ProjectForm.confirmUpdateProject()`'s existing "component cost total must match budget" guard pattern.

**Replenish coexistence**: Replenish (WF-3) stays exactly as-is — it's the stage-gated (`GAA`+), strictly-increasing, audited top-up path (adds a new "Replenishment"-sourced funding line). The new Update Wallet path is the general-purpose correction path (can edit/soft-delete any row, including ones Replenish created, subject only to the Used-floor guard). Both funnel through the same `recomputeWalletAmount()` invariant, so they can't conflict on the Amount itself.

**`WalletComponentCostForm`'s Edit button gap**: the row-level pencil button currently has no `disabled` guard (unlike the delete button, which does). Since edit mode is about to become generally usable and `isDisabled` becomes a meaningful lock, this gap is fixed as part of this work — otherwise a "locked" (deleted) wallet's component costs could still be opened for editing via that button.

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- **`WalletForm.tsx`**: change `isDisabled` from `mode === 'edit'` to `Boolean(initialData?.IsDeleted)`; wrap Funding Profile/Component Cost sections in `{mode === 'edit' && (...)}`; remove the funding-required gate from `handleSaveWallet()`; add `handleUpdateWallet()` (Used-floor client guard + confirm dialog) and `confirmUpdateWallet()` (builds `DtoUpdateWallet`, calls the new `updateWallet()` service call); change `onSectionChange` so edit mode passes real `handleChange` instead of `noOp`; add the "Update Wallet" button block gated on `mode === 'edit'`.
- **`walletMockStore.ts`**: add `updateWallet(dto: DtoUpdateWallet, programName: string): LSWallet` — locate wallet, compute `usedAmount` from itemized projects, compute `derivedAmount` from submitted profiles, throw if `derivedAmount < usedAmount`, assign IDs to new profile/component-cost rows (new `_nextComponentCostId` counter, avoiding the existing `i+1` collision pattern), `recalcPercentages()`, merge flat fields, replace the three arrays wholesale, `recomputeWalletAmount()`, stamp `UpdatedBy`/`UpdatedDate`/`HasStageData: true`, persist and return.
- **`Model.d.ts` + `Service.ts`**: add `DtoUpdateWallet` interface (same shape as `DtoCreateWallet` plus required `walletId`/`updatedBy`) and `updateWallet()` service function following the existing REAL API SWAP comment pattern (mock body: `store.updateWallet()` → `syncAtom()` → `mockResponse()`).

### Junior (precise, scoped — delegate to junior-engineer)
- **`WalletComponentCostForm.tsx`**: add `disabled={disabled}` (plus matching greyed-out styling) to the row-level pencil/Edit button, mirroring the existing delete-button guard.
- **`SaveWalletConfirmDialog.tsx`**: add optional `title`/`confirmLabel` props (falling back to today's hardcoded text) so the same dialog can be reused for both "Create Wallet" and "Update Wallet" confirmations; wire the props through from `WalletForm.tsx`.

### Documentation (tech-writer)
- **`LSWallet.md`**: document the Phase 1/Phase 2 creation pattern, the new `updateWallet()` endpoint + `DtoUpdateWallet` payload shape, the Amount-vs-Used integrity guard and where it's enforced, the Replenish-vs-inline-edit coexistence decision, and the `isDisabled = IsDeleted`-only lock-gate assumption.

## Files / Components Touched

- `FE/src/pages/LSWallet/components/WalletForm.tsx` (primary)
- `FE/src/pages/LSWallet/mockData/walletMockStore.ts` (primary — new `updateWallet()`)
- `FE/src/pages/LSWallet/Service.ts` (primary — new `updateWallet()`)
- `FE/src/pages/LSWallet/Model.d.ts` (primary — new `DtoUpdateWallet`)
- `FE/src/pages/LSWallet/components/WalletComponentCostForm.tsx` (edit-button disabled guard)
- `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx` (optional title/confirmLabel props)
- `FE/src/pages/LSWallet/LSWallet.md` (documentation)
- Explicitly unchanged: `AddWallet.tsx`, `LSWalletDetail.tsx`, `walletFormRules.ts`, `walletActions.ts`, `useWalletBalance.ts`, `walletBalance.ts`, all itemized-project/revision dialogs, `ReplenishWalletDialog`.

## Risks / Open Questions / Assumptions

- **Highest priority — no existing "locked" field on LSWallet.** `isDisabled = Boolean(initialData?.IsDeleted)` is the most minimal viable lock gate given today's model (no `IsActive`/`IsPublished`/`IsLocked`). In production there may be other terminal states (audit-closed, program cancelled, fully reconciled) that should also lock a wallet — this single line is the designated swap point when such a field exists, but needs explicit sign-off that `IsDeleted`-only is acceptable for now.
- **Replenishment lines become editable/reducible.** After this change, a user can inline-edit or reduce a "Replenishment"-sourced funding row's Amount via Update Wallet, which wasn't previously possible (Replenish itself only ever adds, never edits). This is the intended effect of "always editable" but slightly weakens the audit-trail intent of Replenish; a future `IsLocked` flag on individual funding rows would close this gap if needed — out of scope now.
- **Pre-existing ID-collision bug in `createWallet()`'s component costs** (`Id: i + 1`, collides across wallets) is not touched in `createWallet` itself — `updateWallet()` uses a fresh counter so it doesn't inherit the bug, but the underlying `createWallet` bug remains latent unless separately fixed.
- **`onSectionChange` no longer no-ops in edit mode** — previously edit mode was inert regardless of the `disabled` prop; now it relies on `disabled` alone to prevent mutation. Section components (`WalletProgramDetailsSection`, `WalletDetailsSection`) already consume `disabled` correctly per their prop signatures, but worth a quick visual check during implementation.
- **Confirm-dialog reuse vs. new dialog**: recommends adding props to the existing `SaveWalletConfirmDialog` rather than creating a separate dialog file — flagged as an easy call to reverse if a distinct dialog is preferred.

## Verification

- Run the FE dev server, navigate to `/lumpsum/add`: confirm only Program Details + Wallet Details render, "Create Wallet" succeeds with no funding profiles entered, and lands on `/lumpsum/{newId}`.
- On the resulting detail page, confirm Funding Profile + Component Cost sections now render and are editable, add a funding profile + a component cost, click "Update Wallet", confirm the dialog, and verify the wallet's Amount/balance widget updates correctly.
- Create at least one itemized project drawing against the wallet, then attempt to reduce Funding Profile total below the drawn amount via Update Wallet — confirm it's blocked with a toast.
- Confirm Replenish still works unchanged (stage-gated, strictly-increasing).
- Run `tsc --noEmit` (or the project's typecheck script) to confirm no type errors from the new `DtoUpdateWallet`/`updateWallet` additions.

## Completion Log
Date: 2026-07-20
- Senior: Implemented all three senior tasks in one pass. `WalletForm.tsx` — `isDisabled` now `Boolean(initialData?.IsDeleted)` instead of `mode === 'edit'`; Funding Profile/Component Cost sections wrapped in `{mode === 'edit' && (...)}`; removed the funding-required gate from `handleSaveWallet()`; `onSectionChange`/`noOp` pattern removed in favor of always passing `handleChange`; added `handleUpdateWallet()` (Used-floor client guard via `useWalletBalance`) and `confirmUpdateWallet()` (builds `DtoUpdateWallet`, calls `updateWallet()`); added an "Update Wallet" button block for edit mode. `walletMockStore.ts` — added `updateWallet(dto, programName)` with inline `usedAmount` computation, `derivedAmount` floor check (throws if violated), a new `_nextComponentCostId` counter (starts at 500, avoids `createWallet`'s pre-existing `i+1` collision bug without touching `createWallet` itself), `recalcPercentages()`, wholesale array replacement, `recomputeWalletAmount()`, and audit-field stamping (`UpdatedBy`/`UpdatedDate`/`HasStageData: true`). `Model.d.ts`/`Service.ts` — added `DtoUpdateWallet` interface and `updateWallet()` service function mirroring `createWallet`'s REAL-API-SWAP comment convention. Also absorbed the `SaveWalletConfirmDialog.tsx` prop task (tightly coupled to the confirm-dialog wiring it was already doing) — added optional `title?`/`confirmLabel?` props, defaulting to the original "Create Wallet" text.
- Junior: `WalletComponentCostForm.tsx` — added `disabled={disabled}` and the existing `getDisabledClass(disabled)` styling to the row-level Edit (pencil) button, matching the adjacent Delete button's guard.
- Documentation: `LSWallet.md` updated — folder-structure entries for `WalletForm.tsx`/`WalletComponentCostForm.tsx`/`SaveWalletConfirmDialog.tsx`, Amount Invariant paragraph, new `DtoUpdateWallet` row in the Dto Wire Types table, new "Update Wallet" row in the Workflows File Map, `updateWallet` added to the Service Layer Function Reference (18→19 functions), Dialogs table row extended for the dual add/edit trigger, and a full rewrite of the `AddWallet.tsx`/`WalletForm.tsx` and `LSWalletDetail.tsx` narrative sections describing the two-phase flow.
Deviations / flags: None material. `confirmSaveWallet`'s array payloads use explicit `[]` rather than a filter expression (equivalent since add mode collects no funding/component data) — a minor readability choice, not a plan deviation. The `SaveWalletConfirmDialog.tsx` prop task was completed by senior-engineer instead of junior-engineer since it was tightly coupled to work already in progress — no separate junior task was needed for it, only the `WalletComponentCostForm.tsx` guard remained.
Files changed: `FE/src/pages/LSWallet/components/WalletForm.tsx`, `FE/src/pages/LSWallet/mockData/walletMockStore.ts`, `FE/src/pages/LSWallet/Service.ts`, `FE/src/pages/LSWallet/Model.d.ts`, `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx`, `FE/src/pages/LSWallet/components/WalletComponentCostForm.tsx`, `FE/src/pages/LSWallet/LSWallet.md`. `tsc --noEmit` run post-implementation: zero LSWallet-related type errors.
