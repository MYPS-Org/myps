# LSWallet Module — Developer Reference

Module 11: **LS Wallet** is a budget-container concept owned by a Program. Itemized AIP projects draw funding from it, and the module tracks a live balance (Total / Used / Available) as projects are created, published, and deleted.

> **Why mock-only?**
> The backend schema for this module is on hold pending an ADR-021 / ADR-025 schema session. The full frontend was built against typed mock data so that swapping to a real API later requires editing only `Service.ts` function bodies — no component changes. See the "Mock/API-Swap Seam" section for how the boundary works.

---

## Folder Structure

```
pages/LSWallet/
├── Model.d.ts                          # All TypeScript interfaces and Dto wire types
├── Service.ts                          # All data access — the ONLY file to change when wiring a real API
│
├── mockData/
│   ├── walletMockStore.ts              # In-memory mutable store + all mutation functions
│   └── walletSeedData.ts               # Seed data reproducing the WF-5 worked balance scenario
│
├── store/
│   ├── walletStore.ts                  # walletDataAtom (Jotai) — full store snapshot; reactive after every mutation
│   └── revisionStore.ts                # Jotai atoms for revision context/status (atoms exist; LSWalletDetail.tsx manages revision state locally)
│
├── hooks/
│   └── useWalletBalance.ts             # useWalletBalance(walletId) / useAllWalletBalances()
│
├── utils/
│   ├── walletBalance.ts                # computeWalletBalance() — pure balance formula, no side effects
│   ├── walletActions.ts                # getWalletActions(), getItemizedProjectActions(), resolveWalletDeleteTier(), resolveProjectDeleteTier()
│   ├── walletStatusBadge.tsx           # WalletStatusBadge component (stage pill)
│   └── constants.ts                    # WALLET_EXCLUSIVE_COMPONENT_TYPES, STAGE_ORDER, REPLENISH_ALLOWED_FROM_STAGE, MOCK_WALLET_COMPONENT_TYPES
│
├── components/
│   ├── WalletBalanceWidget.tsx         # Total / Used / Available cards + progress bar (presentational)
│   ├── WalletActionButtons.tsx         # Renders declarative action array from walletActions.ts
│   ├── CollapsibleSection.tsx          # Reusable chevron-toggle collapsible card; used by WalletForm for all three sections
│   ├── WalletForm.tsx                  # Create/display wallet form; owns fundingProfiles/componentCosts/componentCostPerYear array state, derives Amount client-side, orchestrates validation + confirm-before-create flow
│   ├── WalletDetailsSection.tsx        # Full project-details-parity form: General Information, Location Details, Organizational Responsibilities, Project Source, Implementation Readiness and Modality; replaces WalletProgramSection
│   ├── WalletFundingProfileForm.tsx    # Multi-line funding table with Add/Delete, auto-computed percentage, color-coded totals row; replaces FundingProfileSection
│   └── WalletComponentCostForm.tsx     # Multi-row component cost table with budget summary cards (Total/Max/Remaining), Add/Edit via WalletComponentCostDialog, Delete via Project's DeleteComponentDialog; replaces WalletComponentSection
│
├── rules/
│   └── walletFormRules.ts              # Create Wallet form validation rules (FormValidation.ts pattern)
│
├── dialogs/                            # One dialog per user action (13 total)
│   ├── SaveWalletConfirmDialog.tsx     # Confirm-before-create dialog opened by WalletForm on the Add Wallet page
│   ├── WalletComponentCostDialog.tsx   # Add/Edit wallet component cost; allows 'LS' component type; adapted from Project's ComponentCostDialog with no Major Item of Works linkage and no GIS auto-fill
│   ├── ReplenishWalletDialog.tsx
│   ├── DeleteWalletDialog.tsx
│   ├── AdvanceProgramStageDialog.tsx   # Dev/demo stage-cascade simulation (clearly labeled)
│   ├── ImportItemizedProjectsDialog.tsx # WF-4 drag-drop/parse/tabbed-review import; wallet-scoped clone of Program's ImportProjectsDialog; adds bulk balance guard
│   ├── EditDrawAmountDialog.tsx        # Pre-publish funding-line table editor (add/remove/edit rows); live total guards against exceeding Available
│   ├── PublishItemizedProjectDialog.tsx
│   ├── DeleteItemizedProjectDialog.tsx
│   ├── ItemizedProjectRevisionDialog.tsx
│   ├── ApproveRevisionDialog.tsx
│   ├── RejectRevisionDialog.tsx
│   └── ReturnRevisionForReviewDialog.tsx
│
└── Views/
    ├── LSWalletList.tsx                # List page — paginated table, search, Add Wallet (navigates to /lumpsum/add), dev stage trigger
    ├── AddWallet.tsx                   # Thin page wrapper for WalletForm; registered at /lumpsum/add
    └── LSWalletDetail.tsx              # Detail page — orchestrator for all wallet and project actions
```

