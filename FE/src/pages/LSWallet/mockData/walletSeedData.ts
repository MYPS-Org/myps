// =============================================================================
// Seed data for the LSWallet module.
// Reproduces the WF-5 worked scenario from the plan:
//   Wallet 1 — 10M → replenished to 12M → itemize 3.5M (published, frozen)
//                                        → itemize 1M (unpublished, live)
//                                        → soft-deleted project (excluded from Used)
//   Wallet 2 — 5M at GAA-R, Available > 0 (for WF-4 itemize demo)
//
// DESIGN CHOICE: Wallet 1 is seeded already at 12,000,000 (post-replenish state)
// so the demo immediately shows a realistic balance. The WF-3 replenish step
// (10M → 12M) is NOT replayed at seed time — the seed represents the "after
// replenish" snapshot. A comment marks where the original amount was 10M.
// This makes the balance widget show correct numbers without any setup steps.
//
// For Program references, two stub records are defined here since no existing
// Program mock/lookup data is reusable in-module (Program/Service.ts calls the
// real API). Reuse these IDs if you need to reference a Program from the UI.
// =============================================================================

import type { LSWallet, ItemizedProject, FundingLine } from '../Model.d';

// ---------------------------------------------------------------------------
// Program stubs referenced by wallets below
// ---------------------------------------------------------------------------
export const SEED_PROGRAMS = [
  {
    ProgramId: 'P_CO-APP-2024',
    ProgramName: 'Asset Preservation Program 2024',
    CurrentStage: 'GAA' as const,
  },
  {
    ProgramId: 'P_CO-IBF-2024',
    ProgramName: 'Infrastructure Build Fund 2024',
    CurrentStage: 'GAA-R' as const,
  },
];

// ---------------------------------------------------------------------------
// Seed wallets
// ---------------------------------------------------------------------------

/** Wallet 1 — post-replenish state (was 10,000,000; now 12,000,000 at GAA) */
export const SEED_WALLET_1: LSWallet = {
  Id: 1,
  ProgramId: 'P_CO-APP-2024',
  ProgramName: 'Asset Preservation Program 2024',
  CategoryId: 1,
  CategoryName: 'OO1: Ensure Safe and Reliable National Road System',
  SubCategoryId: 101,
  SubCategoryName: 'Rehabilitation/Reconstruction/Upgrading of Damaged Paved Roads',
  OperatingUnit: 'CO-PS',
  FundingSource: 'General Appropriations Act',
  FundingAgreement: 'GAA-2024-APP-001',
  Amount: 12_000_000,   // Originally 10M; replenished to 12M (see WF-3 scenario)
  FundingPercentage: 100,
  CurrentStage: 'GAA',
  HasStageData: true, // Already replenished once (10M -> 12M) — has history, not brand new
  ComponentType: 'LS',
  ComponentYear: 2024,
  ComponentAmount: 12_000_000,
  ComponentTotal: 12_000_000,
  ComponentUACS: '101101100001000',
  ComponentStartDate: '2024-01-01',
  ComponentEndDate: '2024-12-31',
  CreatedBy: 'admin',
  CreatedDate: '2024-01-15T08:00:00.000Z',
  IsDeleted: false,
};

/** Wallet 2 — at GAA-R with Available > 0 (ready for WF-4 itemization) */
export const SEED_WALLET_2: LSWallet = {
  Id: 2,
  ProgramId: 'P_CO-IBF-2024',
  ProgramName: 'Infrastructure Build Fund 2024',
  CategoryId: 2,
  CategoryName: 'OO2: Ensure Safe and Reliable National Bridge System',
  SubCategoryId: 201,
  SubCategoryName: 'Bridge Replacement/Rehabilitation Program',
  OperatingUnit: 'CO-BRS',
  FundingSource: 'General Appropriations Act',
  FundingAgreement: 'GAA-2024-IBF-002',
  Amount: 5_000_000,
  FundingPercentage: 100,
  CurrentStage: 'GAA-R',
  HasStageData: true, // Already cascaded through stages to reach GAA-R — has history
  ComponentType: 'LS',
  ComponentYear: 2024,
  ComponentAmount: 5_000_000,
  ComponentTotal: 5_000_000,
  ComponentUACS: '101101100002000',
  ComponentStartDate: '2024-03-01',
  ComponentEndDate: '2024-12-31',
  CreatedBy: 'admin',
  CreatedDate: '2024-03-01T08:00:00.000Z',
  IsDeleted: false,
};

