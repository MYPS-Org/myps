# Plan: LSWallet ↔ Project Module Uniformity

Status: Implemented
Created: 2026-07-13
Source: User request in-session — "copy all the data models details and other input fields in project form into lumpsum module," with binding decisions confirmed via AskUserQuestion (full field parity, funding profile as multi-line array, component cost as full array+dialog copy, exclude Major Item of Works/Work Location, retain wallet-specific concepts).

## Completion Log

Implemented 2026-07-13.

### Senior (senior-engineer)

### S1 — Model.d.ts
Added `WalletFundingProfile`, `WalletComponentCost`, `WalletComponentCostPerYear` interfaces. Removed old flat fields (`FundingSource`, `FundingAgreement`, `FundingPercentage`, `ComponentYear`, `ComponentAmount`, `ComponentTotal`, `ComponentUACS`, `ComponentStartDate`, `ComponentEndDate`). Added 26 new optional flat fields to `LSWallet`. Updated `DtoCreateWallet` to array-based shape.

### S2 — walletSeedData.ts
Converted both seed wallets to array-based funding/component data. Wallet 1 preserves Total=12M / Used=4.5M / Available=7.5M invariant.

### S3 — walletMockStore.ts
Rewrote `createWallet()` and `replenishWallet()`. Amount is now always derived from `SUM(WalletFundingProfiles)` via `recomputeWalletAmount()`. Replenish adds a funding line rather than mutating Amount directly.

### S4 — Service.ts
Updated REAL API SWAP comment on `createWallet()` for array-based payload.

### constants.ts (pre-S7)
Added `MOCK_WALLET_COMPONENT_TYPES` (includes 'LS') with documentation of why it's hardcoded.

### S5 — WalletDetailsSection.tsx (new)
Full `ProjectDetailsForm` adaptation. Five subsections. Uses `useLocationFilters` from `Project/filteringLocations` (documented cross-module exception). `isLumpSum=true` always.

### S6 — WalletFundingProfileForm.tsx (new)
Multi-line funding table adapted from `FundingProfileForm`. Plain text inputs for Source/Agreement. Auto-percentage calculation. Color-coded total indicator.

### S7 — WalletComponentCostDialog.tsx (new)
Adapted from `ComponentCostDialog`. 'LS' type not filtered out. No Major Item / auto-fill / `hasMajorLocations`. `programDetails` optional. File-header tech-debt note.

### S8 — WalletComponentCostForm.tsx (new)
Adapted from `ComponentCostForm`. No `majorItems` prop. `relatedMajorItemsCount=0` always. Reuses Project's `DeleteComponentDialog` via `as unknown as ComponentCost` cast (documented). `maxAmountCost` wired to `wallet.Amount`.

### S9 — WalletForm.tsx (rewritten)
Swapped in `WalletDetailsSection` / `WalletFundingProfileForm` / `WalletComponentCostForm`. Added `fundingProfiles`, `componentCosts`, `componentCostPerYear` state. Amount recompute `useEffect`. Updated `DtoCreateWallet` payload. Three `CollapsibleSection` cards: "Project Details", "Funding Profile", "Component Cost". Inline array-level validation before API call.

### S10 — walletFormRules.ts (updated)
Dropped rules for removed flat fields. Kept `ProgramId`, `CategoryId`. Added optional `Tier` (1–5) rule. Array-level validation is inline in `WalletForm.handleSaveWallet` per `FE/CLAUDE.md` pattern.

### Junior (junior-engineer, J1–J5)
- **J1**: Deleted `WalletProgramSection.tsx`, `FundingProfileSection.tsx`, `WalletComponentSection.tsx` after confirming zero remaining imports across `FE/src`.
- **J2**: Verified `LSWalletDetail.tsx` — no references to removed fields, `<WalletForm mode="edit" initialData={wallet} />` correctly passes the new array fields. No changes needed.
- **J3**: Verified `LSWalletList.tsx` — columns use only retained fields (Id, ProgramName, CategoryName, CurrentStage, CreatedDate, OperatingUnit search filter). No changes needed.
- **J4**: Verified `CreateItemizedProjectDialog.tsx`, `PublishItemizedProjectDialog.tsx`, `DeleteItemizedProjectDialog.tsx` — all clean, no removed-field references. No changes needed.
- **J5**: Verified `WalletBalanceWidget.tsx`, `walletActions.ts`, `walletStatusBadge.tsx` — all clean (widget takes scalar props only; utils read only retained `CurrentStage`/`HasStageData`/`Id`). No changes needed.

