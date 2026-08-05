# Plan: LS Wallet — Normalized Backend Schema (Header + Revision + Funding/Component Children)

Status: Implemented
Created: 2026-08-04
Source: In-session schema-design conversation with the user, working directly against a local SQL Server instance. User request: "we should definitely check or need to create those versions differently for lumpsum" (re: `tProjects`/`tProjectRevisions`/`tProjectFundingProfile`/`tProjectComponentCost`/`tProjectComponentCostPerYear`), confirmed via `AskUserQuestion` rounds to mean reversing `tLSWallets`' flat-by-design Phase-1 decision in favor of a header + revision-ready + funding/component-cost child-table structure mirroring the Project module.

## Goal

Normalize the LS Wallet backend schema so it matches what the frontend (`FE/src/pages/LSWallet/Model.d.ts`, implemented per `documents/plans/lswallet-project-uniformity.md`) has expected since 2026-07-13 — multi-line funding profile, multi-row component cost, and full Project-detail-parity fields — instead of the current flat, single-line `tLSWallets` design, while keeping the existing read API (`LumpsumController.cs`) and views working unchanged.

## Acceptance Criteria

As a backend developer implementing the LS Wallet write path, I want the database schema to already mirror the Project module's header/revision/funding/component-cost pattern, so that building `CreateWallet`/`ReplenishWallet` later is a straightforward port of the existing `AddProject` pattern instead of a second schema redesign.

- [ ] `dbo.tLSWallets` is trimmed to header-only fields: `Id`, `ProgramFK`, `MYId`, `ExternalId`, `CurrentStage`, `HasStageData`, `CreatedBy`, `CreatedDate`, `UpdatedBy`, `UpdatedDate`, `IsDeleted`.
- [ ] `dbo.tLSWalletRevisions` exists with `WalletFK` → `tLSWallets.Id` and carries all the "General Information"/Location/Org/Source/Readiness fields previously flat on `tLSWallets` (`CategoryId`, `SubCategoryFK`, `OperatingUnit`, `AlternateId`, `MYCAApprovalDate`, `Description`, `Region`, `Province`, `City`, `LegislativeDistrict`, `DEO`, `ImplementingOffice`, `Origin`, `Agency`, `ImplementationMode`, `EmergencyMode`, `RegionWide`, `Feasibility`, `FeasibilityDate`, `DetailedDesign`, `DetailedDesignDate`, `RowAvailable`, `Tier`, `Rank`, `UACS`), plus standard audit + `IsDeleted` columns, structured so multiple revision rows per wallet are legal even though only one active row is maintained today.
- [ ] `dbo.tLSWalletFundingProfile` exists, FK'd to `tLSWalletRevisions.Id`, columns mirroring `tProjectFundingProfile` minus `IsWalletDraw` (`SourceOrg`, `AgreementCode`, `Amount`, `Percentage` + audit/`IsDeleted`).
- [ ] `dbo.tLSWalletComponentCost` + `dbo.tLSWalletComponentCostPerYear` exist, FK'd to `tLSWalletRevisions.Id` / `tLSWalletComponentCost.Id` respectively, mirroring `tProjectComponentCost`/`tProjectComponentCostPerYear` column-for-column.
- [ ] `dbo.vLSWalletLatest` and `dbo.vLSWalletBalance` are rewritten to read through a `LatestRevision` CTE (same pattern as `vLSWalletProjectSet`'s existing `LatestRevision` CTE for Projects) with `Total`/`Amount` computed as `SUM(tLSWalletFundingProfile.Amount)` for the active revision — and both views' **output column names are unchanged** from today, verified column-for-column.
- [ ] `dbo.vLSWalletBalance`'s definition is checked into `Main/Resources/Internal/SQLScripts/` for the first time (it currently has no source file in the repo).
- [ ] `dbo.vLSWalletProjectSet` is confirmed untouched — it doesn't reference any `tLSWallets` detail column being moved.
- [ ] `Main/Resources/Internal/SQLScripts/LSWallet.Seed.Dev.sql` is rewritten to seed wallets through header + one revision + funding lines + component-cost rows, and reproduces the same `Total`/`Used`/`Available` numbers as the original 3-wallet (A/B/C) scenario.
- [ ] New EF entity classes exist under `DBHelper/Models/Table/Lumpsum/` for all 4 new tables; `LSWallets.cs` is trimmed to header fields and its class doc no longer describes the flat design as current (marked superseded).
- [ ] `MYPSDbContext.cs` registers the 4 new `DbSet<>`s in its existing `#region Lumpsum` block.
- [ ] `dotnet build` succeeds with zero errors after the EF model changes.
- [ ] `LumpsumController.cs`'s 5 read actions (`InitFilterLumpsum`, `ShowLumpsum`, `LumpsumDetails`, `WalletBalance`, `ShowItemizedProjects`) require **no code changes** and return the same response shapes against the migrated schema — confirmed by smoke-testing each.
- [ ] `FE/src/pages/LSWallet/LSWallet.md`'s backend-schema status note (currently "on hold pending ADR-021/025") is updated to reflect the new normalized schema.

## Approach

**Header / revision split, mirroring `tProjects` / `tProjectRevisions` exactly**, including which fields land where (Project keeps `MYId`/`ExternalId` on the header table, not the revision — the new wallet schema mirrors that split precisely).

`dbo.tLSWallets` (header, trimmed) keeps only identity/lifecycle fields — `Id`, `ProgramFK`, `MYId`, `ExternalId`, `CurrentStage`, `HasStageData`, audit columns, `IsDeleted`. Everything else (category/thrust/operating unit, all "General Information", Location, Organizational Responsibilities, Project Source, Implementation Readiness/Modality fields) moves to the new `dbo.tLSWalletRevisions` table. `Amount` is dropped entirely from the header and becomes a derived value — `SUM(tLSWalletFundingProfile.Amount)` for the wallet's active revision — matching the invariant the FE has already documented (`LSWallet.Model.d.ts`'s `Amount` comment: "always the SUM... do NOT set directly"). `ComponentType` is dropped from the header too; it becomes a per-row column on the new component-cost table, always `'LS'`, exactly like `tProjectComponentCost.ComponentType`.