// ---------------------------------------------------------------------------
// Seed itemized projects for Wallet 1 (WF-5 scenario)
// ---------------------------------------------------------------------------

const walletLine1: FundingLine = {
  Id: 10,
  Source: 'General Appropriations Act',
  Agreement: 'GAA-2024-APP-001',
  Amount: 3_500_000,
  Percentage: 100,
  IsWalletLine: true,
};

/** Project A — PUBLISHED. PublishedDrawAmount is frozen at 3,500,000 */
export const SEED_PROJECT_A: ItemizedProject = {
  Id: 101,
  ProjectId: 'LS-W001-P001',
  ParentWalletId: 1,
  ProjectType: 'LS',
  CategoryId: 1,
  SubCategoryId: 101,
  OperatingUnit: 'CO-PS',
  ProgramId: 'P_CO-APP-2024',
  FundingLines: [{ ...walletLine1 }],
  ComponentCosts: [],
  CurrentDrawAmount: 3_500_000,
  PublishedDrawAmount: 3_500_000,  // Frozen snapshot captured at WF-8 publish
  PublishStatus: 'Published',
  ProjectStatus: 'Ongoing',
  HasStageData: true,
  IsDeleted: false,
  IsCancelled: false,
  CreatedDate: '2024-02-01T08:00:00.000Z',
};

const walletLine2: FundingLine = {
  Id: 11,
  Source: 'General Appropriations Act',
  Agreement: 'GAA-2024-APP-001',
  Amount: 1_000_000,
  Percentage: 100,
  IsWalletLine: true,
};

/** Project B — NOT PUBLISHED. CurrentDrawAmount = 1,000,000 (live, affects Available) */
export const SEED_PROJECT_B: ItemizedProject = {
  Id: 102,
  ProjectId: 'LS-W001-P002',
  ParentWalletId: 1,
  ProjectType: 'LS',
  CategoryId: 1,
  SubCategoryId: 101,
  OperatingUnit: 'CO-PS',
  ProgramId: 'P_CO-APP-2024',
  FundingLines: [{ ...walletLine2 }],
  ComponentCosts: [],
  CurrentDrawAmount: 1_000_000,
  PublishedDrawAmount: null,       // Not yet published
  PublishStatus: 'NotPublished',
  ProjectStatus: 'NotYetStarted',
  HasStageData: false,
  IsDeleted: false,
  IsCancelled: false,
  CreatedDate: '2024-02-15T08:00:00.000Z',
};

const walletLine3: FundingLine = {
  Id: 12,
  Source: 'General Appropriations Act',
  Agreement: 'GAA-2024-APP-001',
  Amount: 2_000_000,
  Percentage: 100,
  IsWalletLine: true,
};

/**
 * Project C — SOFT DELETED (IsDeleted: true).
 * Excluded from Used/Available calculation to demonstrate the balance
 * formula correctly ignores deleted projects.
 */
export const SEED_PROJECT_C: ItemizedProject = {
  Id: 103,
  ProjectId: 'LS-W001-P003',
  ParentWalletId: 1,
  ProjectType: 'LS',
  CategoryId: 1,
  SubCategoryId: 101,
  OperatingUnit: 'CO-PS',
  ProgramId: 'P_CO-APP-2024',
  FundingLines: [{ ...walletLine3 }],
  ComponentCosts: [],
  CurrentDrawAmount: 2_000_000,
  PublishedDrawAmount: null,
  PublishStatus: 'NotPublished',
  ProjectStatus: 'NotYetStarted',
  HasStageData: false,
  IsDeleted: true,    // Soft-deleted — excluded from balance sums
  IsCancelled: false,
  CreatedDate: '2024-01-20T08:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Expected balance for Wallet 1 at seed state (for manual verification):
//   Total     = 12,000,000
//   Used      = PublishedDrawAmount(A)=3,500,000 + CurrentDrawAmount(B)=1,000,000
//             = 4,500,000  (Project C excluded because IsDeleted=true)
//   Available = 12,000,000 - 4,500,000 = 7,500,000
// ---------------------------------------------------------------------------

// Initial arrays exported for use by walletMockStore.ts
export const SEED_WALLETS: LSWallet[] = [SEED_WALLET_1, SEED_WALLET_2];

export const SEED_ITEMIZED_PROJECTS: ItemizedProject[] = [
  SEED_PROJECT_A,
  SEED_PROJECT_B,
  SEED_PROJECT_C,
];
