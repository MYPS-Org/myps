# Plan: Import-Based Itemized Project Creation for LS Wallet

Status: Implemented
Created: 2026-07-16
Source: Conversation — user request to replace manual "Draw Amount" entry with an Excel-import flow

## Context

Today, adding an itemized project to an LS Wallet (`CreateItemizedProjectDialog.tsx`) is a single-project form where the user manually types a "Draw Amount." That number is disconnected from any real funding data — there's no funding-profile breakdown behind it. Investigation confirmed `ItemizedProject.FundingLines` / `FundingLine.IsWalletLine` already exist in the model for exactly this purpose but are **currently dead code**: populated with one synthetic row at creation time, never read by any consumer (not `walletBalance.ts`, not any dialog).

Meanwhile, the Program module already has a working pattern for exactly this kind of bulk, funding-aware project creation: `ImportProjectsDialog.tsx` + `parseImportFile.ts` + `transformImportedProjects.ts`, which parses a 4-sheet Excel workbook (Project Details, Funding Profile, Component Details, Major Items of Work) and submits a full project batch in one call.

Decisions made in conversation:
1. Itemized projects should be treated as **normal projects** — reuse the full 4-sheet import pipeline as-is (not a stripped-down 2-sheet version).
2. The only new parsing/transform responsibility for LSWallet is assigning each imported project its wallet-scoped **LS Project ID** (`LS-W{walletId}-P{n}`, generated the same way `addItemizedProject` already does today) and linking it to the wallet — the Excel's own "Project ID" column is only used to group rows within the file, then discarded/overridden.
3. `CurrentDrawAmount` becomes a **derived** value: `SUM(FundingLines[].Amount)` for that project — mirroring the existing `LSWallet.Amount` invariant (`SUM(WalletFundingProfiles)`). No manual draw-amount field survives anywhere in the UI.
4. Since every funding line on an itemized project now counts toward the draw, `FundingLine.IsWalletLine` (confirmed unused everywhere) is removed.
5. Bulk import must validate that the **sum of Funding Profile amounts across all projects in the file** does not exceed the wallet's `Available` balance before allowing Import (mirrors today's single-project `validateDrawAmount` check).
6. Link is `ParentWalletId` (existing numeric FK), **not** `AlternateId` — `AlternateId` stays a free-text, user-editable external-reference field on Project and must not be overloaded as a relational link (already surfaced and agreed earlier in conversation).

## Goal

Replace the manual "Draw Amount" itemized-project creation dialog with an Excel-import flow that mirrors the Program module's project import, so itemized projects carry real funding-profile (and full project-detail) data, with the wallet draw amount computed automatically instead of typed by hand.

## Acceptance Criteria

As a Program/Wallet manager, I want to bulk-import itemized projects with their full project and funding details from an Excel file into an LS Wallet, so that itemized-project creation uses the same rich, funding-driven data entry already used for Program-level project import, without ever manually typing a draw amount.

- [ ] Clicking "Add Itemized Project" (gating unchanged: enabled only at GAA-R stage with available balance, per `walletActions.ts`) opens a new import dialog reusing the same drag-drop/parse/tabbed-review UI pattern as `ImportProjectsDialog.tsx` (Summary / Projects / Funding / Components / Cost-per-Year / Major Items / Locations / Errors tabs).
- [ ] Each imported project is assigned a system-generated `LS-W{walletId}-P{n}` `ProjectId` (any "Project ID" in the Excel is used only to group rows within the file, then discarded) and linked to the wallet via `ParentWalletId`.
- [ ] Each imported project's `CurrentDrawAmount` is computed as the sum of its own Funding Profile row amounts — no manual draw-amount input exists anywhere in the new flow.
- [ ] Before Import is enabled, the dialog validates that the sum of Funding Profile amounts across **all** projects in the file does not exceed the wallet's current `Available` balance; if it does, Import stays disabled with a clear inline message showing the shortfall.
- [ ] On successful import, all created itemized projects appear in the wallet's Itemized Projects table with correct Draw Amount values, and the wallet balance widget (Total/Used/Available) reflects the new Used total immediately.
- [ ] `FundingLine.IsWalletLine` is removed from the model; no remaining reference to it anywhere in the codebase.
- [ ] `CreateItemizedProjectDialog.tsx` (the old manual-draw dialog) is deleted along with its now-unused DTO fields/service function.
- [ ] Editing an existing pre-publish itemized project's funding no longer accepts a single freeform "new draw amount" — the edit dialog operates on funding-line rows, recomputes the total, and still enforces the existing guard (`newTotal <= CurrentDrawAmount + balance.Available`).
- [ ] Publish, compliance-check (R07/R13), and revision-request flows continue to work unchanged — they only ever read `CurrentDrawAmount`/`PublishedDrawAmount`, never how those values were derived.
- [ ] `computeWalletBalance()` in `walletBalance.ts` is verified still correct against the new derivation path (its formula does not need to change).

