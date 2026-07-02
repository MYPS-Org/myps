# Plan: Lump Sum Wallet

Status: Ready for implementation
Created: 2026-07-01
Source: User description — Lump Sum project acting as a budget wallet for multiple connected publishable projects, with automatic reconciliation when connected project amounts change.

---

## Context

Currently, Lump Sum projects (`IslandCode = "LS"`) exist in MYPS but have no relationship to other projects. They are simply regular projects with relaxed location validation and a special import path. This feature introduces a **wallet/budget container** concept on top of the existing LS project type: the LS project becomes the wallet owner, and other regular projects are connected to it, drawing from its total budget. The wallet itself must never publish to PCMA; only connected projects do. When a connected project's funding profile is revised post-publish, the wallet automatically reconciles without triggering a DCR on the wallet.

---

## Goal

Turn any Lump Sum project (`IslandCode = "LS"`) into a **budget wallet** that holds a total budget (derived from its own funding profile) and tracks consumption by connected projects. Connected projects can be published to PCMA independently. When a connected project's total funding profile changes via revision, the wallet's available balance reflects the delta automatically on next load — no DCR, no manual wallet update.

---

## Acceptance Criteria

As a MYPS user, I want to designate a Lump Sum project as a wallet and connect regular projects to it, so that I can track how much of the lump sum budget is consumed and ensure no over-allocation occurs.

- [ ] AC-1: A wallet can be created from any LS project; API stores a `LumpSumWallets` record linked to the LS project (1:1 — unique constraint on `LumpSumProjectId`).
- [ ] AC-2: Wallet detail API returns `TotalBudget`, `Consumed`, `Available` where `Available = TotalBudget - Consumed`. Budget = SUM of LS project's `ProjectFundingProfile.Amount` at current stage. Consumed = SUM of all connected projects' `ProjectFundingProfile.Amount` at current stage (all sources).
- [ ] AC-3: A regular project can be connected to a wallet **only when the program is at GAA-R stage**; attempting outside this stage returns 400.
- [ ] AC-4: A project already connected to another wallet is rejected (400) on connection attempt.
- [ ] AC-5: Connecting a project that would push `Consumed > TotalBudget` returns 400 with a descriptive over-allocation message.
- [ ] AC-6: The Lump Sum project's `IsPublishable` is always `false`; the `ValidateProjectForPublish` / `ValidateProjectForPublishv2` guards enforce this unconditionally via `IslandCode == "LS"` check.
- [ ] AC-7: Connected projects retain their own `IsPublishable` logic and can be published to PCMA independently.
- [ ] AC-8: After a connected project's revision approval updates its funding profile, the wallet's next API load reflects the new consumed/available figures — no manual wallet action required.
- [ ] AC-9: Disconnecting a project removes it from `LumpSumWalletProjects`; balance recalculates on next load.
- [ ] AC-10: Wallet list UI shows all wallets with budget summary. Wallet detail shows connected projects with their allocated amounts.
- [ ] AC-11: The `/lumpsum` sidebar route is active and permission-guarded.

---

## Approach

### Data Model

Two new dedicated tables (not reusing `ProjectGroups` to avoid polluting the group concept):

**`LumpSumWallets`**
- `Id` (int PK)
- `WalletId` (string, unique, generated via `GenerateCode()` helper at `Helpers/Functions.cs:259`, prefix `LSW-`)
- `LumpSumProjectId` (string FK → `Projects.ReferenceId`, unique constraint — 1:1)
- `Name` (MaxLength 200)
- `Description` (MaxLength 500, nullable)
- `CreatedBy`, `CreatedDate`, `IsDeleted`

**`LumpSumWalletProjects`**
- `Id` (int PK)
- `WalletId` (string FK → `LumpSumWallets.WalletId`)
- `ConnectedProjectId` (string FK → `Projects.ReferenceId`, unique constraint — one project per wallet max)
- `CreatedBy`, `CreatedDate`

### Budget Computation (on-demand, no materialized cache needed)

