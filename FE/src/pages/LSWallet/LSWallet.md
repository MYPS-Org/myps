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
│   └── constants.ts                    # WALLET_EXCLUSIVE_COMPONENT_TYPES, STAGE_ORDER, REPLENISH_ALLOWED_FROM_STAGE
│
├── components/
│   ├── WalletBalanceWidget.tsx         # Total / Used / Available cards + progress bar (presentational)
│   ├── WalletActionButtons.tsx         # Renders declarative action array from walletActions.ts
│   ├── WalletDetailsSection.tsx        # Project Details form section (reused in Create and Detail views)
│   ├── FundingProfileSection.tsx       # Funding Profile form section
│   └── WalletComponentSection.tsx      # Component section (locked to 'LS' type, amount auto-filled)
│
├── rules/
│   └── walletFormRules.ts              # Create Wallet form validation rules (FormValidation.ts pattern)
│
├── dialogs/                            # One dialog per user action (12 total)
│   ├── CreateWalletDialog.tsx
│   ├── ReplenishWalletDialog.tsx
│   ├── DeleteWalletDialog.tsx
│   ├── AdvanceProgramStageDialog.tsx   # Dev/demo stage-cascade simulation (clearly labeled)
│   ├── CreateItemizedProjectDialog.tsx
│   ├── EditDrawAmountDialog.tsx        # Pre-publish draw amount editor (guards against exceeding Available)
│   ├── PublishItemizedProjectDialog.tsx
│   ├── DeleteItemizedProjectDialog.tsx
│   ├── ItemizedProjectRevisionDialog.tsx
│   ├── ApproveRevisionDialog.tsx
│   ├── RejectRevisionDialog.tsx
│   └── ReturnRevisionForReviewDialog.tsx
│
└── Views/
    ├── LSWalletList.tsx                # List page — paginated table, search, Add Wallet, dev stage trigger
    └── LSWalletDetail.tsx              # Detail page — orchestrator for all wallet and project actions