## Approach

**Shared import infrastructure.** `parseImportFile.ts` and the reusable pieces of `transformImportedProjects.ts` (currently living under `FE/src/pages/Program/utils/`) get relocated to a shared location so both Program and LSWallet consume the same parser without duplication. Program's existing `ImportProjectsDialog` and `ActionsDropdown.tsx` import paths are updated; behavior must stay identical (regression risk called out below).

**New dialog.** `ImportItemizedProjectsDialog.tsx` (`FE/src/pages/LSWallet/dialogs/`) clones `ImportProjectsDialog.tsx`'s drag-drop/parse/tabbed-review UI, scoped to a wallet (`walletId`, `programId`, wallet display context) instead of a program/stage. It adds one thing Program's dialog doesn't have: a **bulk balance guard** — sum every parsed project's Funding Profile `Amount` rows and compare against `balance.Available`, disabling Import with an inline message if it would overdraw the wallet.

**Model changes.** `ItemizedProject` gains full Project-detail parity (the same category of fields `LSWallet` already gained in the "LSWallet ↔ Project Module Uniformity" work — location, org, source, readiness fields) and typed (not opaque) `ComponentCosts` / `ComponentCostPerYear` / `MajorItemOfWorks` / `MajorItemLocations` arrays, reusing Project's existing Dto types where possible instead of re-declaring wallet-prefixed mirrors. `FundingLine.IsWalletLine` is deleted. A new `DtoImportItemizedProjects` batch DTO (shaped like `ImportProjectDTO` plus `parentWalletId`) replaces the old flat `DtoCreateItemizedProject`.

**Mock store.** `walletMockStore.addItemizedProject(dto)` (single project, synthetic funding line) is replaced by `importItemizedProjects(dto)` (batch): for each project in the batch, generate its `LS-W{walletId}-P{n}` ID via the existing `_nextProjectId` counter, attach its real Funding Profile / Component / Major Item rows, and set `CurrentDrawAmount = SUM(that project's funding rows)`. `updateItemizedProjectDraw` is reworked to accept an updated funding-line array and recompute the total from it rather than accepting a typed number directly (still guarded against `PublishStatus === 'Published'`).

**Edit flow.** `EditDrawAmountDialog.tsx` is reworked into a funding-line editor: instead of one text input for "new draw amount," the user edits/adds/removes funding rows, the dialog computes the new total live, and the existing `maxAllowed = CurrentDrawAmount + balance.Available` guard still applies to that computed total.

**Everything downstream of `CurrentDrawAmount`/`PublishedDrawAmount` is untouched** — confirmed by exploration that `walletBalance.ts`, `Service.ts`'s compliance checks (R07/R13), `PublishItemizedProjectDialog.tsx`, and `ItemizedProjectRevisionDialog.tsx` only ever *read* these fields, never care how they were derived.