```
TotalBudget  = SUM(ProjectFundingProfile.Amount)
               WHERE ProjectId = walletProject.ReferenceId
               AND IsDeleted = false
               AND Stage = currentStage (joined via vProjectLatestStage)

Consumed     = SUM(ProjectFundingProfile.Amount)
               WHERE ProjectId IN connectedProjectIds
               AND IsDeleted = false
               AND Stage = currentStage

Available    = TotalBudget - Consumed
```

### IsPublishable Guard

In `Helpers/Functions.cs:910` (`ValidateProjectForPublish`) and `line ~934` (`ValidateProjectForPublishv2`), add as the **first check**:

```csharp
if (pr.IslandCode == "LS") return false;
```

This ensures no LS project can ever become publishable regardless of data completeness.

### No-DCR Wallet Reconciliation

The wallet is **never submitted to PCMA** (`IsPublishable = false`). When a connected project revision updates its funding profile rows, the wallet's `Consumed` / `Available` values are automatically correct on the next API read. There is no wallet-side state to write, no DCR to generate. This is intentionally passive by design.

### GAA-R Stage Gate

`ConnectProject` endpoint in `LumpSumWalletController` will call the existing stage-checking pattern (cf. `PCMAController.PublishProgram`) to validate the program is at GAA-R stage before allowing a project to be connected.

---

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)

- **S1 — DB models + DbContext registration**: Create `DBHelper/Models/Table/LumpSumWallets.cs` and `LumpSumWalletProjects.cs`. Register both `DbSet`s in `DBHelper/Data/MYPSDbContext.cs`.

- **S2 — IsPublishable LS guard**: In `Helpers/Functions.cs`, add `if (pr.IslandCode == "LS") return false;` as the first line of `ValidateProjectForPublish` (line 910) and `ValidateProjectForPublishv2` (line ~934). Verify and patch the `IsPublishable` assignment in `WebAPI/Controllers/Programs/ProgramController.cs` (~line 907) if needed.

- **S3 — LumpSumWalletController + DTOs**: Create `WebAPI/Controllers/LumpSumWallet/LumpSumWalletController.cs` and `DTOLumpSumWallet.cs`. Six endpoints: `CreateWallet`, `GetWallets` (paginated + budget summary), `GetWalletDetail`, `ConnectProject` (GAA-R gate + over-allocation guard + duplicate-wallet guard), `DisconnectProject`, `DeleteWallet` (blocked if any connected project `IsPublished = true`). Budget formula joins `vProjectLatestStage` to scope `ProjectFundingProfile` sums to current stage.

- **S4 — RevisionController audit note**: In `WebAPI/Controllers/Revision/RevisionController.cs`, after the block that writes approved funding profile changes, add a `TransactionLog` entry noting the wallet auto-reconciliation (no DCR generated for the wallet). This makes the no-DCR decision explicit and auditable.

### Junior (precise, scoped — delegate to junior-engineer)

- **J1 — TS model types**: Create `FE/src/pages/LumpSumWallet/Model.d.ts` with interfaces: `LumpSumWallet`, `LumpSumWalletProject`, `WalletDetailResponse`, `WalletListResponse`, `CreateWalletModel`, `ConnectProjectModel`.

- **J2 — Service.ts**: Create `FE/src/pages/LumpSumWallet/Service.ts`. Functions: `fetchWallets`, `createWallet`, `getWalletDetail`, `connectProject`, `disconnectProject`, `deleteWallet`. Follow `httpClient.post` pattern from `FE/src/pages/ProjectGroups/Service.ts`. No try/catch toast duplication (interceptor handles it).

- **J3 — Wallet list page**: Create `FE/src/pages/LumpSumWallet/Views/LumpSumWalletList.tsx`. Paginated table: Wallet Name, LS Project ID, Total Budget, Consumed, Available (color-coded: green >20% remaining, yellow 10–20%, red <10%). Create Wallet button. Row click navigates to detail. Use `ProjectGroups` list view as structural template.