### Documentation (tech-writer, D1)
Updated `LSWallet.md`: folder structure, Data Models tables (new interfaces + new optional field group + `Amount` invariant subsection), Live Balance Formula section, `WalletForm.tsx`/`LSWalletDetail.tsx` view descriptions, Service Layer table (`replenishWallet` mechanism), Dialogs table, Cross-Module Touches (split into Project→LSWallet and LSWallet→Project subsections), Seed Data section.

### Addendum (2026-07-14) — Program Details card

**Gap found:** the original plan scoped `ProjectDetailsForm`, `FundingProfileForm`, and `ComponentCostForm` as copy sources, but missed `FE/src/pages/Project/components/ProgramDetailsForm.tsx` — a separate sibling card in `ProjectForm.tsx` (Program Name + read-only Program Type / Start Year / Program Stage). LSWallet had only folded a bare Program dropdown into `WalletDetailsSection`'s General Information, with no equivalent of the read-only Type/Year/Stage display. User confirmed: copy `ProgramDetailsForm`'s rendering and styling as-is.

**Implemented (senior-engineer, verified by direct file read + isolated `tsc --noEmit`, zero errors):**
- `Model.d.ts`: added `TypeName?: string`, `YearStart?: number`, `ProgramStageName?: string` to `LSWallet` (the latter is a documented, intentionally separate field from `CurrentStage` — `ProgramStageName` is an immutable informational snapshot of the Program's stage at wallet-creation time; `CurrentStage` is the wallet's own live WF-2-cascaded lifecycle stage). Added `programStageName?: string` to `DtoCreateWallet`.
- New `components/WalletProgramDetailsSection.tsx`: faithful adaptation of `ProgramDetailsForm.tsx` (same card styling, `grid grid-cols-3 gap-4 text-sm`, GAA-R programs excluded from the selectable list, Program Name searchable-select in add mode / read-only in edit mode, read-only Program Type/Start Year/Program Stage). Bound to the wallet's flat `Partial<LSWallet>` + `onChange` pattern rather than a separate `ProgramList` state object.
- `WalletDetailsSection.tsx`: removed its bolted-on Program dropdown/`handleProgramChange` — confirmed `ProjectDetailsForm.tsx` itself has zero Program-related fields, so Program selection now lives solely in the new card, matching Project's actual split.
- `WalletForm.tsx`: added a fourth `CollapsibleSection` card, "Program Details," rendered FIRST (before "Project Details"), matching Project's card order. Wired `mode` through so add/edit rendering matches `ProgramDetailsForm`'s own add/edit behavior.
- `walletMockStore.ts` / `walletSeedData.ts`: `createWallet()` now stores `ProgramStageName` from the DTO; both seed wallets carry a `ProgramStageName` matching their `CurrentStage` at seed time.

**Acceptance criteria impact:** adds a de facto 18th criterion — "Program Details card (Program Name, Program Type, Start Year, Program Stage) renders as its own card, first in the form, matching `ProgramDetailsForm.tsx`'s styling and behavior" — now satisfied.

### Build verification
`npx tsc --noEmit` on the FE app project (`tsconfig.app.json`) compiles with **zero errors** against all LSWallet changes. Note: a full unscoped `tsc -b` run hits one pre-existing, unrelated error (`../Main/Resources/Internal/index.ts` — a `vite/client` triple-slash reference that can't resolve because that file sits outside `FE/`'s `node_modules` ancestry) — confirmed present on the base branch, untouched by this work, and out of scope.

### Deviations from plan
None. All constraints honored: no `Project/` files modified, no Major Item of Works added, no `CollapsibleSection`/`Button`/`Table`/`DateInput` patterns broken.

## Context

The LSWallet module (`FE/src/pages/LSWallet`) was built as a deliberately simplified, flat-model mock module (see `LSWallet.md`) ahead of a pending backend schema (ADR-021/025) — one funding source, one fixed "LS" component line, no project-details richness. The user now considers a Lump Sum Wallet "still a project but with special functions" and wants its Add/Edit form to match the real AIP Project form (`FE/src/pages/Project`) field-for-field and behavior-for-behavior: full `ProjectDetailsForm` field set, a multi-line `FundingProfileForm`-style funding table, and a full `ComponentCostForm` + dialog cost breakdown — while explicitly excluding Major Item of Works / Work Location, and keeping the wallet's own concepts (balance tracking, stage, replenish, itemized-project draw-down) intact.