`dbo.tLSWalletRevisions` is FK'd from the child tables (`tLSWalletFundingProfile.WalletRevisionFK`, `tLSWalletComponentCost.WalletRevisionFK`) rather than from `tLSWallets` directly — mirroring `tProjectFundingProfile.ProjectRevisionFK`/`tProjectComponentCost.ProjectRevisionFK`. This is the "revision-ready" structure the user asked for: schema-wise it supports multiple revisions per wallet with zero future migration, but no revisioning workflow, approval UI, or multi-version logic is being built now — the application only ever creates/maintains exactly one non-deleted revision row per wallet, the same "latest non-deleted revision" pattern already used for Projects via the `LatestRevision` CTE in `vLSWalletProjectSet`.

`dbo.tLSWalletFundingProfile` and `dbo.tLSWalletComponentCost`/`tLSWalletComponentCostPerYear` are new child tables mirroring their Project-side counterparts column-for-column (see Acceptance Criteria for exact column lists), enabling the multi-line funding profile and multi-row component cost breakdown the FE has expected since the `lswallet-project-uniformity` plan shipped.

**Views**: `vLSWalletLatest` and `vLSWalletBalance` are rewritten to join through a `LatestRevision` CTE exactly like `vLSWalletProjectSet` already does, with `Total` now summed from the funding-profile child table instead of read as a scalar column. Output column names must stay identical to today's so `LumpsumController.cs` and its EF read models (`LSWalletLatest.cs`, `LSWalletBalance.cs`) require no changes — this is the hard constraint that keeps the migration read-path-safe. `vLSWalletBalance` currently has no source file anywhere in the repo (confirmed via full-repo grep) — it only exists as an undocumented live DB object from an earlier schema session; this plan checks it into `Main/Resources/Internal/SQLScripts/` for the first time. `vLSWalletProjectSet` is untouched — it reads `tProjects`/`tProjectRevisions`/`tProjectFundingProfile`, not any `tLSWallets` detail column being moved.

**Dev DB reset, not data migration**: this is dev-only, unseeded-in-production data (`LSWallet.Seed.Dev.sql` is explicitly dev/local-only), and the local DB used for this session doesn't even have the old flat "General Information" columns applied (confirmed live: `tLSWallets` has exactly 19 base columns; `LSWallet.Schema.sql`, which would add 24 more, was never run here). Rather than writing conditional backfill logic for columns that may or may not exist depending on environment, the new schema script drops and recreates `tLSWallets` alongside creating the 4 new tables, and `LSWallet.Seed.Dev.sql` is rewritten to seed through the new structure. Any existing wallet rows on a shared/team dev DB would need re-seeding via the rewritten script, not preserving — flagged as a risk below.