```

---

## Routing

| Route | Component | Route Name |
|---|---|---|
| `/lumpsum` | `LSWalletList` | `LumpSumList` |
| `/lumpsum/:walletId` | `LSWalletDetail` | `LumpSumDetails` |

Both route names (`LumpSumList` / `LumpSumDetails`) were **pre-existing RBAC placeholders** in `appRouteList.ts` — this module claimed them. The `:projectId` param in the original placeholder was renamed `:walletId` (confirmed safe: zero prior callsites). A pre-existing commented-out sidebar entry in `AppSidebar.tsx` was re-enabled with the standard `ViewAccess` guard matching the `/projects` sidebar item.

**RISK to confirm before merging to `main`:** Because `LumpSumList` / `LumpSumDetails` were already in `appRouteList.ts`, RBAC may have already granted access to those route names for some roles. Confirm with the team before deploying to production.

---

## Data Models (`Model.d.ts`)

All interfaces use PascalCase properties. No camelCase aliases (codebase convention). Dto types are wire-format (camelCase) for future `httpClient.post<T>()` calls.

### Core Domain Types

| Interface | Purpose |
|---|---|
| `LSWallet` | Budget container owned by a Program. `ComponentType` is always `'LS'`. |
| `ItemizedProject` | AIP project that draws from a wallet. Has `CurrentDrawAmount` (live) and `PublishedDrawAmount` (frozen at WF-8). |
| `FundingLine` | One funding line on an `ItemizedProject`. The one with `IsWalletLine: true` is the line that draws down Available. |
| `LSWalletBalance` | Computed result: `{ WalletId, Total, Used, Available }`. Mirrors the future `vLSWalletBalance` SQL view. |
| `ItemizedProjectRevision` | Revision record for a published project (WF-6). Status codes match the Modification module: `0=Pending, 1=Approved, 2=Disapproved, 3=ForReview`. |
| `WalletStage` | `'BP' | 'NEP' | 'HGAB' | 'GAA' | 'GAA-R'` |

### Dto Wire Types

| Interface | Purpose |
|---|---|
| `DtoCreateWallet` | WF-1 Create Wallet payload |
| `DtoReplenishWallet` | WF-3 Replenish payload — `newAmount` must exceed current `Amount` |
| `DtoCreateItemizedProject` | WF-4 Create Itemized Project payload |
| `DtoUpdateDrawAmount` | Pre-publish draw edit payload |
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
Total     = 12,000,000
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
| WF-1 Create Wallet | `CreateWalletDialog` | `createWallet()` | `walletMockStore.createWallet()` |
| WF-2 Stage Cascade | `AdvanceProgramStageDialog` | `advanceProgramStage()` | `walletMockStore.advanceProgramStage()` |
| WF-3 Replenish | `ReplenishWalletDialog` | `replenishWallet()` | `walletMockStore.replenishWallet()` |
| WF-4 Create Itemized Project | `CreateItemizedProjectDialog` | `createItemizedProject()` | `walletMockStore.addItemizedProject()` |
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
| `replenishWallet(payload)` | WF-3 — increases Amount; throws if `newAmount <= current` |
| `deleteWallet(walletId, updatedBy)` | WF-7 — returns `{ tier, wallet }` |
| `fetchItemizedProjectsByWalletId(walletId)` | All projects for a wallet |
| `validateWalletForItemization(walletId)` | WF-4 gate check — returns `{ valid, message? }` |
| `createItemizedProject(payload)` | WF-4 — creates project with auto-generated ID, syncs atom |
| `updateItemizedProjectDraw(payload)` | Pre-publish draw edit; throws on published project |
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
- Row actions: **View** (navigates to `/lumpsum/:walletId`) and **[Dev] Advance Stage** (opens `AdvanceProgramStageDialog`). Replenish / Add Itemized / Delete are intentionally not on the list row — they need the full itemized-project context for correct delete-tier resolution and live only on the Detail page.
- Columns: Wallet ID | Program Name | Category | Stage | Total / Available | Created | Actions.

### `LSWalletDetail.tsx`

Orchestrator page for all wallet-level and project-level operations. Key design decisions:

- **Reactive from the atom.** Wallet fields (`CurrentStage`, `Amount`, `HasStageData`) and project fields (`PublishStatus`, `CurrentDrawAmount`) are all read from `walletDataAtom`. Every mutation via `Service.ts` calls `syncAtom()`, so the UI stays consistent without explicit refetches.
- **Revisions are the sole exception** — they are not in the atom snapshot. On mount, `LSWalletDetail` fetches revision history for all published projects and stores the result in local state (`useState<Record<number, ItemizedProjectRevision[]>>`). Revision actions update this local state via `onSuccess` callbacks.
- **Form sections are reused in disabled mode.** `WalletDetailsSection`, `FundingProfileSection`, and `WalletComponentSection` accept an `onChange` prop and an `disabled` flag. In Detail view they render in read-only mode with a stable `noOp` callback.
- **Delete tier is pre-resolved.** Before opening either delete dialog, Detail calls `resolveWalletDeleteTier()` / `resolveProjectDeleteTier()` and passes the resolved tier as a required prop. The dialogs do not determine their own tier.

---

## Dialogs

| Dialog | Triggered from | Primary service call |
|---|---|---|
| `CreateWalletDialog` | List page "Add Wallet" | `Service.createWallet()` |
| `ReplenishWalletDialog` | Detail page action buttons | `Service.replenishWallet()` |
| `DeleteWalletDialog` | Detail page; requires `tier` prop | `Service.deleteWallet()` |
| `AdvanceProgramStageDialog` | List row "[Dev] Advance Stage" or Detail action | `Service.advanceProgramStage()` |
| `CreateItemizedProjectDialog` | Detail page "Add Itemized Project" | `Service.createItemizedProject()` |
| `EditDrawAmountDialog` | Per-project "Edit Draw Amount" (pre-publish only) | `Service.updateItemizedProjectDraw()` |
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

## Cross-Module Touch: `ComponentCostDialog.tsx`

`FE/src/pages/Project/dialogs/ComponentCostDialog.tsx` imports `WALLET_EXCLUSIVE_COMPONENT_TYPES` from `LSWallet/utils/constants.ts` and filters it from the component-type dropdown:

```ts
// In ComponentCostDialog.tsx
componentTypes?.filter(
  (type) => !WALLET_EXCLUSIVE_COMPONENT_TYPES.includes(type.ComponentId || '')
)
```

This ensures the `'LS'` component type (reserved for wallet component lines) cannot be selected on regular or itemized AIP projects. If the backend adds more wallet-exclusive types, adding them to `WALLET_EXCLUSIVE_COMPONENT_TYPES` in `constants.ts` is the only code change needed.

**Context:** The existing codebase already has an unrelated feature — `ProjectDetails.IslandCode === 'LS'` marks a legacy "Lump Sum project type" with its own "Itemized Lump Sum Import" dialog in `FE/src/pages/Project/`. The LSWallet module is distinct from that feature. The `WALLET_EXCLUSIVE_COMPONENT_TYPES` filter does not affect that feature.

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

### `EditDrawAmountDialog` addition

This dialog was not in the original plan's task list but was added during implementation. It handles pre-publish draw amount edits and guards against pushing Available negative. The "Edit Draw Amount" action had always been in `getItemizedProjectActions()` but lacked a dialog until this was built.

### `DeleteWalletDialog` and `DeleteItemizedProjectDialog` `tier` prop

The `tier` prop is required on both delete dialogs (not optional). The caller (`LSWalletDetail.tsx`) resolves the tier before opening the dialog. The dialog renders different messaging and button labels based on the received tier.

### `LSWalletList.tsx` row actions

Only "View" (navigate to detail) and "[Dev] Advance Stage" are on the list row. Replenish, Add Itemized Project, and Delete require the full itemized-project list to correctly resolve delete tiers, so they live exclusively on the Detail page.

### `HasStageData` field

Added during implementation (not in the original schema doc list). Drives hard vs. soft/blocked delete tier for both wallets and itemized projects. Starts `false` on creation; flips to `true` on first replenish or stage cascade for a wallet, or on first publish/stage event for a project.

---

## Seed Data

Wallet 1 (`Id: 1`) — `Asset Preservation Program 2024`, 12,000,000 at GAA stage. Has three seeded itemized projects:
- Project A (`LS-W001-P001`): Published, `PublishedDrawAmount = 3,500,000`.
- Project B (`LS-W001-P002`): Not published, `CurrentDrawAmount = 1,000,000`.
- Project C (`LS-W001-P003`): Soft-deleted — excluded from balance.

Wallet 2 (`Id: 2`) — `Infrastructure Build Fund 2024`, 5,000,000 at GAA-R. No itemized projects — available for WF-4 demos.

The seed represents the **after-replenish** state of the WF-5 worked scenario. The 10M → 12M replenish step is not replayed at seed time; the seed starts at 12M.