This was scoped with a senior-engineer design pass; the approach below is that engineer's recommendation, confirmed against the actual codebase (`ProjectEnums` vs `Dropdowns` shapes checked directly — see Risk resolution below).

## Acceptance Criteria

As a Program planner, I want the Add Wallet form to capture the full set of project details, a multi-line funding profile, and a multi-row component cost breakdown — matching the regular AIP Project form — so that a Lump Sum Wallet is a first-class project record rather than a simplified budget stub, while the wallet's live balance tracking and itemized-project draw-down workflows continue operating correctly.

- [ ] `LSWallet/Model.d.ts` declares `WalletFundingProfile`, `WalletComponentCost`, `WalletComponentCostPerYear` interfaces and adds the new flat optional fields (Province, City, LegislativeDistrict, DEO, Region, ImplementingOffice, RegionWide, Origin, Agency, ImplementationMode, EmergencyMode, Feasibility, FeasibilityDate, DetailedDesign, DetailedDesignDate, RowAvailable, Description, MYId, AlternateId, ExternalId, UACS, Tier, Rank, MYCAApprovalDate). Old flat funding/component fields (`FundingSource`, `FundingAgreement`, `FundingPercentage`, `ComponentYear`, `ComponentAmount`, `ComponentTotal`, `ComponentUACS`, `ComponentStartDate`, `ComponentEndDate`) are removed.
- [ ] Add Wallet form (`/lumpsum/add`) renders three `CollapsibleSection` cards — Project Details, Funding Profile, Component Cost — plus the Save/Confirm flow.
- [ ] "Project Details" card contains subsections mirroring `ProjectDetailsForm`: General Information (Wallet ID read-only, Program, MYId, AlternateId, ExternalId, UACS, Tier, Rank, Category, Sub-Category, MYCAApprovalDate, Description), Location Details (Province, City, Legislative District), Organizational Responsibilities (DEO, Region, Implementing Office, Operating Unit, Region Wide), Project Source (Origin, Agency), Implementation Readiness and Modality (Implementation Mode, Emergency Mode, ROW Available, Feasibility, Feasibility Date, Detailed Design, Detailed Design Date).
- [ ] The "Lump Sum / Non Project" `IslandCode` toggle from `ProjectDetailsForm` does NOT appear in the wallet's version — that toggle belongs to a different, unrelated feature (`Project.IslandCode === 'LS'`) that `LSWallet.md` explicitly warns must not collide with this module.
- [ ] Province/City/Legislative District cascade correctly using the existing `useLocationFilters` hook.
- [ ] "Funding Profile" card has an "Add Funding" button, a multi-row table (Source, Agreement, Amount, auto-computed Percentage read-only), a color-coded total-percentage indicator, and a delete icon per row — matching `FundingProfileForm`'s look and behavior.
- [ ] "Component Cost" card has an "Add Component" button, per-row Edit/Delete, budget summary cards (Total Cost, Max Cost, Remaining), and opens a wallet-specific Add/Edit dialog — matching `ComponentCostForm`'s look and behavior.
- [ ] The wallet's component-cost dialog allows selecting the `'LS'` component type (not filtered out, unlike the Project dialog which excludes it for regular projects).
- [ ] No Major Item of Works UI, data, or related "auto-fill description" functionality appears anywhere in LSWallet.
- [ ] WF-1 Create Wallet: form validates (at least one non-deleted funding line with Amount > 0, Tier present), opens `SaveWalletConfirmDialog`, calls `Service.createWallet()`, navigates to `/lumpsum/{id}`.
- [ ] WF-3 Replenish: `ReplenishWalletDialog` still accepts a new total; the mock store adds a funding line to reach it; `wallet.Amount` and the balance widget update correctly.
- [ ] WF-5 balance: `Total = wallet.Amount = SUM(WalletFundingProfiles where !IsDeleted)`. Wallet 1 seed data still yields Total=12,000,000 / Used=4,500,000 / Available=7,500,000.
- [ ] WF-4/WF-7/WF-8 (Create Itemized Project, delete tiers, publish compliance) show no regressions — they read only retained flat fields.
- [ ] Detail page (`/lumpsum/:walletId`) renders `WalletForm mode="edit"` with all new sections in disabled/read-only mode.
- [ ] `FE/CLAUDE.md` conventions followed: `DateInput` on all date fields, no toast in `catch` for API errors, frontend validation with early `return` before the API call, `maxLength` on text inputs.
- [ ] `LSWallet.md` is updated to reflect the new model shape and section architecture.

