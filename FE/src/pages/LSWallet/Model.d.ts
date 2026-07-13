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
// Wallet-local funding and component cost interfaces
//
// These are structurally identical to the Project module's FundingProfile,
// ComponentCost, and ComponentCostPerYear interfaces (FE/src/pages/Project/Model.d.ts),
// but declared here so the LSWallet module stays self-contained per its
// documented mock-swap architecture. Any schema change to the Project originals
// must be manually mirrored here.
//
// STRUCTURAL TYPING NOTE: WalletComponentCost is passed to Project's
// DeleteComponentDialog (which expects ComponentCost). If ComponentCost gains
// a new required field, WalletComponentCost must be updated to match.
// ---------------------------------------------------------------------------

export interface WalletFundingProfile {
  Id: number;
  WalletId: number;       // FK → LSWallet.Id (replaces ProjectId)
  Source: string;
  Agreement: string;
  Percentage: number;
  Amount: number;
  CreatedBy: string;
  CreatedDate: string;
  IsDeleted: boolean;
}

export interface WalletComponentCost {
  Id: number;
  WalletId: number;       // FK → LSWallet.Id (replaces ProjectId)
  CostId: string;
  ComponentType: string;
  ComponentId: string;
  Description?: string;
  Total: number;
  StageName?: string;
  IsDeleted: boolean;
  RevisedNumber?: number;
  ConstructionStatusCode?: number;
  ConstructionStatusName?: string;
  PackedStatusCode?: boolean;
  PackedStatusName?: string;
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy?: string;
  UpdatedDate?: string;
}

export interface WalletComponentCostPerYear {
  Id: number;
  ComponentCostId: string;
  StageName?: string;
  Amount?: number;
  Year?: number;
  StartDate?: string | null;
  EndDate?: string | null;
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy?: string;
  UpdatedDate?: string;
  IsDeleted: boolean;
}

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

/**
 * An LS Wallet: a budget container owned by a Program.
 * ComponentType is always 'LS' (locked on creation, enforced by service layer).
 *
 * AMOUNT INVARIANT: `Amount` is a derived value — it is always the
 * SUM(WalletFundingProfiles where !IsDeleted). The mock store recomputes it
 * on every mutation (createWallet, replenishWallet). Do NOT set Amount directly;
 * mutate WalletFundingProfiles instead and let the store recompute.
 */
export interface LSWallet {
  Id: number;
  // Program association (denormalized for list/display without an extra fetch)
  ProgramId: string;
  ProgramName: string;
  // Program metadata at selection time (denormalized display fields).
  // All three fields are populated from the selected ProgramList entry and stored
  // so the Detail page can show them without an extra fetch.
  //
  // STAGE NOTE: ProgramStageName (the Program's stage at wallet-creation time) is a
  // separate, independent field from CurrentStage (the wallet's own lifecycle stage).
  // CurrentStage is seeded from the program's stage at creation and then advanced
  // in bulk via the WF-2 stage cascade (advanceProgramStage), so the two values can
  // diverge over the wallet's lifetime. ProgramStageName is informational display data
  // that never changes after creation; CurrentStage is the live workflow state.
  TypeName?: string;          // Program's TypeName at the time of wallet creation
  YearStart?: number;         // Program's YearStart at the time of wallet creation
  ProgramStageName?: string;  // Program's StageName at the time of wallet creation (informational, read-only after creation)
  // Category / Sub-category (Thrust) / OU — kept as flat fields for backward-compat
  // with all consumers (list, dialogs, balance widget) that read them directly.
  CategoryId: number;
  CategoryName: string;
  SubCategoryId: number;      // = Thrust
  SubCategoryName: string;
  OperatingUnit: string;
  // Derived amount (see invariant note above)
  Amount: number;             // Total wallet budget = SUM(WalletFundingProfiles)
  // Stage tracking
  CurrentStage: WalletStage;  // Inherits from Program; advanced via WF-2 cascade
  // WF-7 delete-tier routing: false only for a wallet that has never been touched
  // since creation (no replenish, no stage cascade) — drives hard vs soft/blocked delete.
  HasStageData: boolean;
  // Component type (always 'LS', locked)
  ComponentType: 'LS';