**Explicit assumption (flagging, not deciding silently):** imported itemized projects take Category/Sub-Category/Operating Unit/location fields directly from the Excel (full "normal project" independence), rather than being force-copied from the parent wallet the way the old single-create dialog did. If the wallet's Category/SubCategory/OU should instead remain authoritative and override whatever the Excel says, that's a one-line change in the transform step — flagging now so it's a deliberate choice, not an oversight.

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- Relocate `parseImportFile.ts` and extract reusable builder helpers from `transformImportedProjects.ts` into a shared location consumable by both Program and LSWallet; update Program's existing import sites (`ImportProjectsDialog.tsx`, `ActionsDropdown.tsx`) accordingly with zero behavior change.
- Extend `Model.d.ts`: full Project-detail parity fields on `ItemizedProject`, typed `ComponentCosts`/`ComponentCostPerYear`/`MajorItemOfWorks`/`MajorItemLocations`, removal of `IsWalletLine`, new `DtoImportItemizedProjects` DTO, reworked `DtoUpdateDrawAmount`.
- Build `ImportItemizedProjectsDialog.tsx`, including the bulk balance-guard validation against `balance.Available`.
- Rework `walletMockStore.ts`: replace `addItemizedProject` with `importItemizedProjects` (batch ID generation + row attachment + derived `CurrentDrawAmount`), rework `updateItemizedProjectDraw` to operate on funding-line arrays.
- Rework `EditDrawAmountDialog.tsx` into a funding-line editor consistent with the derived-amount model.

### Junior (precise, scoped — delegate to junior-engineer)
- Wire `LSWalletDetail.tsx` to open `ImportItemizedProjectsDialog` instead of `CreateItemizedProjectDialog`; update the success handler to append multiple created projects to local state.
- Delete `CreateItemizedProjectDialog.tsx` and remove now-unused imports/references (including the old `DtoCreateItemizedProject`/`createItemizedProject` usages in `Service.ts`).
- Update `walletSeedData.ts` seed `ItemizedProject` records: drop `IsWalletLine`, and give at least one seed project multiple funding lines to demonstrate the multi-source case in the Itemized Projects table.
- Update `Service.ts`: rename/replace `createItemizedProject` with `importItemizedProjects`, update `updateItemizedProjectDraw`'s call signature to match the new DTO.

### Documentation (tech-writer)
- Update `LSWallet.md` (WF-4 section + architecture tables): describe the new import-based flow, the removed `IsWalletLine` field, and the derived `CurrentDrawAmount`.
- Update `UserManual.md` "Add Itemized Project" section (currently documents the manual draw-amount flow) to describe the Excel import flow and the total-funding-vs-available-balance validation rule.

## Files / Components Touched

- `FE/src/pages/LSWallet/Model.d.ts`
- `FE/src/pages/LSWallet/Service.ts`
- `FE/src/pages/LSWallet/mockData/walletMockStore.ts`
- `FE/src/pages/LSWallet/mockData/walletSeedData.ts`
- `FE/src/pages/LSWallet/dialogs/CreateItemizedProjectDialog.tsx` (deleted)
- `FE/src/pages/LSWallet/dialogs/ImportItemizedProjectsDialog.tsx` (new)
- `FE/src/pages/LSWallet/dialogs/EditDrawAmountDialog.tsx` (reworked)
- `FE/src/pages/LSWallet/Views/LSWalletDetail.tsx`
- `FE/src/pages/LSWallet/utils/walletActions.ts` (callback wiring only)
- `FE/src/pages/Program/utils/parseImportFile.ts` (relocated)
- `FE/src/pages/Program/utils/transformImportedProjects.ts` (relocated/shared helpers)
- `FE/src/pages/Program/dialogs/ImportProjectsDialog.tsx` (import path update only)
- `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx` (import path update only)
- `FE/src/pages/LSWallet/LSWallet.md`, `FE/src/pages/LSWallet/UserManual.md`

## Verification

- Manual run-through in the browser (per repo convention for FE changes): open an LS Wallet at GAA-R stage with available balance, click "Add Itemized Project," import a sample multi-project Excel file, confirm the tabbed review shows parsed data, confirm Import is disabled when total funding exceeds `Available`, confirm successful import updates the Itemized Projects table and the balance widget.
- Edit an unpublished itemized project's funding lines via the reworked edit dialog; confirm the guard blocks an over-budget total and a valid edit updates `CurrentDrawAmount` and the balance widget.
- Confirm Publish / compliance-check / revision-request flows still work unchanged against an imported project.
- Regression-check Program's own "Import Projects" flow still works after the shared-utility relocation.
- `grep -ri "IsWalletLine"` across the repo returns no hits after the change.

## Risks / Open Questions / Assumptions