## Approach

**Model shape — flat extension, not nesting.** Every existing consumer (12 dialogs, 2 views, `Service.ts`, mock store, seed data, the balance formula) reads `wallet.Field` directly. `LSWallet` gains new optional flat fields (the non-financial `ProjectDetails` fields — location, org responsibilities, source, readiness/modality, plus MYId/AlternateId/ExternalId/UACS/Tier/Rank/Description/MYCAApprovalDate) rather than a nested `ProjectDetails` object, to avoid breaking every existing call site. The old flat funding/component fields are removed and replaced by two new arrays: `WalletFundingProfiles: WalletFundingProfile[]` and `WalletComponentCosts: WalletComponentCost[]` (+ `WalletComponentCostPerYear[]`). These are wallet-local interfaces (structurally identical to Project's `FundingProfile`/`ComponentCost`/`ComponentCostPerYear`, but declared in `LSWallet/Model.d.ts` so the module stays self-contained per its documented mock-swap architecture).

**Amount reconciliation.** `wallet.Amount` becomes a derived value: `Amount = SUM(WalletFundingProfiles where !IsDeleted)`, recomputed by the mock store on every mutation (and mirrored in `WalletForm.tsx` via a `useEffect` while editing). `computeWalletBalance` is untouched — it already just reads `wallet.Amount` as `Total`. WF-3 Replenish changes from "bump `Amount` directly" to "add a new funding line (`Source: 'Replenishment'`) sized to bring the total up to `newAmount`, then recompute `Amount = SUM`." The `DtoReplenishWallet` contract (`walletId`, `newAmount`, `updatedBy`) is unchanged, so `ReplenishWalletDialog` needs no changes.

**Component cost as the wallet's cost side.** `WalletComponentCosts`/`WalletComponentCostPerYear` replace the old single fixed "LS" line. `maxAmountCost` (the budget cap shown in the summary cards) is wired to `wallet.Amount`, so the cards show cost-vs-funding live, exactly like Project's cost-vs-project-budget cards.

**New components (wallet-specific copies, not re-exports of Project's):**
- `WalletDetailsSection.tsx` — full adaptation of `ProjectDetailsForm`, minus the IslandCode toggle and the edit-mode "Administrative Information" block (no wallet edit-details workflow exists), with Wallet ID substituted for Project ID. Reuses `useLocationFilters` from `FE/src/pages/Project/filteringLocations` (a pure, side-effect-free hook — the one accepted cross-module import). Absorbs and replaces `WalletProgramSection.tsx`.
- `WalletFundingProfileForm.tsx` — multi-line funding table, functionally identical to `FundingProfileForm.tsx` but typed against `WalletFundingProfile`. Replaces `FundingProfileSection.tsx`.
- `WalletComponentCostForm.tsx` + `dialogs/WalletComponentCostDialog.tsx` — full adaptation of `ComponentCostForm.tsx` + `ComponentCostDialog.tsx`, with the `WALLET_EXCLUSIVE_COMPONENT_TYPES` filter removed (wallets need to select `'LS'`) and all Major-Item-of-Works linkage (`majorItems` prop, `relatedMajorItemsCount`, `hasMajorLocations`, "auto-fill description") stripped. Reuses Project's `DeleteComponentDialog` directly (passing `relatedMajorItemsCount={0}` — the cascade-warning path never triggers since wallets have no Major Items). Replaces `WalletComponentSection.tsx`.

**Known pre-existing gap carried forward, not introduced by this change:** `getProjectEnums()` returns `ProjectEnums` (Programs/Categories/Thrusts/Origins/Cities/Provinces/LDs/OperatingUnits/IOs/DEOs/Agencies/ImplementationModes/EmergencyModes/RowsAvailable/Feasibility/DetailedDesign/RegionWide), which does **not** include `Dropdowns.Sources`/`Dropdowns.Agreements`. Those only arrive via `getProjectDetails()` (`ProjectFormPayload.Dropdowns`), which requires an existing `ProjectId` — i.e. edit mode only. Project's own `ProjectForm.tsx` in **add mode** defaults `Dropdowns` to `{ Sources: [], Agreements: [], ... }` (empty arrays) for exactly this reason — it's a pre-existing, already-documented gap (`LSWallet.md` even calls this out: *"fundingSources/fundingAgreements are hardcoded [] — known pre-existing gap, not addressed in this task"*). The wallet's `WalletFundingProfileForm` will do the same: empty Sources/Agreements arrays on create, matching Project's real behavior exactly. No new work needed here, and it should not block this plan.

**No changes needed:** `LSWalletList.tsx`, `WalletBalanceWidget.tsx`, `CreateItemizedProjectDialog.tsx`, `ReplenishWalletDialog.tsx`, `PublishItemizedProjectDialog.tsx`, `DeleteItemizedProjectDialog.tsx`, `walletActions.ts`, `walletStatusBadge.tsx` — all read only retained flat fields (`Id`, `ProgramId`, `ProgramName`, `CategoryId/Name`, `SubCategoryId/Name`, `OperatingUnit`, `CurrentStage`, `HasStageData`, `Amount`). These should be spot-checked for compile/runtime correctness but need no logic changes.

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- **S1** `Model.d.ts`: add new flat fields, remove old flat funding/component fields, add `WalletFundingProfile`/`WalletComponentCost`/`WalletComponentCostPerYear` interfaces and the two new array fields on `LSWallet`, update `DtoCreateWallet` to carry arrays instead of flat funding/component fields.
- **S2** `mockData/walletSeedData.ts`: convert both seed wallets to array-based funding/component data, preserving today's balance numbers (Wallet 1: Total 12M / Used 4.5M / Available 7.5M).
- **S3** `mockData/walletMockStore.ts`: rewrite `createWallet()` to accept and store the new arrays and compute `Amount = SUM`; rewrite `replenishWallet()` to add a funding line instead of mutating `Amount` directly; document the `Amount`-is-derived invariant via JSDoc.
- **S4** `Service.ts`: update `createWallet()`'s DTO shape and its "REAL API SWAP" comment; confirm `replenishWallet()` needs no signature change.
- **S5** Create `components/WalletDetailsSection.tsx` (full `ProjectDetailsForm` adaptation, minus IslandCode toggle and edit-mode admin block; reuses `useLocationFilters`).
- **S6** Create `components/WalletFundingProfileForm.tsx` (multi-line funding table adapted from `FundingProfileForm.tsx`, typed to `WalletFundingProfile`).
- **S7** Create `dialogs/WalletComponentCostDialog.tsx` (adapted from `ComponentCostDialog.tsx`; strip `WALLET_EXCLUSIVE_COMPONENT_TYPES` filter and all Major-Item/auto-fill logic; file header notes it's a manually-synced adaptation).
- **S8** Create `components/WalletComponentCostForm.tsx` (adapted from `ComponentCostForm.tsx`; strip `majorItems`/`relatedMajorItemsCount`; reuse Project's `DeleteComponentDialog` with `relatedMajorItemsCount={0}`; wire `maxAmountCost` to `wallet.Amount`; use the new `WalletComponentCostDialog`).
- **S9** Rewrite `components/WalletForm.tsx`: swap in the three new sections, add `fundingProfiles`/`componentCosts`/`componentCostPerYear` state initialized from `initialData`, add the `Amount`-recompute `useEffect`, update the `DtoCreateWallet` payload assembly.
- **S10** Update `rules/walletFormRules.ts`: drop rules for removed flat fields; add inline array-level validation (at least one non-deleted funding line with Amount > 0) in `WalletForm.tsx`'s save handler per `FE/CLAUDE.md`'s "frontend validation before submit" pattern (`formValidation()` can't express array-level rules).

### Junior (precise, scoped — delegate to junior-engineer)
- **J1** Delete `WalletProgramSection.tsx`, `FundingProfileSection.tsx`, `WalletComponentSection.tsx` once S5–S9 land; grep the module for any straggling imports first.
- **J2** Verify `LSWalletDetail.tsx` compiles and renders correctly with the new `WalletForm mode="edit"` (array-based `initialData`); fix any `noOp`/prop-signature mismatches surfaced by the new section props.
- **J3** Verify `LSWalletList.tsx` — confirm its columns read only retained flat fields; no changes expected, but confirm by running/compiling.
- **J4** Verify `CreateItemizedProjectDialog.tsx`, `PublishItemizedProjectDialog.tsx`, `DeleteItemizedProjectDialog.tsx` compile with no references to removed flat fields.
- **J5** Verify `WalletBalanceWidget.tsx`, `walletActions.ts`, `walletStatusBadge.tsx` — confirm no references to removed fields.

### Documentation (tech-writer)
- **D1** Update `LSWallet/LSWallet.md`: folder structure (new/removed component files), Data Models table (new fields + new interfaces), Live Balance Formula section (note `Amount = SUM(WalletFundingProfiles)`), WF-1 description (new three-section form), Mock/API-Swap Seam section (new `DtoCreateWallet` shape).

## Files / Components Touched

**New:** `components/WalletDetailsSection.tsx`, `components/WalletFundingProfileForm.tsx`, `components/WalletComponentCostForm.tsx`, `dialogs/WalletComponentCostDialog.tsx`

**Edited:** `Model.d.ts`, `mockData/walletSeedData.ts`, `mockData/walletMockStore.ts`, `Service.ts`, `components/WalletForm.tsx`, `rules/walletFormRules.ts`, `LSWallet.md`

**Deleted:** `components/WalletProgramSection.tsx`, `components/FundingProfileSection.tsx`, `components/WalletComponentSection.tsx`

**Verified only (no expected changes):** `Views/LSWalletList.tsx`, `Views/LSWalletDetail.tsx`, `Views/AddWallet.tsx`, `dialogs/CreateItemizedProjectDialog.tsx`, `dialogs/ReplenishWalletDialog.tsx`, `dialogs/PublishItemizedProjectDialog.tsx`, `dialogs/DeleteItemizedProjectDialog.tsx`, `dialogs/DeleteWalletDialog.tsx`, `components/WalletBalanceWidget.tsx`, `components/WalletActionButtons.tsx`, `utils/walletBalance.ts`, `utils/walletActions.ts`, `utils/walletStatusBadge.tsx`, `utils/constants.ts`, `hooks/useWalletBalance.ts`, `store/walletStore.ts`

## Risks / Open Questions / Assumptions

- **Amount-drift risk:** `wallet.Amount` is only correct if every mutation path recomputes it from `WalletFundingProfiles`. Contained because the mock store is the single mutation point; documented via JSDoc on the field.
- **Cross-module hook import:** `WalletDetailsSection.tsx` imports `useLocationFilters` from `Project/filteringLocations` — an intentional, scoped exception (pure hook, no side effects) to the module's stated self-containment, called out in a file-header comment.
- **Dialog divergence:** `WalletComponentCostDialog.tsx` is a manually-synced copy of `ComponentCostDialog.tsx`; future changes to the Project original won't automatically propagate. Flagged in the file header as tech debt.
- **Structural typing dependency:** Reusing Project's `DeleteComponentDialog` on `WalletComponentCost` relies on structural compatibility with `ComponentCost`; if `ComponentCost` gains a new required field, `WalletComponentCost` must be updated to match (documented on the interface).
- **Sources/Agreements empty on create** — confirmed as a pre-existing, already-documented Project-module limitation (not something this plan needs to fix); the wallet form matches Project's real add-mode behavior exactly.
- **Geo/org/readiness fields are optional** (no required-asterisk) since a wallet is program-wide, not site-specific — matches how `ProjectDetailsForm` already treats these fields when `IslandCode === 'LS'`. If the team later wants some required, add rules to `walletFormRules.ts`.

## Verification

- `cd FE && npm run build` (or the project's TypeScript check) to confirm no compile errors from the model/type changes across all consumer files.
- Manually drive `/lumpsum/add`: fill Project Details (including at least one Location field), add 2 funding lines and confirm the percentage/total auto-computes and turns green at 100%, add a component cost via the dialog (confirm `'LS'` is selectable, confirm budget cards reflect the funding total), save, confirm navigation to the new wallet's detail page with all data displayed read-only.
- Manually drive Replenish on an existing wallet and confirm the funding table gains a "Replenishment" line and `Amount`/balance widget update correctly.
- Confirm `/lumpsum` list page and itemized-project flows (create/publish/delete) still work unchanged against a wallet created under the new model.