- **J4 — Wallet detail page**: Create `FE/src/pages/LumpSumWallet/Views/LumpSumWalletDetail.tsx`. Header with budget summary bar. Table of connected projects: Project ID, Description, Allocated Amount, Disconnect button. Connect Project button. Use `ProjectGroupDetails.tsx` as structural template.

- **J5 — Dialogs**: Create `FE/src/pages/LumpSumWallet/dialogs/CreateWalletDialog.tsx` (Name maxLength 200, Description maxLength 500, LS Project ID search) and `ConnectProjectDialog.tsx` (Project ID input, search, preview amount, over-allocation warning before submit, confirm). Export from `dialogs/index.ts`. Follow Headless UI Dialog + `useToast()` pattern from `FE/src/components/toaster/ToasterContext.tsx`.

- **J6 — Routes + sidebar**: In `FE/src/utils/appRouteList.ts` add `/lumpsum` (list) and `/lumpsum/:walletId` (detail) routes. In `FE/src/layouts/AppSidebar.tsx` uncomment the lumpsum `SidebarItem` (lines 113–116) and wrap with the ViewAccess permission guard matching the pattern of other sidebar items.

### Documentation (tech-writer)

- **D1**: Document the Lump Sum Wallet data model, all six API endpoint contracts (request/response shapes), the budget computation formula (stage-scoped FundingProfile sum), the over-allocation rule, the GAA-R stage gate, and the no-DCR reconciliation design rationale in the UserManual or an API reference doc.

---

## Files / Components Touched

**Create:**
- `DBHelper/Models/Table/LumpSumWallets.cs`
- `DBHelper/Models/Table/LumpSumWalletProjects.cs`
- `WebAPI/Controllers/LumpSumWallet/LumpSumWalletController.cs`
- `WebAPI/Controllers/LumpSumWallet/DTOLumpSumWallet.cs`
- `FE/src/pages/LumpSumWallet/Model.d.ts`
- `FE/src/pages/LumpSumWallet/Service.ts`
- `FE/src/pages/LumpSumWallet/Views/LumpSumWalletList.tsx`
- `FE/src/pages/LumpSumWallet/Views/LumpSumWalletDetail.tsx`
- `FE/src/pages/LumpSumWallet/dialogs/CreateWalletDialog.tsx`
- `FE/src/pages/LumpSumWallet/dialogs/ConnectProjectDialog.tsx`
- `FE/src/pages/LumpSumWallet/dialogs/index.ts`

**Modify:**
- `DBHelper/Data/MYPSDbContext.cs` — two new DbSet entries
- `Helpers/Functions.cs` — LS guard in `ValidateProjectForPublish` (line 910) + `ValidateProjectForPublishv2` (line ~934)
- `WebAPI/Controllers/Programs/ProgramController.cs` — verify/patch `IsPublishable` assignment (~line 907)
- `WebAPI/Controllers/Revision/RevisionController.cs` — reconciliation audit log entry
- `FE/src/utils/appRouteList.ts` — add lumpsum routes
- `FE/src/layouts/AppSidebar.tsx` — uncomment + permission-guard lumpsum sidebar item (lines 113–116)

---

## Risks / Open Questions / Assumptions

**Risks:**
1. **Stage-scoped FundingProfile sum**: Must join `vProjectLatestStage` before summing `ProjectFundingProfile.Amount`; without this, rows from superseded stages are double-counted. This is the primary correctness risk in S3.
2. **EF migration coordination**: Two new tables require a migration that must be reviewed by DBA before production deploy.

**Assumptions:**
- 1:1 LS project → wallet (unique constraint on `LumpSumProjectId`). Confirmed by user.
- Consumption basis = total funding profile across all sources at current stage. Confirmed by user.
- Projects can only be connected to a wallet at GAA-R stage.
- Wallet deletion is blocked if any connected project has `IsPublished = true`.
- Wallet membership and ProjectGroup membership are independent (a project can be in both).
- `GenerateCode()` helper (`Helpers/Functions.cs:259`) is reusable for generating `LSW-` wallet IDs.
- `IslandCode = "LS"` remains the sole discriminator for LS projects (no additional DB flag needed).
