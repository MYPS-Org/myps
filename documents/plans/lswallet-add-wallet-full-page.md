# Plan: Convert LSWallet "Add Wallet" from Modal Dialog to Full Page

Status: Implemented
Created: 2026-07-13
Source: User conversation — after the LSWallet visual-parity restyle, user decided "Add Wallet" should not remain a modal dialog and should instead be a dedicated page mirroring Project's AddProject.tsx/ProjectForm.tsx architecture.

## Context

The LSWallet visual-parity restyle (an earlier, already-implemented plan) made `LSWalletDetail.tsx`/`LSWalletList.tsx` and `CreateWalletDialog.tsx`'s child sections look like Project's UI, but kept "Add Wallet" as a modal dialog (`CreateWalletDialog.tsx`). After seeing the result, the user decided that's not good enough: they want the whole flow to work like Project's "Add Project" — a dedicated full page (`AddProject.tsx` → `ProjectForm.tsx`) where Program selection and all fields happen inline on the page itself, not in a popup. The explicit ask: "copy the project form here and edit it according to the acceptance criteria we have" — i.e. reuse Project's actual architecture (thin page wrapper + a Form component owning state/validation/confirm-dialog/navigation), not just its visual style, so that documenting and maintaining the two flows stays consistent going forward.

Research confirmed this is a clean port: Project's Program selection is just a dropdown of *existing* programs (no inline program creation), which `WalletDetailsSection.tsx` already implements via `SearchableDropdown` — and that exact component already renders correctly in a full-page collapsible-card context today (`LSWalletDetail.tsx` already uses it, in disabled/read-only mode). So this task is primarily new orchestration (a `WalletForm.tsx` mirroring `ProjectForm.tsx`) plus routing, not new field-level UI.

Two decisions were confirmed with the user directly:
1. Add a confirm-before-save dialog matching `ProjectForm.tsx`'s validate → confirm dialog → confirm → save → navigate pattern, owned by the new page component itself (not bolted on elsewhere).
2. Delete `CreateWalletDialog.tsx` entirely once nothing references it — no dead code left behind.

Research also surfaced a real, pre-existing blocking bug worth fixing while this code is being rewritten anyway: `FundingPercentage` is a required validation field but the input is `readOnly`/locked at 100% with no default ever seeded — meaning **Add Wallet cannot pass validation today** in the existing dialog. This plan fixes that as a one-line default-state seed, not as scope creep (see Risks).

## Goal

Replace LSWallet's "Add Wallet" modal (`CreateWalletDialog.tsx`) with a dedicated `/lumpsum/add` page, architecturally mirroring `AddProject.tsx` + `ProjectForm.tsx`: a thin page wrapper rendering a Form component that owns state, validation, a confirm-before-save dialog, and navigation to the newly created wallet's detail page on success.

## Acceptance Criteria

As a Program/Wallet administrator, I want to add a new LS Wallet on its own dedicated page instead of a cramped modal, so that I get the same full-page workflow, validation, and confirmation experience used elsewhere in MYPS (e.g. Add Project), and land directly on the new wallet's detail page once it's created.