**No write-side backend exists today** (`WebAPI/Controllers/Lumpsum/LumpsumController.cs` is confirmed Phase-1 read-only — no `CreateWallet`/`ReplenishWallet` action, no `LumpsumService.cs`, no `SaveChangesAsync` against `tLSWallets` anywhere in the backend; wallet creation today is FE-mock-only). This significantly de-risks the migration — there is no existing write path to break, only the read path. Building the write path (mirroring `ProjectController.AddProject`'s pattern: explicit-transaction, sequential EF `SaveChangesAsync` — `tLSWallets` → `tLSWalletRevisions` → funding/component-cost tables populated in a later save step, matching how Project itself defers `tProjectFundingProfile`/`tProjectComponentCost` population past initial creation) is **explicitly out of scope** for this plan, per the user's "make it ready but don't extend more work" decision.

## Tasks

### Implementation
- Write a new idempotent SQL script (`Main/Resources/Internal/SQLScripts/LSWallet.Revisions.Schema.sql` or similar) that: drops/recreates `dbo.tLSWallets` to the trimmed header shape; creates `dbo.tLSWalletRevisions`, `dbo.tLSWalletFundingProfile`, `dbo.tLSWalletComponentCost`, `dbo.tLSWalletComponentCostPerYear` with the FKs described in Approach; includes a header comment marking `LSWallet.Schema.sql`'s flat-column approach as superseded (following the supersession-note convention already used in `documents/plans/lump-sum-wallet.md`)
- Rewrite `vLSWalletLatest` in `Main/Resources/Internal/SQLScripts/LSWallet.sql` using the `LatestRevision` CTE pattern; add a `CREATE VIEW dbo.vLSWalletBalance` statement to the same file (first time it's version-controlled), both with `Total` derived via `SUM(tLSWalletFundingProfile.Amount)`; verify output columns match today's shape exactly (cross-check against `DBHelper/Models/Views/Lumpsum/LSWalletLatest.cs` and `LSWalletBalance.cs` property lists)
- Rewrite `LSWallet.Seed.Dev.sql` to seed the 3-wallet (A/B/C) scenario through header + one revision + funding lines + component-cost rows, reproducing the original `Total`/`Used`/`Available` numbers
- Run the new schema script, updated `LSWallet.sql`, and rewritten seed script against the local dev DB (`127.0.0.1`, `myps_db`) via `sqlcmd`; verify `vLSWalletLatest`/`vLSWalletBalance` return the expected seeded values
- Add `DBHelper/Models/Table/Lumpsum/{LSWalletRevisions,LSWalletFundingProfile,LSWalletComponentCost,LSWalletComponentCostPerYear}.cs`; trim `LSWallets.cs` to header fields and rewrite its class doc to mark the flat design as superseded
- Register the 4 new `DbSet<>`s in `DBHelper/Data/MYPSDbContext.cs`'s `#region Lumpsum` block (~line 235-247)
- `dotnet build` the solution; fix any compile errors from the model trim
- Smoke-test `LumpsumController.cs`'s 5 read actions against the migrated local DB (via the FE dev server or a REST client) and confirm response shapes are unchanged

### Documentation
- Update `FE/src/pages/LSWallet/LSWallet.md`'s backend-schema status note to describe the new normalized schema instead of "on hold pending ADR-021/025"

## Files / Components Touched

**New**: `Main/Resources/Internal/SQLScripts/LSWallet.Revisions.Schema.sql` (name TBD), `DBHelper/Models/Table/Lumpsum/{LSWalletRevisions,LSWalletFundingProfile,LSWalletComponentCost,LSWalletComponentCostPerYear}.cs`

**Modified**: `Main/Resources/Internal/SQLScripts/LSWallet.sql` (rewrite `vLSWalletLatest`, add `vLSWalletBalance`), `Main/Resources/Internal/SQLScripts/LSWallet.Seed.Dev.sql`, `DBHelper/Models/Table/Lumpsum/LSWallets.cs` (trim to header), `DBHelper/Data/MYPSDbContext.cs` (register 4 new `DbSet<>`s), `FE/src/pages/LSWallet/LSWallet.md`

**Superseded (left in place, marked in comments, not deleted)**: `Main/Resources/Internal/SQLScripts/LSWallet.Schema.sql`

**Verify only, no expected changes**: `WebAPI/Controllers/Lumpsum/LumpsumController.cs`, `WebAPI/Controllers/Lumpsum/DTOLumpsum.cs`, `DBHelper/Models/Views/Lumpsum/{LSWalletLatest,LSWalletBalance,LSWalletProjectSet}.cs`

## Risks / Open Questions / Assumptions

- **Dev DB reset, not migration**: dropping/recreating `tLSWallets` loses any existing rows on whichever DB the script runs against. Acceptable for the local dev instance used in this session (confirmed empty of the extended columns) and for the seed-only team dev DB, but re-confirm before running against any DB that might hold real data.
- **View column parity is a hard constraint, unverified until implementation**: `LumpsumController.cs` and its 3 EF read models assume exact column names from `vLSWalletLatest`/`vLSWalletBalance` today. The rewritten views must reproduce those names exactly, or the controller (and FE consuming it) breaks silently. Must be checked column-by-column during implementation, not assumed.
- **No source-of-truth docs exist**: `ADR-021`, `ADR-025`, `ls-wallet-schema.md`, `lumpsum-wallet-workflow.md`, `lumpsum-wallet-process-flow.md` are referenced by name in multiple planning docs but do not exist anywhere in the repo (confirmed via full-repo search). This plan's schema design is now the source of truth going forward — if those docs surface later with conflicting decisions, reconcile explicitly rather than assuming this plan is wrong.
- **Write-side backend is out of scope**: this plan only lands schema + read-path updates. `CreateWallet`/`ReplenishWallet`/etc. backend endpoints do not exist yet and are a separate future plan — noted so nobody assumes WF-1/WF-3 are backend-functional after this lands.
- **`tLSWalletRevisions` "one active row" assumption**: nothing in the schema enforces exactly one non-deleted revision per wallet (by design — it's meant to support more later). Until a real write path exists, this is not exercised, but the first write-side implementation must respect it (insert-once/update-in-place) or the `LatestRevision` CTE pattern in the views could silently pick an unintended "latest" row.

## Verification

- `sqlcmd` against the local dev DB: confirm `tLSWallets`, `tLSWalletRevisions`, `tLSWalletFundingProfile`, `tLSWalletComponentCost`, `tLSWalletComponentCostPerYear` all exist with the designed columns/FKs.
- Re-run `LSWallet.Seed.Dev.sql`, then query `vLSWalletLatest` and `vLSWalletBalance` directly — confirm `Total`/`Used`/`Available` match the same numbers the old flat-schema seed produced (the 3-wallet A/B/C scenario).
- `dotnet build` on `DBHelper`/`WebAPI` — zero errors.
- Hit `LumpsumController`'s `ShowLumpsum`, `LumpsumDetails`, `WalletBalance`, `ShowItemizedProjects` (via the FE dev server or a REST client) against the migrated local DB — confirm response shapes are unchanged from before the migration.

## Completion Log

Date: 2026-08-04

**Implementation:**
- `Main/Resources/Internal/SQLScripts/LSWallet.Revisions.Schema.sql` (new) — drops/recreates `dbo.tLSWallets` as a trimmed header table; creates `dbo.tLSWalletRevisions`, `dbo.tLSWalletFundingProfile`, `dbo.tLSWalletComponentCost`, `dbo.tLSWalletComponentCostPerYear` with the FK chain described in Approach; also carries forward the `CK_tProjects_ProjectType` 'NP' addition from the old schema script (see Deviations).
- `Main/Resources/Internal/SQLScripts/LSWallet.sql` — `vLSWalletLatest` rewritten to read wallet detail from a `LatestWalletRevision` CTE instead of flat `tLSWallets` columns; `vLSWalletBalance` added (checked into the repo for the first time), `Total` now `SUM(tLSWalletFundingProfile.Amount)` for the active revision. `vLSWalletProjectSet` left untouched as planned.
- `Main/Resources/Internal/SQLScripts/LSWallet.Schema.sql` — marked superseded in its header comment (kept for history, not deleted).
- `Main/Resources/Internal/SQLScripts/LSWallet.Seed.Dev.sql` — rewritten to seed all 3 wallets (A/B/C) through header + revision + funding line(s) + component-cost/per-year rows instead of flat columns.
- Ran all three scripts against the local dev DB (127.0.0.1) via `sqlcmd`. Verified `vLSWalletLatest`/`vLSWalletBalance` reproduce the original scenario exactly: Wallet A Used 70,000,000/Available 30,000,000/ProjectCount 2; Wallet B Used 102,000,000/Available 98,000,000/ProjectCount 2; Wallet C Used 0/Available 50,000,000/ProjectCount 0; all balance deltas 0; leakage check clean (AIP/MY/NP amounts correctly excluded).
- Added `DBHelper/Models/Table/Lumpsum/{LSWalletRevisions,LSWalletFundingProfile,LSWalletComponentCost,LSWalletComponentCostPerYear}.cs`; trimmed `LSWallets.cs` to header fields with an updated class doc marking the flat design superseded.
- Registered the 4 new `DbSet<>`s in `MYPSDbContext.cs`'s `#region Lumpsum` block, plus a fluent `HasMany(CostsPerYear).WithOne(ComponentCost).OnDelete(Restrict)` config mirroring the existing Project-side pattern.
- `dotnet build` on the full solution: 0 errors.
- Smoke-tested the read path with a throwaway EF Core console harness (referencing `DBHelper` directly, not the full `Main` host) querying `tLSWallets`, `tLSWalletRevisions`, `tLSWalletFundingProfile`, `tLSWalletComponentCost` (with its `CostsPerYear` nav property), `vLSWalletLatest`, and `vLSWalletBalance` against the migrated local DB — all returned correct data matching the seed scenario. This exercises the same query shapes `LumpsumController.cs` uses internally.

**Documentation:** Updated `FE/src/pages/LSWallet/LSWallet.md`'s backend-schema status note — no longer "on hold pending ADR-021/025"; documents the new header/revision/funding/component-cost table shapes and that the write path (`CreateWallet`/`ReplenishWallet`) still doesn't exist.

**Deviations / flags:**
- The Acceptance Criteria said `LumpsumController.cs`'s read actions would need "no code changes." That held for the controller itself, but the smoke test caught that `DBHelper/Models/Views/Lumpsum/LSWalletLatest.cs` (the EF read-model for `vLSWalletLatest`) still declared the old flat properties (`Amount`, `FundingSource`, `FundingAgreement`, `FundingPercentage`, `ComponentYear`, `ComponentUACS`, `ComponentStartDate`, `ComponentEndDate`, `ComponentType`) that no longer exist as columns on the rewritten view — EF's `SELECT` failed with "Invalid column name" until those 9 stale properties were removed. Fixed as part of this implementation; flagged here since the plan didn't anticipate it.
- `LSWallet.Schema.sql` section 1 (the `CK_tProjects_ProjectType` 'NP' constraint addition) turned out to be an independent, still-needed migration unrelated to the flat-vs-normalized wallet question — discovered when the seed script's `MY` project-type update failed the check constraint. Carried forward into `LSWallet.Revisions.Schema.sql` section 0a rather than left orphaned in the fully-superseded old file.
- An early attempt to smoke-test via the full `Main` host (per the plan's suggested "FE dev server or REST client") was aborted after Hangfire's startup auto-installed its own `HangFire`-schema tables (`Job`, `State`, `Server`, etc., 11 objects) into the local dev DB as a side effect of pointing its connection string at it. Switched to the lighter EF-only console harness instead, which exercises the identical query shapes without booting Hangfire/auth/the rest of the host. The `HangFire` schema objects were not removed — flagged for the user to drop if unwanted, since they're outside this plan's scope.
- Write-side backend (`CreateWallet`/`ReplenishWallet`) remains out of scope, as planned — confirmed still absent anywhere in the codebase.

**Files changed:**
- New: `Main/Resources/Internal/SQLScripts/LSWallet.Revisions.Schema.sql`, `DBHelper/Models/Table/Lumpsum/{LSWalletRevisions,LSWalletFundingProfile,LSWalletComponentCost,LSWalletComponentCostPerYear}.cs`, `documents/plans/lswallet-backend-schema-normalization.md`
- Modified: `Main/Resources/Internal/SQLScripts/LSWallet.sql`, `Main/Resources/Internal/SQLScripts/LSWallet.Seed.Dev.sql`, `Main/Resources/Internal/SQLScripts/LSWallet.Schema.sql` (superseded-notice header only), `DBHelper/Models/Table/Lumpsum/LSWallets.cs`, `DBHelper/Models/Views/Lumpsum/LSWalletLatest.cs`, `DBHelper/Data/MYPSDbContext.cs`, `FE/src/pages/LSWallet/LSWallet.md`