---

## Routing

| Route | Component | Route Name |
|---|---|---|
| `/lumpsum` | `LSWalletList` | `LumpSumList` |
| `/lumpsum/add` | `AddWallet` | `AddWallet` |
| `/lumpsum/:walletId` | `LSWalletDetail` | `LumpSumDetails` |

The `/lumpsum/add` route is registered **before** the dynamic `/lumpsum/:walletId` route in `Routes.tsx` so the literal segment `add` is not captured as a `:walletId` param.

Both route names (`LumpSumList` / `LumpSumDetails`) were **pre-existing RBAC placeholders** in `appRouteList.ts` — this module claimed them. The `:projectId` param in the original placeholder was renamed `:walletId` (confirmed safe: zero prior callsites). A pre-existing commented-out sidebar entry in `AppSidebar.tsx` was re-enabled with the standard `ViewAccess` guard matching the `/projects` sidebar item.

**RISK to confirm before merging to `main`:** Because `LumpSumList` / `LumpSumDetails` were already in `appRouteList.ts`, RBAC may have already granted access to those route names for some roles. Confirm with the team before deploying to production.

---

## Data Models (`Model.d.ts`)

All interfaces use PascalCase properties. No camelCase aliases (codebase convention). Dto types are wire-format (camelCase) for future `httpClient.post<T>()` calls.

### Core Domain Types