- [ ] Navigating to `/lumpsum/add` renders the new Add Wallet page (not a dialog); the route is registered in both `appRouteList.ts` and `Routes.tsx`, with `AddWallet` placed before the dynamic `LumpSumDetails` route (matches `AddProject`/`ProjectDetails` ordering convention).
- [ ] `LSWalletList.tsx`'s header "Add Wallet" button and the empty-state "Create Your First Wallet" button both navigate to `/lumpsum/add` instead of opening a dialog.
- [ ] `CreateWalletDialog.tsx` is deleted; a repo-wide search for `CreateWalletDialog` returns zero hits (imports, JSX usage, doc references).
- [ ] `WalletDetailsSection`, `FundingProfileSection`, and `WalletComponentSection` each render inside their own collapsible card (chevron header + "Wallet Details" / "Funding Profile" / "Component Details" title) on the new page, in non-disabled/interactive mode, with working `onChange` — editing any field updates state and clears that field's error.
- [ ] The new page seeds `FundingPercentage: 100` in initial state (fixing the pre-existing bug where this required, read-only field was never defaulted, which made the old dialog's form permanently unsubmittable).
- [ ] Field-level validation matches `walletFormRules.ts` exactly: leaving `ProgramId`, `CategoryId`, `FundingSource`, `Amount`, `FundingPercentage`, `ComponentYear`, or `ComponentAmount` unset/invalid and clicking Save shows one toast per violated rule and does not open the confirm dialog.
- [ ] On successful validation, a confirm dialog (`SaveWalletConfirmDialog`) appears before any API call; cancelling makes no `createWallet` call and returns to the editable form with state intact.
- [ ] Confirming the dialog calls `createWallet(payload, selectedProgram.Name)` with the same field mapping as the old dialog.
- [ ] On success: a success toast fires and the app navigates to `/lumpsum/{new wallet Id}` (the just-created wallet's detail page).
- [ ] On API failure: existing toast/catch pattern applies, user stays on the Add Wallet page with entered data intact.
- [ ] `LSWallet.md` is updated: file tree includes `AddWallet.tsx`, `WalletForm.tsx`, `SaveWalletConfirmDialog.tsx`; `CreateWalletDialog.tsx` removed from the dialogs list; Routing table gains the `AddWallet` / `/lumpsum/add` row.

## Approach

**Component split** (mirrors `AddProject.tsx` + `ProjectForm.tsx` exactly):

- `FE/src/pages/LSWallet/Views/AddWallet.tsx` — new, thin wrapper. No query-param plumbing needed (Wallet's Program picker has no cross-page prefill use case today, unlike Project's `programId`/`stageName` params). Just renders `<WalletForm />`.

- `FE/src/pages/LSWallet/components/WalletForm.tsx` — new, the architecturally complex piece. Owns:
  - `wallet: Partial<LSWallet>` state, seeded with `{ FundingPercentage: 100 }`.
  - `errors`, `isSaving`, `projectEnums` (loaded via `getProjectEnums()` on mount — same call `CreateWalletDialog` already makes).
  - Three collapsible cards (`isDetailsOpen`, `isFundingOpen`, `isComponentOpen`, all default `true`), each `bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl` with a chevron header — copy the exact markup already used in `LSWalletDetail.tsx`'s three matching card blocks (its Wallet Details/Funding Profile/Component Details sections), removing `disabled` and wiring real `onChange={handleChange}` instead of `noOp`.
  - `handleChange(field, value)` — identical to `CreateWalletDialog`'s generic setter + per-field error clear.
  - `handleSaveWallet()` — validates via `formValidation(wallet, walletFormRules)`, toasts+stops on error, resolves `selectedProgram` from `projectEnums.Programs` (toast+stop if not found), then opens the confirm dialog — mirrors `ProjectForm.handleSaveProjectDetails` exactly (validate → open dialog, no API call yet).
  - `confirmSaveWallet()` (the dialog's `onConfirm`) — builds `DtoCreateWallet` (same field mapping as the old dialog: `categoryId`, `subCategoryId` defaulted `0`, `operatingUnit` defaulted `''`, `fundingAgreement` defaulted `''`, `componentUACS`/`componentStartDate`/`componentEndDate` defaulted `null`, `createdBy: user?.UserId || ''`), calls `createWallet(payload, selectedProgram.Name)`, on success toasts and `navigate(\`/lumpsum/${result.Data.Id}\`)`, on error follows the existing catch pattern (see Risks — also fix the pre-existing CLAUDE.md toast-in-catch slip while here).
  - Renders `<SaveWalletConfirmDialog>` at the bottom, wired `isOpen={isConfirmDialogOpen}` / `onConfirm={confirmSaveWallet}`, same placement pattern as `ProjectForm.tsx`'s `<SaveProjectConfirmDialog>`.
  - A single "Create Wallet" button after the three cards (there's no per-section save split like Project's edit-mode-gated sections — a wallet's creation is one shot, so one button covers it).

- `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx` — new, trimmed wallet-specific copy of `SaveProjectConfirmDialog.tsx`. Since a wallet only ever has an "add" flow (no wallet-details edit form exists elsewhere in the app), hardcode the copy ("Create New Wallet" / confirm-to-proceed message) rather than keep a speculative `mode` prop. Props: `isOpen`, `onClose`, `onConfirm: () => Promise<void>`, `programName?: string` (for an optional name-preview card) — same info-box + Cancel/Save-with-spinner structure as the Project original.

**Routing:**
- `FE/src/utils/appRouteList.ts` — add `{ RouteName: 'AddWallet', path: '/lumpsum/add' }`.
- `FE/src/components/Routes.tsx` — import `AddWallet`; add its route entry in the existing `// #region LS Wallet Routes` block, **before** `LumpSumDetails` (`/lumpsum/:walletId`), matching how `AddProject` is placed before `ProjectDetails`.
- `LSWalletList.tsx` — both "Add Wallet" buttons (header + empty state) become `onClick={() => navigate('/lumpsum/add')}`; remove `isCreateWalletOpen` state, `handleCreateWalletSuccess`, the `CreateWalletDialog` import and its render.

**Deletion:** `CreateWalletDialog.tsx` deleted once `LSWalletList.tsx` no longer references it (verify zero remaining repo-wide references first).

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- Create `FE/src/pages/LSWallet/components/WalletForm.tsx`: port `CreateWalletDialog`'s state/handleChange/enum-loading logic into a full-page form; wrap the three section components in page-context collapsible cards (copied from `LSWalletDetail.tsx`'s proven pattern); seed `FundingPercentage: 100`; implement the validate → confirm-dialog → save → navigate flow modeled on `ProjectForm.tsx`'s split; render `<SaveWalletConfirmDialog>` wired correctly. This is the one file where state orchestration, validation, dialog sequencing, and navigation all interact and need a single coherent pass.

### Junior (precise, scoped — delegate to junior-engineer, parallel where files are disjoint)
- Create `FE/src/pages/LSWallet/Views/AddWallet.tsx` — thin wrapper mirroring `AddProject.tsx`, renders `<WalletForm />`.
- Create `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx` — trimmed wallet-specific copy of `SaveProjectConfirmDialog.tsx` per the Approach section above.
- Register the route in `FE/src/utils/appRouteList.ts`.
- Register the route in `FE/src/components/Routes.tsx` (before `LumpSumDetails`).
- Update `FE/src/pages/LSWallet/Views/LSWalletList.tsx`: swap both Add Wallet button handlers to `navigate('/lumpsum/add')`; remove `isCreateWalletOpen` state, `handleCreateWalletSuccess`, the `CreateWalletDialog` import/render.
- Delete `FE/src/pages/LSWallet/dialogs/CreateWalletDialog.tsx` (confirm zero remaining references first via grep).

### Documentation (tech-writer)
- Update `FE/src/pages/LSWallet/LSWallet.md`: file-tree additions/removals, dialogs list (12 → 11), Routing table gains the `AddWallet` row, brief prose note that Add Wallet moved from modal to full page.

## Files / Components Touched

**Created:**
- `FE/src/pages/LSWallet/Views/AddWallet.tsx`
- `FE/src/pages/LSWallet/components/WalletForm.tsx`
- `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx`

**Modified:**
- `FE/src/utils/appRouteList.ts`
- `FE/src/components/Routes.tsx`
- `FE/src/pages/LSWallet/Views/LSWalletList.tsx`
- `FE/src/pages/LSWallet/LSWallet.md`

**Deleted:**
- `FE/src/pages/LSWallet/dialogs/CreateWalletDialog.tsx`

**Reused as-is (already correct, no changes needed):**
- `FE/src/pages/LSWallet/components/WalletDetailsSection.tsx`
- `FE/src/pages/LSWallet/components/FundingProfileSection.tsx`
- `FE/src/pages/LSWallet/components/WalletComponentSection.tsx`
- `FE/src/pages/LSWallet/rules/walletFormRules.ts`
- `FE/src/pages/LSWallet/Service.ts` (`createWallet`)
- `FE/src/pages/Project/Service.ts` (`getProjectEnums`)

## Risks / Open Questions / Assumptions

- **`FundingPercentage` was never defaulted — a genuine pre-existing bug, not scope creep.** `FundingProfileSection.tsx`'s Funding Percentage input is hardcoded `readOnly` (locked to 100% for single-line LS wallets), but `CreateWalletDialog.tsx` never seeds a default, and `walletFormRules.ts` requires it to be 1–100. Result: the *current* Add Wallet dialog can never pass validation. Fixed here by seeding `{ FundingPercentage: 100 }` in `WalletForm.tsx`'s initial state — a one-line necessary fix while this code is being rewritten anyway.
- **`FundingSource`/`FundingAgreement` dropdowns have no real data source in Add mode — pre-existing gap, carried forward as-is.** `CreateWalletDialog.tsx` passes `fundingSources={[]}`/`fundingAgreements={[]}` hardcoded; `getProjectEnums()`'s `ProjectEnums` type has no Sources/Agreements field (those only exist on the separate `Dropdowns` type, populated only in an existing-project-detail context). No known service in this codebase currently returns funding-source/agreement enums outside that context. This plan does **not** invent a fix — it preserves current (broken) behavior exactly, since sourcing real enums needs backend/PM input. Flagging so it isn't mistaken for a regression introduced by this migration; recommend a follow-up ticket.
- **RBAC for the new `AddWallet` route name.** `LumpSumList`/`LumpSumDetails` were pre-existing RBAC placeholders this module repurposed; `AddWallet` has no such history — it's a brand-new route name gated the same way any new protected route is (`ViewAccess.includes(RouteName)`, synced from the backend RBAC module). No special code-side handling needed, but an admin will need to grant the `AddWallet` route to appropriate roles post-deploy or the button will navigate to an inaccessible route. Deployment note, not a code change.
- **Route ordering** (`AddWallet` before `LumpSumDetails` in `Routes.tsx`) isn't strictly required for correctness (React Router ranks static paths over dynamic ones regardless of declaration order), but matches the existing `AddProject`/`ProjectDetails` convention, so keeping it avoids any doubt.
- **Minor CLAUDE.md fix bundled in:** `CreateWalletDialog.tsx`'s `getProjectEnums()` catch block manually toasts an error, duplicating `httpClient`'s interceptor toast (violates `FE/CLAUDE.md`'s no-toast-in-catch-for-expected-errors rule). Fixed opportunistically in the new `WalletForm.tsx` since the code is being rewritten anyway.

## Verification

No automated test suite covers this module — verify by running the app and walking through:
1. `npm run dev` in `FE/`, navigate to `/lumpsum`, click "Add Wallet" — confirm it navigates to `/lumpsum/add` (not a modal).
2. On the Add Wallet page: confirm all three sections (Wallet Details, Funding Profile, Component Details) render as collapsible cards, expanded by default, editable.
3. Click "Create Wallet" with empty required fields — confirm per-rule toasts fire and no confirm dialog appears.
4. Fill required fields (Program, Category, Funding Source, Amount, Component Year, Component Amount — Funding Percentage should already show 100), click "Create Wallet" — confirm the `SaveWalletConfirmDialog` appears before any network/mock call.
5. Cancel the confirm dialog — confirm no wallet was created (check `/lumpsum` list count unchanged) and form state is preserved.
6. Confirm the dialog — confirm a success toast fires and the browser navigates to `/lumpsum/{new id}`, landing on the new wallet's detail page with the entered data visible.
7. Confirm `git grep -i CreateWalletDialog` (or equivalent search) returns zero results after deletion.

## Completion Log
Date: 2026-07-13
- Senior: Created `FE/src/pages/LSWallet/components/WalletForm.tsx` — full-page form component mirroring `ProjectForm.tsx`'s architecture. Seeds `wallet` state with `{ FundingPercentage: 100 }` (fixes the pre-existing bug where this required, read-only field was never defaulted). Loads `projectEnums` via `getProjectEnums()` on mount (silent catch, no manual toast, per `FE/CLAUDE.md`). Wraps `WalletDetailsSection`/`FundingProfileSection`/`WalletComponentSection` each in a `ring-1 ring-gray-900/5 sm:rounded-xl` collapsible card (copied from `LSWalletDetail.tsx`'s proven pattern), all default expanded. Implements `handleSaveWallet` (validate → resolve program → open confirm dialog, no API call yet) and `confirmSaveWallet` (build `DtoCreateWallet` with the exact field mapping `CreateWalletDialog.tsx` used → `createWallet()` → toast → `navigate('/lumpsum/{new Id}')`). Renders `<SaveWalletConfirmDialog>` wired to this flow.
- Junior:
  - Created `FE/src/pages/LSWallet/Views/AddWallet.tsx` — thin wrapper mirroring `AddProject.tsx`, renders `<WalletForm />`.
  - Created `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx` — plain-inline-chrome confirm dialog (`isOpen`/`onClose`/`onConfirm`/`programName?` props), matches `ReplenishWalletDialog.tsx`'s style.
  - Registered `{ RouteName: 'AddWallet', path: '/lumpsum/add' }` in `FE/src/utils/appRouteList.ts`.
  - Registered the `AddWallet` route + import in `FE/src/components/Routes.tsx`, placed before the dynamic `LumpSumDetails` route.
  - Updated `FE/src/pages/LSWallet/Views/LSWalletList.tsx`: both "Add Wallet" buttons now `navigate('/lumpsum/add')`; removed `isCreateWalletOpen` state, `handleCreateWalletSuccess`, the `CreateWalletDialog` import/render.
  - Deleted `FE/src/pages/LSWallet/dialogs/CreateWalletDialog.tsx` after verifying (grep) zero remaining code references.
- Documentation: Updated `FE/src/pages/LSWallet/LSWallet.md` — folder-structure tree (added `AddWallet.tsx`, `WalletForm.tsx`, `SaveWalletConfirmDialog.tsx`; removed `CreateWalletDialog.tsx`), Routing table (`AddWallet` / `/lumpsum/add` row + note on static-before-dynamic route ordering), Dialogs table (swapped `CreateWalletDialog` row for `SaveWalletConfirmDialog`), WF-1 entry-dialog column updated, new `AddWallet.tsx and WalletForm.tsx` prose subsection added explaining the modal→page migration and the `FundingPercentage` fix.

Deviations / flags: None blocking. Two pre-existing gaps carried forward as-is per the plan's Risks section (not fixed, not regressions introduced by this work): `FundingSource`/`FundingAgreement` dropdowns still have no real data source (`fundingSources={[]}`/`fundingAgreements={[]}` hardcoded); `AddWallet` RBAC route access needs to be granted post-deploy via the backend RBAC module (deployment note, not code).

Files changed:
- `FE/src/pages/LSWallet/Views/AddWallet.tsx` (created)
- `FE/src/pages/LSWallet/components/WalletForm.tsx` (created)
- `FE/src/pages/LSWallet/dialogs/SaveWalletConfirmDialog.tsx` (created)
- `FE/src/pages/LSWallet/dialogs/CreateWalletDialog.tsx` (deleted)
- `FE/src/utils/appRouteList.ts`
- `FE/src/components/Routes.tsx`
- `FE/src/pages/LSWallet/Views/LSWalletList.tsx`
- `FE/src/pages/LSWallet/LSWallet.md`
