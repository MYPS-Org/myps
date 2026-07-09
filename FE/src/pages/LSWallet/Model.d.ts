// =============================================================================
// LSWallet Module — TypeScript interfaces
// All properties are PascalCase (no camelCase aliases) to match the rest of
// the MYPS frontend codebase convention.
//
// NOTE: PaginationParams and PaginationResponse<T> are declared as ambient
// globals in src/types/Pagination.d.ts — do NOT redeclare them here.
//
// NAMING GUARDRAIL: None of these types share a name with the legacy
// "Lump Sum project type" feature (IslandCode === 'LS') in Project/.
// Naming prefix "LSWallet" is used wherever collision risk exists.
// =============================================================================

// ---------------------------------------------------------------------------
// Stage type — matches the real StageName strings used throughout this codebase.
// Source: ProgramStageTable code table / Program module StageName field.
// ---------------------------------------------------------------------------
export type WalletStage = 'BP' | 'NEP' | 'HGAB' | 'GAA' | 'GAA-R';

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

/**
 * An LS Wallet: a budget container owned by a Program.
 * ComponentType is always 'LS' (locked on creation, enforced by service layer).
 */
export interface LSWallet {
  Id: number;
  // Program association (denormalized for list/display without an extra fetch)
  ProgramId: string;
  ProgramName: string;
  // Category / Sub-category (Thrust) / OU
  CategoryId: number;
  CategoryName: string;
  SubCategoryId: number;      // = Thrust
  SubCategoryName: string;
  OperatingUnit: string;
  // Funding
  FundingSource: string;
  FundingAgreement: string;
  Amount: number;             // Total wallet budget; raised on replenish
  FundingPercentage: number;
  // Stage tracking
  CurrentStage: WalletStage;  // Inherits from Program; advanced via WF-2 cascade
  // WF-7 delete-tier routing: false only for a wallet that has never been touched
  // since creation (no replenish, no stage cascade) — drives hard vs soft/blocked delete.
  HasStageData: boolean;
  // Component (always 'LS', locked)
  ComponentType: 'LS';
  ComponentYear: number;
  ComponentAmount: number;    // Matches Amount for an LS wallet
  ComponentTotal: number;     // = Amount
  ComponentUACS?: string;
  ComponentStartDate?: string | null;
  ComponentEndDate?: string | null;
  // Audit
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy?: string;
  UpdatedDate?: string;
  IsDeleted: boolean;
}

/**
 * A funding line attached to an ItemizedProject.
 * Exactly one line per project will have IsWalletLine = true — that line is the
 * one that draws down the parent wallet's Available balance.
 */
export interface FundingLine {
  Id: number;
  Source: string;
  Agreement: string;
  Amount: number;
  Percentage: number;
  IsWalletLine: boolean;      // true = this line represents the wallet allocation
}

/**
 * An AIP project itemized against an LSWallet.
 * Pre-publish edits update CurrentDrawAmount live.
 * Post-publish, PublishedDrawAmount is the frozen snapshot used for Used calculation.
 * See OPEN-1 in the plan for the backend snapshot resolution note.
 */
export interface ItemizedProject {
  Id: number;
  ProjectId: string;          // Generated ID, e.g. "LS-W001-P001"
  ParentWalletId: number;     // FK → LSWallet.Id
  ProjectType: 'LS';
  CategoryId: number;
  SubCategoryId: number;
  OperatingUnit: string;
  ProgramId: string;
  // Funding lines — one of these has IsWalletLine = true
  FundingLines: FundingLine[];
  // Component costs placeholder — typed as an opaque array; real shape TBD with backend
  ComponentCosts: Record<string, unknown>[];
  // Balance tracking
  CurrentDrawAmount: number;        // Live amount (editable before publish)
  PublishedDrawAmount: number | null; // Frozen at publish time (null = not yet published)
  // Status flags
  PublishStatus: 'NotPublished' | 'Published';
  ProjectStatus: 'NotYetStarted' | 'Packaged' | 'Ongoing' | 'Completed' | 'Terminated';
  HasStageData: boolean;            // true = hard delete blocked (soft-delete only)
  IsDeleted: boolean;
  IsCancelled: boolean;
  // Audit
  CreatedDate: string;
  UpdatedDate?: string;
}

/**
 * The computed balance for a single LSWallet.
 * Returned by computeWalletBalance() in utils/walletBalance.ts and
 * mirrors the eventual vLSWalletBalance SQL view shape.
 */
export interface LSWalletBalance {
  WalletId: number;
  Total: number;
  Used: number;
  Available: number;
}

/**
 * A revision record for an ItemizedProject (analogous to Modification module revisions).
 * Status codes: 0=Pending, 1=Approved, 2=Disapproved, 3=ForReview — matches
 * the Modification module's Region/CO status convention.
 */
export interface ItemizedProjectRevision {
  Id: number;
  ItemizedProjectId: number;
  // TransactionId format: "{ProjectId}-{RevisionNumber}" — mirrors Modification module
  TransactionId: string;
  RegionStatus: 0 | 1 | 2 | 3;
  COStatus: 0 | 1 | 2 | 3;
  Reason: string;
  Notes?: string;
  RequestedCost: number;
  CreatedBy: string;
  CreatedDate: string;
}

// ---------------------------------------------------------------------------
// Wire-format DTO types (prefixed with "Dto" per DtoProjectDetails convention)
// camelCase to match the real API payload shape when backend is wired.
// ---------------------------------------------------------------------------

/** Payload for WF-1 Create Wallet */
export interface DtoCreateWallet {
  programId: string;
  categoryId: number;
  subCategoryId: number;
  operatingUnit: string;
  fundingSource: string;
  fundingAgreement: string;
  amount: number;
  fundingPercentage: number;
  componentYear: number;
  componentUACS?: string | null;
  componentStartDate?: string | null;
  componentEndDate?: string | null;
  createdBy: string;
}

/** Payload for WF-3 Replenish Wallet */
export interface DtoReplenishWallet {
  walletId: number;
  newAmount: number;  // Must be strictly greater than current Amount
  updatedBy: string;
}

/** Payload for WF-4 Create Itemized Project */
export interface DtoCreateItemizedProject {
  parentWalletId: number;
  categoryId: number;
  subCategoryId: number;
  operatingUnit: string;
  programId: string;
  drawAmount: number;       // Becomes CurrentDrawAmount
  createdBy: string;
}

/** Payload for updating a draw amount (pre-publish edit) */
export interface DtoUpdateDrawAmount {
  projectId: string;
  newDrawAmount: number;
  updatedBy: string;
}

/** Payload for submitting a revision request (WF-6) */
export interface DtoSubmitRevision {
  itemizedProjectId: number;
  requestedCost: number;
  reason: string;
  notes?: string;
  createdBy: string;
}

/** Payload for approving/rejecting/returning a revision */
export interface DtoReviewRevision {
  revisionId: number;
  stage: 'Region' | 'CO';
  notes?: string;
  reviewedBy: string;
}

// ---------------------------------------------------------------------------
// Pagination helpers — extend the ambient PaginationParams global
// ---------------------------------------------------------------------------

export interface LSWalletPagination extends PaginationParams {
  filters?: LSWalletFilter;
  sortField?: string;
  sortDirection?: 0 | 1;
}

export interface LSWalletFilter {
  ProgramId?: string;
  CurrentStage?: WalletStage;
  OperatingUnit?: string;
}

export interface ItemizedProjectPagination extends PaginationParams {
  walletId?: number;
  sortField?: string;
  sortDirection?: 0 | 1;
}