| Interface | Purpose |
|---|---|
| `LSWallet` | Budget container owned by a Program. `ComponentType` is always `'LS'`. Carries three array fields (`WalletFundingProfiles`, `WalletComponentCosts`, `WalletComponentCostPerYear`) and ~26 optional ProjectDetails-parity flat fields. `Amount` is a **derived** value — see Amount Invariant note below. |
| `WalletFundingProfile` | One funding line on an `LSWallet` (structurally mirrors Project's `FundingProfile`). Fields: `Id`, `WalletId`, `Source`, `Agreement`, `Percentage` (auto-calculated), `Amount`, `CreatedBy`, `CreatedDate`, `IsDeleted`. |
| `WalletComponentCost` | One component cost row on an `LSWallet` (structurally mirrors Project's `ComponentCost`). `WalletId` replaces `ProjectId`; `ComponentType` is always `'LS'` in practice. Passed to Project's `DeleteComponentDialog` via a safe cast. |
| `WalletComponentCostPerYear` | Per-year cost breakdown linked to a `WalletComponentCost` by `ComponentCostId`. Has `Year`, `Amount`, `StartDate`, `EndDate`, `IsDeleted`. |
| `ItemizedProject` | AIP project that draws from a wallet. Has `CurrentDrawAmount` (derived: `SUM(FundingLines.Amount)` — see Draw Amount Invariant below) and `PublishedDrawAmount` (frozen at WF-8). Carries full ProjectDetails-parity optional fields (same groups as `LSWallet`) and typed arrays `ComponentCosts`, `ComponentCostPerYear`, `MajorItemOfWorks`, `MajorItemLocations` — all reusing Project module types directly. |
| `FundingLine` | One funding source on an `ItemizedProject`. All lines on a project contribute to `CurrentDrawAmount`. `IsWalletLine` has been removed — the balance formula uses `CurrentDrawAmount` directly. |
| `LSWalletBalance` | Computed result: `{ WalletId, Total, Used, Available }`. Mirrors the future `vLSWalletBalance` SQL view. |
| `ItemizedProjectRevision` | Revision record for a published project (WF-6). Status codes match the Modification module: `0=Pending, 1=Approved, 2=Disapproved, 3=ForReview`. |
| `WalletStage` | `'BP' | 'NEP' | 'HGAB' | 'GAA' | 'GAA-R'` |

### Amount Invariant

`wallet.Amount` is **always derived**, never set directly:

```
Amount = SUM(WalletFundingProfiles where !IsDeleted)
```

The mock store enforces this via `recomputeWalletAmount()`, which is called after every mutation that touches `WalletFundingProfiles` (`createWallet`, `replenishWallet`). `WalletForm.tsx` mirrors this with a `useEffect` that recomputes `Amount` client-side whenever `fundingProfiles` state changes, so validation and the confirm dialog always read the correct total without a store round-trip.

**Do not set `Amount` directly.** Mutate `WalletFundingProfiles` and let the store (or the form's `useEffect`) recompute.

### Draw Amount Invariant

`project.CurrentDrawAmount` is **always derived**, never set directly:

```
CurrentDrawAmount = SUM(FundingLines[].Amount)
```

The mock store enforces this via `updateItemizedProjectDraw()` (which recomputes the total from the submitted `fundingLines` array) and via `importItemizedProjects()` (which computes it at import time for each project). `EditDrawAmountDialog.tsx` mirrors this client-side: the dialog's "New Total" footer is computed live from the in-dialog rows, and that computed total is what gets submitted — never a manually-typed single number.

**Do not set `CurrentDrawAmount` directly.** Mutate `FundingLines` and call `updateItemizedProjectDraw()` (or `importItemizedProjects()` on first creation).

### `LSWallet` Optional ProjectDetails-Parity Fields

The following optional fields were added to `LSWallet` to reach parity with the Project module's `ProjectDetails` shape. All are `undefined` by default and not required for wallet creation.

| Group | Fields |
|---|---|
| General Information | `MYId`, `AlternateId`, `ExternalId`, `UACS`, `Tier` (1–5), `Rank`, `MYCAApprovalDate`, `Description` |
| Location Details | `Province` (GdbId), `City` (GdbId), `LegislativeDistrict` (GdbId) |
| Organizational Responsibilities | `DEO` (ParticipantId), `Region` (ParticipantId), `ImplementingOffice` (ParticipantId), `RegionWide` (1/2/3) |
| Project Source | `Origin` (TableEnum.NameId), `Agency` (AgencyEnum.NameId) |
| Implementation Readiness and Modality | `ImplementationMode`, `EmergencyMode`, `Feasibility`, `FeasibilityDate`, `DetailedDesign`, `DetailedDesignDate`, `RowAvailable` |

### Dto Wire Types

| Interface | Purpose |
|---|---|
| `DtoCreateWallet` | WF-1 Create Wallet payload. Required: `programId`, `categoryId`, `subCategoryId`, `operatingUnit`, `createdBy`, `fundingProfiles: WalletFundingProfile[]`, `componentCosts: WalletComponentCost[]`, `componentCostPerYear: WalletComponentCostPerYear[]`. All ~26 ProjectDetails-parity flat fields are optional. No flat `FundingSource`/`Amount`/`FundingPercentage`/`ComponentYear` fields — those are replaced by the arrays. |
| `DtoReplenishWallet` | WF-3 Replenish payload — `newAmount` must exceed current `Amount` |
| `DtoImportItemizedProjects` | WF-4 batch import payload — `parentWalletId`, `programId`, `projects: ImportedProject[]`, `createdBy`. The mock store assigns generated IDs (`LS-W{walletId}-P{n}`), rewrites placeholder ProjectIds, derives `CurrentDrawAmount = SUM(FundingProfiles.Amount)` per project, and groups component/major-item rows into typed arrays. Replaces the removed `DtoCreateItemizedProject`. |
| `DtoUpdateDrawAmount` | Pre-publish draw edit payload — `projectId`, `fundingLines: FundingLine[]`, `updatedBy`. Carries the full updated `FundingLines` array; the mock store recomputes `CurrentDrawAmount = SUM(fundingLines.Amount)`. Replaces the old flat `newDrawAmount: number` field. |
| `DtoSubmitRevision` | WF-6 revision submission payload |
| `DtoReviewRevision` | Approve / reject / return payload — `stage: 'Region' | 'CO'` |

### Key Field: `HasStageData`

Both `LSWallet` and `ItemizedProject` have `HasStageData: boolean`. This drives WF-7 delete-tier routing:
- `false` on a wallet means it has never been replenished or stage-cascaded since creation — hard delete is safe.
- `true` on a wallet means it has accumulated history — only soft delete (or blocked, if it has active projects).
- `false` on an itemized project means it has never been published or touched by a stage event — hard delete is safe.
- `true` on an itemized project means it has stage history — soft delete only (or blocked if published).

---

## Mock/API-Swap Seam

Every function in `Service.ts` follows this three-part structure:

```ts
/**
 * Brief description of what this call does.
 *
 * REAL API SWAP:
 *   return httpClient.post<ReturnType>(
 *     '/LSWallet/endpoint',
 *     payload,
 *     { preloaderMessage: 'Loading...' }
 *   );
 *   // Notes on expected payload/response shape
 */
export const functionName = async (payload: DtoType): Promise<ApiResponse<ReturnType>> => {
  // Current: resolves from walletMockStore.ts
  const result = store.mutationFunction(payload);
  syncAtom();
  return mockResponse(result);
};
```

**The rule is enforced at the import layer:** No component or hook may import from `mockData/` directly. All data access goes through `Service.ts` only. When the real backend lands:

1. Delete the mock store function call from the service body.
2. Paste in the `httpClient.post<T>()` call shown in the "REAL API SWAP" comment.
3. Remove the `syncAtom()` call (the atom will be refreshed from the API response instead).
4. No component changes required.

The `syncAtom()` helper in `Service.ts` calls `defaultStore.set(syncWalletStoreAtom, store.getStoreSnapshot())` to push an updated snapshot into Jotai after every mutation.

---

## Live Balance Formula and Draw-Sync Lifecycle

Source: `utils/walletBalance.ts` (`computeWalletBalance`).

```
Total     = wallet.Amount
            where Amount = SUM(WalletFundingProfiles where !IsDeleted)   ← DERIVED, not stored directly
Used      = SUM(effectiveDraw) over active itemized projects
            where active = IsDeleted === false AND IsCancelled === false
            and effectiveDraw = project.PublishedDrawAmount ?? project.CurrentDrawAmount
Available = Total - Used
```

**Draw-sync lifecycle:**

| State | Which field drives Used? |
|---|---|
| Before publish | `CurrentDrawAmount` — updates live on every edit |
| After publish | `PublishedDrawAmount` — frozen at the moment `publishItemizedProject()` succeeds |

This means editing a published project's draw amount (via WF-6 revision) does **not** move `Used` during the revision cycle. `Used` only changes again when a revision is fully approved or a new publish event occurs.

`computeWalletBalance` is a pure function — no Jotai reads, no side effects, safe to unit test in isolation. The `useWalletBalance` hook wraps it reactively:

```ts
// Re-computes whenever walletDataAtom changes
const balance = useWalletBalance(walletId);
```

**Seed data verification** (`walletSeedData.ts`, Wallet 1 at seed state):

```
Amount    = SUM(WalletFundingProfiles)
          = 10,000,000 (original GAA allocation) + 2,000,000 (replenishment top-up)
          = 12,000,000
Total     = wallet.Amount = 12,000,000
Used      = PublishedDrawAmount(Project A)=3,500,000
           + CurrentDrawAmount(Project B)=1,000,000
           (Project C excluded — IsDeleted: true)
         = 4,500,000
Available = 7,500,000
```

---

## 3-Tier Delete Matrix

### Wallet Delete Tiers (WF-7)

| Tier | Condition | Result |
|---|---|---|
| Hard | `HasStageData === false` (brand new, never replenished or cascaded) | Removed from store entirely |
| Soft | `HasStageData === true` AND no active itemized projects | `IsDeleted = true`; kept in store for history |
| Blocked | `HasStageData === true` AND has active itemized projects | Rejected; user must remove projects first |

### Itemized Project Delete Tiers (WF-7)

| Tier | Condition | Result |
|---|---|---|
| Hard | `HasStageData === false` (never published or stage-touched) | Removed from store entirely |
| Soft | `HasStageData === true` AND `PublishStatus !== 'Published'` | `IsDeleted = true`; draw returned to Available immediately |
| Blocked | `PublishStatus === 'Published'` | Rejected; user must use WF-6 revision to cancel |

Tier resolution is done **before** the dialog is opened. `LSWalletDetail.tsx` calls `resolveWalletDeleteTier()` and `resolveProjectDeleteTier()` (both exported from `utils/walletActions.ts`) and passes the resolved `tier` prop to the delete dialogs. The dialogs render the correct message/button based on that prop.

Soft-deleting an unpublished itemized project immediately returns the draw to Available because `computeWalletBalance` filters on `IsDeleted === false`.

---

## 8 Workflows — File Map

| Workflow | Entry Dialog | Service Function | Mock Store Function |
|---|---|---|---|
| WF-1 Create Wallet | `AddWallet` page (`WalletForm.tsx`) → `SaveWalletConfirmDialog` | `createWallet()` | `walletMockStore.createWallet()` |
| WF-2 Stage Cascade | `AdvanceProgramStageDialog` | `advanceProgramStage()` | `walletMockStore.advanceProgramStage()` |
| WF-3 Replenish | `ReplenishWalletDialog` | `replenishWallet()` | `walletMockStore.replenishWallet()` |
| WF-4 Import Itemized Projects | `ImportItemizedProjectsDialog` | `importItemizedProjects()` | `walletMockStore.importItemizedProjects()` |
| WF-5 Live Balance | `WalletBalanceWidget` (display) | `fetchWalletBalance()` (convenience) | — computed by `computeWalletBalance()` |
| WF-6 Revision | `ItemizedProjectRevisionDialog` → `ApproveRevisionDialog` / `RejectRevisionDialog` / `ReturnRevisionForReviewDialog` | `submitRevision()`, `approveRevision()`, `rejectRevision()`, `returnRevisionForReview()` | corresponding mock store functions |
| WF-7 Delete | `DeleteWalletDialog` / `DeleteItemizedProjectDialog` | `deleteWallet()` / `deleteItemizedProject()` | `hardDelete*()` / `softDelete*()` |
| WF-8 Publish | `PublishItemizedProjectDialog` | `publishItemizedProject()` | `walletMockStore.publishItemizedProject()` |

---

## Service Layer — Function Reference

All 18 functions return `Promise<ApiResponse<T>>`. `ApiResponse<T>` is `{ Data: T; Status: number; Message?: string }`.

| Function | Purpose |
|---|---|
| `fetchWalletList(pagination)` | Paginated list with optional ProgramId / Stage / OperatingUnit filters |
| `fetchWalletById(id)` | Single wallet by numeric ID |
| `createWallet(payload, programName)` | WF-1 — creates wallet, syncs atom |
| `replenishWallet(payload)` | WF-3 — adds a new `WalletFundingProfile` (Source: `'Replenishment'`, Amount: `newAmount - current`) then recomputes `Amount = SUM(WalletFundingProfiles)`; throws if `newAmount <= current` |
| `deleteWallet(walletId, updatedBy)` | WF-7 — returns `{ tier, wallet }` |
| `fetchItemizedProjectsByWalletId(walletId)` | All projects for a wallet |
| `validateWalletForItemization(walletId)` | WF-4 gate check — returns `{ valid, message? }` |
| `importItemizedProjects(payload)` | WF-4 — batch-imports parsed Excel projects; assigns generated IDs (`LS-W{walletId}-P{n}`), computes `CurrentDrawAmount = SUM(FundingLines)` per project, syncs atom |
| `updateItemizedProjectDraw(payload)` | Pre-publish draw edit; accepts full `fundingLines: FundingLine[]` array; recomputes `CurrentDrawAmount = SUM`; throws on published project |
| `deleteItemizedProject(projectId)` | WF-7 — returns `{ tier, project }` |
| `publishItemizedProject(projectId)` | WF-8 — runs 13-rule mock check, returns `{ complianceResult, project }` |
| `fetchWalletRevisions(itemizedProjectId)` | Revision history for one project |
| `submitRevision(payload)` | WF-6 — creates new revision record |
| `approveRevision(payload)` | WF-6 — sets Region or CO status to 1 |
| `rejectRevision(payload)` | WF-6 — sets Region or CO status to 2 |
| `returnRevisionForReview(payload)` | WF-6 — sets Region or CO status to 3 |
| `advanceProgramStage(programId, newStage)` | WF-2 — bulk-updates CurrentStage for all wallets of a Program |
| `fetchWalletBalance(walletId)` | Convenience wrapper — computes balance from store, not an API call |

---

## Jotai State Architecture

### `store/walletStore.ts`

| Atom | Type | Purpose |
|---|---|---|
| `walletDataAtom` | `{ wallets: LSWallet[]; itemizedProjects: ItemizedProject[] }` | Full store snapshot — seeded from `walletSeedData` at module load |
| `activeWalletsAtom` | derived | Non-deleted wallets only |
| `itemizedProjectsAtom` | derived | All itemized projects (callers filter as needed) |
| `syncWalletStoreAtom` | write-only | Called by `Service.ts` after every mutation to push a fresh snapshot |
| `defaultStore` | — | Pre-resolved Jotai default store — lets `Service.ts` write atoms outside React |

**Mutation pattern:** `Service.ts` mutates the mock store → calls `syncAtom()` → writes a fresh snapshot into `walletDataAtom`. Every `useAtomValue(walletDataAtom)` subscriber re-renders without an explicit refetch.

### `store/revisionStore.ts`

Jotai atoms for revision context (`currentRevisionContextAtom`, `regionStatusAtom`, `coStatusAtom`, `revisionListAtom`, `activeRevisionAtom`). These atoms exist and are documented but `LSWalletDetail.tsx` chose to manage revision state **locally** instead (see Deviations). The atoms are available for a future dedicated revision reviewer page.

---

## Views

### `LSWalletList.tsx`

- Fetches wallet list via `Service.fetchWalletList()` on mount and pagination changes.
- Balances fetched via `useAllWalletBalances()` hook (single atom read, avoids per-row service calls).
- Search: filters by `OperatingUnit` (Enter key or button).
- **Add Wallet** (header button) and **Create Your First Wallet** (empty-state button) both `navigate('/lumpsum/add')`. No dialog is opened from this page for wallet creation.
- Row actions: **View** (navigates to `/lumpsum/:walletId`) and **[Dev] Advance Stage** (opens `AdvanceProgramStageDialog`). Replenish / Add Itemized / Delete are intentionally not on the list row — they need the full itemized-project context for correct delete-tier resolution and live only on the Detail page.
- Columns: Wallet ID | Program Name | Category | Stage | Total / Available | Created | Actions.

### `AddWallet.tsx` and `WalletForm.tsx`

> **Architecture note — modal → full page.** The "Add Wallet" flow was originally a modal dialog (`CreateWalletDialog`). It was migrated to a dedicated full page modeled on the Project module's `AddProject.tsx` / `ProjectForm.tsx` architecture. `AddWallet.tsx` is a thin page wrapper that renders `<WalletForm />`, exactly mirroring `AddProject.tsx` / `ProjectForm.tsx`.

`WalletForm.tsx` owns the full create-wallet experience. It is mode-driven (`mode="add"` for the Add Wallet page, `mode="edit"` for read-only display in LSWalletDetail):

- Maintains **separate array state** alongside flat wallet state: `fundingProfiles: WalletFundingProfile[]`, `componentCosts: WalletComponentCost[]`, `componentCostPerYear: WalletComponentCostPerYear[]`. Initialized from `initialData` arrays in edit mode.
- Has a `useEffect` that recomputes `wallet.Amount` client-side as `SUM(fundingProfiles where !IsDeleted)` whenever `fundingProfiles` changes, keeping validation and the confirm dialog accurate without a store round-trip.
- Loads `projectEnums` via `getProjectEnums()` to populate dropdowns.
- Renders three `CollapsibleSection` cards (all expanded by default):
  1. **"Project Details"** — `WalletDetailsSection` (General Information, Location Details, Organizational Responsibilities, Project Source, Implementation Readiness and Modality)
  2. **"Funding Profile"** — `WalletFundingProfileForm` (multi-line funding table, Add/Delete, auto-computed percentage)
  3. **"Component Cost"** — `WalletComponentCostForm` (multi-row cost table, budget summary cards, Add/Edit/Delete)
- In `mode="edit"` all sections render disabled; the "Create Wallet" button and `SaveWalletConfirmDialog` are not rendered.
- Validates in two steps before opening the confirm dialog:
  1. Flat-field rules via `walletFormRules.ts` (`ProgramId` required, `CategoryId` required, `Tier` optional 1–5).
  2. Array-level check: at least one non-deleted `WalletFundingProfile` with `Amount > 0`.
- On confirmation, builds a `DtoCreateWallet` payload with the array fields and all optional flat fields, calls `Service.createWallet()`, then navigates to `/lumpsum/{newWalletId}`.

> **Removed rules note:** The old `walletFormRules.ts` entries for `FundingSource`, `Amount`, `FundingPercentage`, `ComponentYear`, `ComponentAmount` have been dropped. Those flat fields no longer exist on `DtoCreateWallet`. The rules file now only validates `ProgramId`, `CategoryId`, and the optional `Tier` range.

### `LSWalletDetail.tsx`

Orchestrator page for all wallet-level and project-level operations. Key design decisions:

- **Reactive from the atom.** Wallet fields (`CurrentStage`, `Amount`, `HasStageData`) and project fields (`PublishStatus`, `CurrentDrawAmount`) are all read from `walletDataAtom`. Every mutation via `Service.ts` calls `syncAtom()`, so the UI stays consistent without explicit refetches.
- **Revisions are the sole exception** — they are not in the atom snapshot. On mount, `LSWalletDetail` fetches revision history for all published projects and stores the result in local state (`useState<Record<number, ItemizedProjectRevision[]>>`). Revision actions update this local state via `onSuccess` callbacks.
- **Form sections are reused in disabled mode.** `WalletForm` accepts a `mode` prop. In Detail view, `LSWalletDetail` renders `<WalletForm mode="edit" initialData={wallet} />`, which renders all three section components (`WalletDetailsSection`, `WalletFundingProfileForm`, `WalletComponentCostForm`) in disabled mode using a stable `noOp` callback. No separate disabled-mode rendering logic is needed in the Detail page.
- **Delete tier is pre-resolved.** Before opening either delete dialog, Detail calls `resolveWalletDeleteTier()` / `resolveProjectDeleteTier()` and passes the resolved tier as a required prop. The dialogs do not determine their own tier.

---

## Dialogs

| Dialog | Triggered from | Primary service call |
|---|---|---|
| `SaveWalletConfirmDialog` | Add Wallet page (`WalletForm.tsx`) — "Create Wallet" button | `Service.createWallet()` |
| `WalletComponentCostDialog` | `WalletComponentCostForm` — "Add Component" / pencil edit | None (updates in-form state only; persisted on wallet save) |
| `ReplenishWalletDialog` | Detail page action buttons | `Service.replenishWallet()` |
| `DeleteWalletDialog` | Detail page; requires `tier` prop | `Service.deleteWallet()` |
| `AdvanceProgramStageDialog` | List row "[Dev] Advance Stage" or Detail action | `Service.advanceProgramStage()` |
| `ImportItemizedProjectsDialog` | Detail page "Add Itemized Project" — drag-drop Excel import with tabbed review (Summary / Projects / Funding / Components / Cost-per-Year / Major Items / Locations / Errors) and bulk balance guard (Import disabled if `SUM(all parsed funding amounts) > balance.Available`) | `Service.importItemizedProjects()` |
| `EditDrawAmountDialog` | Per-project "Edit Draw Amount" (pre-publish only) — funding-line table editor (add/remove/edit Source, Agreement, Amount, Percentage rows); live total computed from rows; existing overdraw guard applied to that total | `Service.updateItemizedProjectDraw()` |
| `PublishItemizedProjectDialog` | Per-project "Publish" | `Service.publishItemizedProject()` |
| `DeleteItemizedProjectDialog` | Per-project "Delete/Remove Project"; requires `tier` prop | `Service.deleteItemizedProject()` |
| `ItemizedProjectRevisionDialog` | Per-project "Request Revision" (post-publish only) | `Service.submitRevision()` |
| `ApproveRevisionDialog` | Inline revision history row | `Service.approveRevision()` |
| `RejectRevisionDialog` | Inline revision history row | `Service.rejectRevision()` |
| `ReturnRevisionForReviewDialog` | Inline revision history row | `Service.returnRevisionForReview()` |

---

## WF-8 Compliance Check (13 Rules)

`Service.publishItemizedProject()` runs a mock 13-rule check before calling the store's `publishItemizedProject()`.

- **Rules R01–R06:** Named structural checks — always pass in the mock (real rule content to be confirmed with team before backend wiring; see plan RISK note).
- **Rules R07–R12:** Named status checks — pass/fail based on real project/wallet state (`IsCancelled`, `IsDeleted`, `CurrentStage`, etc.).
- **Rule R13:** `CurrentDrawAmount <= Available`. The only rule in the mock that can actually fail based on balance state.

The service returns `{ complianceResult: { Rules, AllPassed }, project }`. If `AllPassed === false`, `project` is `null` and the dialog displays the failing rule list. On all-pass, the mock store's `publishItemizedProject()` captures `PublishedDrawAmount = CurrentDrawAmount` (see OPEN-1 below).

---

## Cross-Module Touches

### Project → LSWallet: `ComponentCostDialog.tsx`

`FE/src/pages/Project/dialogs/ComponentCostDialog.tsx` imports `WALLET_EXCLUSIVE_COMPONENT_TYPES` from `LSWallet/utils/constants.ts` and filters it from the component-type dropdown:

```ts
// In ComponentCostDialog.tsx
componentTypes?.filter(
  (type) => !WALLET_EXCLUSIVE_COMPONENT_TYPES.includes(type.ComponentId || '')
)
```

This ensures the `'LS'` component type (reserved for wallet component lines) cannot be selected on regular or itemized AIP projects. If the backend adds more wallet-exclusive types, adding them to `WALLET_EXCLUSIVE_COMPONENT_TYPES` in `constants.ts` is the only code change needed.

**Context:** The existing codebase already has an unrelated feature — `ProjectDetails.IslandCode === 'LS'` marks a legacy "Lump Sum project type" with its own "Itemized Lump Sum Import" dialog in `FE/src/pages/Project/`. The LSWallet module is distinct from that feature. The `WALLET_EXCLUSIVE_COMPONENT_TYPES` filter does not affect that feature.

### LSWallet → Project: `useLocationFilters` and `DeleteComponentDialog`

Two components in this module import from `FE/src/pages/Project/` — both are intentional, scoped exceptions:

| LSWallet file | Project import | Reason |
|---|---|---|
| `WalletDetailsSection.tsx` | `useLocationFilters` from `Project/filteringLocations` | Pure hook (no side effects, no store access) that handles province/city/LD cascade filtering. Importing avoids duplicating ~150 lines of filtering logic. Guarded by the `isLumpSum = true` argument so the hook returns the full unfiltered list (wallet is program-wide). |
| `WalletComponentCostForm.tsx` | `DeleteComponentDialog` from `Project/dialogs/deleteDialogs/` | `WalletComponentCost` is structurally compatible with `ComponentCost` for the subset of fields `DeleteComponentDialog` reads (`ComponentId`, `ComponentType`, `Total`, `Description`). The cast is safe because the only structural difference is `WalletId: number` vs `ProjectId: string`, which `DeleteComponentDialog` does not access. `relatedMajorItemsCount` is always `0` (wallets have no Major Item of Works). |

**Structural typing risk:** If `ComponentCost` gains a new required field that `WalletComponentCost` does not carry, the cast in `WalletComponentCostForm` will fail at runtime. Update `WalletComponentCost` in `Model.d.ts` to match when that happens.

### `MOCK_WALLET_COMPONENT_TYPES` and `WalletComponentCostDialog`

`utils/constants.ts` also exports `MOCK_WALLET_COMPONENT_TYPES` — a hardcoded list of `ComponentTypeEnum`-shaped records (`LS`, `DR`, `ROW`, `ENG`, `ADM`) used by `WalletComponentCostDialog`. This list exists because the real component types come from `getProjectDetails().Dropdowns.ComponentTypes`, which requires an existing project ID that wallets do not have. Replace with a direct `/LSWallet/component-types` endpoint call when the backend provides one.

`WalletComponentCostDialog` deliberately does **not** apply the `WALLET_EXCLUSIVE_COMPONENT_TYPES` filter — wallets must be able to select `'LS'` as their component type. This is the mirror-image of `ComponentCostDialog`'s explicit exclusion.

---

## Open Items / Known Follow-ups

These are framed as current scope limitations, not defects.

### OPEN-1 — Frozen Used snapshot mechanism (upstream, unresolved)

The source ADR docs do not specify how the server should capture the `PublishedDrawAmount` snapshot. The mock stand-in captures `PublishedDrawAmount = CurrentDrawAmount` at the moment `walletMockStore.publishItemizedProject()` is called. This is documented with an `OPEN-1 MOCK STAND-IN` comment directly on the function. When the real API lands, this field should come from the API response — it must not be computed client-side in production.

### OPEN-2 — Replenish window (upstream, unresolved)

Currently allowed from `GAA` onwards (`REPLENISH_ALLOWED_FROM_STAGE = 'GAA'` in `constants.ts`). To restrict to `GAA-R` only, change that one constant. No other code changes needed.

### WF-4 Option A (follow-up)

Manually entering a Wallet ID on the regular Project creation form was not built in this phase (WF-4 Option B — creating from the Wallet Detail page — is the only path). Option A requires a field + validation change in `FE/src/pages/Project/` and was deferred.

### Revision review UI scope

The revision review interface is an inline expandable table on `LSWalletDetail.tsx`, not a separate reviewer-queue page. The `store/revisionStore.ts` atoms are in place to support a dedicated reviewer page in a future phase. `LSWalletDetail.tsx` manages revision state locally until then.

### `EditDrawAmountDialog` rework

This dialog was not in the original plan's task list. Its first version (now replaced) was a simple single-amount text input. It has since been reworked into a full funding-line table editor: the user can add, remove, and edit individual `FundingLine` rows (Source, Agreement, Amount, Percentage). A live "New Total" footer is computed from the rows, and a change indicator panel below the table shows whether the edit is an increase (draws more from Available) or a decrease (returns funds). The existing overdraw guard (`newTotal <= CurrentDrawAmount + balance.Available`) is applied to that computed total — not a manually typed number. Submits `DtoUpdateDrawAmount` with the full `fundingLines` array; the mock store recomputes `CurrentDrawAmount = SUM(fundingLines.Amount)` (DRAW AMOUNT INVARIANT). The "Edit Draw Amount" action was always in `getItemizedProjectActions()`; this rework is the dialog that backs it.

### `DeleteWalletDialog` and `DeleteItemizedProjectDialog` `tier` prop

The `tier` prop is required on both delete dialogs (not optional). The caller (`LSWalletDetail.tsx`) resolves the tier before opening the dialog. The dialog renders different messaging and button labels based on the received tier.

### `LSWalletList.tsx` row actions

Only "View" (navigate to detail) and "[Dev] Advance Stage" are on the list row. Replenish, Add Itemized Project, and Delete require the full itemized-project list to correctly resolve delete tiers, so they live exclusively on the Detail page.

### `HasStageData` field

Added during implementation (not in the original schema doc list). Drives hard vs. soft/blocked delete tier for both wallets and itemized projects. Starts `false` on creation; flips to `true` on first replenish or stage cascade for a wallet, or on first publish/stage event for a project.

---

## Seed Data

Wallet 1 (`Id: 1`) — `Asset Preservation Program 2024`, `Amount: 12,000,000` at GAA stage. `Amount` is derived from two seeded `WalletFundingProfiles`:
- Profile Id 1: `Source: 'General Appropriations Act'`, `Amount: 10,000,000` (original allocation).
- Profile Id 2: `Source: 'Replenishment'`, `Amount: 2,000,000` (represents the WF-3 replenish top-up).

Has three seeded itemized projects:
- Project A (`LS-W001-P001`): Published, `PublishedDrawAmount = 3,500,000`.
- Project B (`LS-W001-P002`): Not published, `CurrentDrawAmount = 1,000,000`. Seeded with two `FundingLine` records to demonstrate multi-source funding: ₱600,000 "General Appropriations Act" (60%) + ₱400,000 "Replenishment" (40%) — summing to 1,000,000 (DRAW AMOUNT INVARIANT in effect at seed time).
- Project C (`LS-W001-P003`): Soft-deleted — excluded from balance.

Wallet 2 (`Id: 2`) — `Infrastructure Build Fund 2024`, `Amount: 5,000,000` at GAA-R. One `WalletFundingProfile` (100% GAA). No itemized projects — available for WF-4 demos.

The seed represents the **after-replenish** state of the WF-5 worked scenario. Rather than replaying the 10M → 12M replenish step, the seed starts with two funding profile lines that sum to 12M. Calling `replenishWallet()` at runtime appends a third profile line (Source: `'Replenishment'`); it does not mutate existing lines.