  // ── Multi-line funding profile array (replaces flat FundingSource/FundingAgreement/FundingPercentage) ──
  WalletFundingProfiles: WalletFundingProfile[];

  // ── Multi-row component cost arrays (replaces flat ComponentYear/ComponentAmount/etc.) ──
  WalletComponentCosts: WalletComponentCost[];
  WalletComponentCostPerYear: WalletComponentCostPerYear[];

  // ── General Information (new ProjectDetails-parity fields, all optional) ──
  MYId?: string;
  AlternateId?: string;
  ExternalId?: string;
  UACS?: string;
  Tier?: number;              // 1 = Tier I, 2 = Tier II
  Rank?: number;
  MYCAApprovalDate?: string | null;
  Description?: string;

  // ── Location Details ──
  Province?: string;           // GdbId of province
  City?: string;               // GdbId of city/municipality
  LegislativeDistrict?: string; // GdbId of legislative district

  // ── Organizational Responsibilities ──
  DEO?: string;                // ParticipantId of District Engineering Office
  Region?: string;             // ParticipantId of Regional Office
  ImplementingOffice?: string; // ParticipantId of Implementing Office
  RegionWide?: number;         // 1=Region Wide, 2=Non-Region Wide, 3=Region Wide AIP ignores DEO

  // ── Project Source ──
  Origin?: number;             // TableEnum.NameId
  Agency?: number;             // AgencyEnum.NameId

  // ── Implementation Readiness and Modality ──
  ImplementationMode?: number; // TableEnum.NameId
  EmergencyMode?: number;      // TableEnum.NameId
  Feasibility?: number;        // TableEnum.NameId
  FeasibilityDate?: string | null;
  DetailedDesign?: number;     // TableEnum.NameId
  DetailedDesignDate?: string | null;
  RowAvailable?: number;       // TableEnum.NameId

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

/**
 * Payload for WF-1 Create Wallet.
 *
 * REAL API SWAP NOTE: When the backend is ready, replace the mock store call
 * with a real httpClient.post call. The fundingProfiles and componentCosts arrays
 * map directly to the backend's expected array-based funding/component schema.
 */
export interface DtoCreateWallet {
  programId: string;
  // Denormalized program fields — populated client-side from the selected ProgramList
  // entry and stored on the wallet so the Detail page can display them without an
  // extra fetch. A real API could compute these server-side instead.
  typeName?: string;
  yearStart?: number;
  // Program's stage at wallet-creation time (informational display, never changes).
  // Distinct from currentStage — see LSWallet.ProgramStageName STAGE NOTE above.
  programStageName?: string;
  // Wallet's initial stage, seeded from the selected Program's StageName.
  // Defaults to 'BP' in the mock if omitted. Advanced later by WF-2 stage cascade.
  currentStage?: WalletStage;
  categoryId: number;
  subCategoryId: number;
  operatingUnit: string;
  // Array-based funding and component data (replaces old flat fields)
  fundingProfiles: WalletFundingProfile[];
  componentCosts: WalletComponentCost[];
  componentCostPerYear: WalletComponentCostPerYear[];
  // Optional ProjectDetails-parity fields
  myId?: string;
  alternateId?: string;
  externalId?: string;
  uacs?: string;
  tier?: number;
  rank?: number;
  mycaApprovalDate?: string | null;
  description?: string;
  province?: string;
  city?: string;
  legislativeDistrict?: string;
  deo?: string;
  region?: string;
  implementingOffice?: string;
  regionWide?: number;
  origin?: number;
  agency?: number;
  implementationMode?: number;
  emergencyMode?: number;
  feasibility?: number;
  feasibilityDate?: string | null;
  detailedDesign?: number;
  detailedDesignDate?: string | null;
  rowAvailable?: number;
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