- **Assumption**: imported projects take Category/Sub-Category/OU/location fields from the Excel directly rather than being force-copied from the wallet (see Approach section) — flagged for explicit sign-off during implementation review, not silently decided.
- **Risk**: this is mock-store-only (per LSWallet's documented mock-swap architecture) — no real backend bulk-import endpoint exists yet for itemized projects; this plan builds the frontend contract assuming one will be wired later, same as other LSWallet WF flows.
- **Risk**: relocating `parseImportFile.ts`/`transformImportedProjects.ts` touches Program module files unrelated to this feature — must be a no-behavior-change move, verified against Program's existing import flow.
- **Known pre-existing gap, explicitly out of scope**: revision approval (`approveRevision` in `walletMockStore.ts`) does not apply `DtoSubmitRevision.requestedCost` back onto `CurrentDrawAmount`/`PublishedDrawAmount` today — this plan does not fix that unrelated gap.
- **Open question**: should `ComponentCosts`/`MajorItemOfWorks`/`MajorItemLocations` get new display UI in the Itemized Projects table, or just be stored (typed, no longer opaque) with no new UI surface for now? Recommendation: store only, no new display UI in this plan — surfacing them is a future task.

## Completion Log
Date: 2026-07-16
- Senior: Relocated `parseImportFile.ts`/`transformImportedProjects.ts` to `FE/src/pages/Project/utils/` (canonical shared home) with re-export shims left at the old `FE/src/pages/Program/utils/` paths so other unplanned consumers (`ImportLumpsumDialog.tsx`, `ProjectForm.tsx`) kept compiling unchanged; updated `ItemizedProject`/DTOs in `Model.d.ts` for full Project-detail parity and derived `CurrentDrawAmount`; removed `FundingLine.IsWalletLine`; built `ImportItemizedProjectsDialog.tsx` with a bulk balance guard; reworked `walletMockStore.ts` (`addItemizedProject` → `importItemizedProjects` batch, `updateItemizedProjectDraw` now takes a `FundingLines[]` array); reworked `EditDrawAmountDialog.tsx` into a funding-line table editor.
- Junior: Fixed `Service.ts` (removed `DtoCreateItemizedProject`/`createItemizedProject`, added `importItemizedProjects`, updated `updateItemizedProjectDraw` signature); updated `walletSeedData.ts` (dropped `IsWalletLine`, added required empty arrays, gave seed project `LS-W001-P002` two funding lines to demonstrate the multi-source case); wired `ImportItemizedProjectsDialog` into `LSWalletDetail.tsx` and deleted `CreateItemizedProjectDialog.tsx`.
- Documentation: Updated `LSWallet.md` (WF-4 section, type tables, new Draw Amount Invariant section, seed data notes) and `UserManual.md` ("Creating Itemized Projects (Bulk Import)" and "Editing Funding Lines" sections rewritten for end users).
Deviations / flags:
- Shared utilities relocated to `FE/src/pages/Project/utils/` rather than duplicated, with re-export shims at the old path to avoid breaking two consumers (`ImportLumpsumDialog.tsx`, `ProjectForm.tsx`) not mentioned in the original plan.
- Post-implementation type-check (`tsc --noEmit`) caught an unused `FundingLine` import in `Service.ts` (fixed) and an inverted disabled-condition bug in `walletActions.ts` — the junior pass had accidentally flipped `disabled: !isAtGAARAndHasFunds` to `disabled: isAtGAARAndHasFunds` on the "Add Itemized Project" button, which would have disabled it exactly when it should be enabled. Caught and fixed before completion.
- The Category/Sub-Category/OU-from-Excel assumption (flagged above) was implemented as stated — not re-confirmed with a human; still open for review.
Files changed: FE/src/pages/LSWallet/{Model.d.ts, Service.ts, LSWallet.md, UserManual.md, Views/LSWalletDetail.tsx, utils/walletActions.ts, mockData/walletMockStore.ts, mockData/walletSeedData.ts, dialogs/EditDrawAmountDialog.tsx}, FE/src/pages/LSWallet/dialogs/ImportItemizedProjectsDialog.tsx (new), FE/src/pages/LSWallet/dialogs/CreateItemizedProjectDialog.tsx (deleted), FE/src/pages/Project/utils/{parseImportFile.ts, transformImportedProjects.ts} (new), FE/src/pages/Program/{utils/parseImportFile.ts, utils/transformImportedProjects.ts, dialogs/ImportProjectsDialog.tsx, components/programDetail/ActionsDropdown.tsx}
