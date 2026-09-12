// =============================================================================
// Lump Sum module — TypeScript interfaces
//
// TWO LAYERS, DELIBERATELY SEPARATE:
//   - Domain types (LumpSum, LumpSumChild, LumpSumBalance, ...) are what
//     components render.
//   - Dto* types are the WIRE CONTRACT — exactly what LumpsumController's DTOs
//     accept. They are PascalCase because the C# DTOs are; System.Text.Json
//     binds case-insensitively, but matching the server spelling means a field
//     rename on either side shows up as a type error rather than as a value
//     that silently binds to null.
//
// The raw view rows the server returns live in utils/apiMappers.ts, not here.
//
// NOTE: PaginationParams and PaginationResponse<T> are ambient globals declared
// in src/types/Pagination.d.ts — do NOT redeclare them here.
// =============================================================================

import type { ImportedProject } from '../Project/Model.d';

export type { ImportedProject };

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

/**
 * A stage name as tOptionProgramStage stores it.
 *
 * NOT a closed union. The wallet-era model declared five stages
 * ('BP' | 'NEP' | 'HGAB' | 'GAA' | 'GAA-R') and the database has twelve —
 * every Trust Fund stage was missing, which is what all the sample data is.
 * A Lump Sum Project's stage is resolved from tProjectStages and follows its
 * program, so the frontend neither enumerates nor orders stages: see
 * REVISION_STAGES in utils/constants.ts for the one membership test it does make.
 */
export type LumpSumStage = string;

// ---------------------------------------------------------------------------
// Child rows of a Lump Sum Project's active revision
//
// These are tProjectFundingProfile / tProjectComponentCost /
// tProjectComponentCostPerYear rows. There is no parallel wallet storage — one
// project, one revision, one set of children.
//
// Id === 0 marks a row the client has not persisted yet; IsDeleted marks a
// persisted row on its way out. UpdateLumpSum merges on exactly those two.
// ---------------------------------------------------------------------------

export interface LumpSumFundingProfile {
  Id: number;
  /** tOptionFundingSource.Organization — stored as SourceOrg. */
  Source: string;
  /** tOptionFundingAgreement.Code — stored as AgreementCode. */
  Agreement: string;
  Amount: number;
  Percentage: number;
  IsDeleted: boolean;
}

export interface LumpSumComponentCost {
  Id: number;
  /**
   * Correlation key tying this cost to its per-year rows before either has a
   * database Id. For a persisted row it is String(Id), so the server's CostId
   * map resolves to the same row either way.
   */
  CostId: string;
  /** Component type CODE ('LS', 'CW', 'ROW'); the server also accepts the name. */
  ComponentType: string;
  ComponentId: string;
  Description?: string;
  Total: number;
  IsDeleted: boolean;

  // Audit columns, shown in the Component Cost table. Read-only: the server
  // stamps them, and anything sent here is ignored.
  CreatedBy?: string;
  CreatedDate?: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string | null;
}

export interface LumpSumComponentCostPerYear {
  Id: number;
  /** Matches LumpSumComponentCost.CostId. */
  ComponentCostId: string;
  Amount?: number;
  Year?: number;
  UACS?: string;
  StartDate?: string | null;
  EndDate?: string | null;
  IsDeleted: boolean;

  CreatedBy?: string;
  CreatedDate?: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string | null;
}

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

/**
 * A Lump Sum Project: an ordinary tProjects row that HOLDS a component of type
 * 'LS'. Itemization draws that component down; deleting a child returns its
 * cost to it.
 *
 * THE THREE ALLOCATION FIGURES ARE SERVER-COMPUTED AND NEVER RECONSTRUCTED HERE:
 *   Remaining   the live LS component cost — what is left to itemize
 *   Itemized    what the children have drawn out
 *   Allocation  Remaining + Itemized
 * There is no stored counter, so they cannot drift; a client-side mirror of the
 * formula could, which is why the wallet-era computeWalletBalance() is gone.
 *
 * The three child arrays are populated by LumpSumDetails only. The list
 * endpoint returns the header row alone, so on a row from ShowLumpSum they are
 * undefined — undefined means "not fetched", never "empty".
 */
/**
 * A fresh "being itemized" stamp. tProjects.LockedBy / LockedDate, written by
 * the import for its duration; the server only reports one younger than its TTL.
 */
export interface LumpSumLock {
  LockedBy: string;
  /** ISO timestamp, as the server sends it. */
  LockedDate: string;
}

/**
 * The program's latest revision, reported by LumpSumDetails ONLY when it is
 * Approved at GAA-R (2026-09-09). In that state the project's details and
 * component are read-only and it cannot be deleted or newly created — and
 * nothing else changes: Replenish, Import, Save and the funding-line Delete
 * all keep working. Null or absent otherwise. Carries the program's own name
 * and stage from vProgramLatest, not the project's mirror of them, so the
 * banner names what the server actually read.
 */
export interface LumpSumProgramApproval {
  ProgramName: string;
  StageName: string;
  Status: string;
}

export interface LumpSum {
  /** tProjects.Id — what every Lump Sum-scoped endpoint calls LumpSumId. */
  Id: number;
  /** tProjects.ProjectPK. */
  ProjectPK: string;
  /** The generated, user-facing Project ID. A parent's ends in 'LS'. */
  ProjectId: string;
  /** The active revision's Id — what the child rows hang off. */
  RevisionId: number;

  /** tPrograms.ProgramPK — the readable program key, NOT the GUID. */
  ProgramId: string;
  ProgramName: string;
  /** The program's budget year. */
  StartYear?: number;

  CategoryId: number;
  CategoryName: string;
  /** Thrust — tOptionProjectThrustList.PAPKey. */
  SubCategoryId?: number;
  OperatingUnit: string;
  /** Resolved office name for OperatingUnit; detail endpoint only. */
  OperatingUnitName?: string;

  /**
   * Resolved from tProjectStages on every read and never sent to the server.
   * A Lump Sum Project follows its program's stage, which can be any stage —
   * nothing here may assume 'BP'.
   */
  CurrentStage: LumpSumStage;

  // ── Allocation ──────────────────────────────────────────────────────────
  Allocation: number;
  Itemized: number;
  Remaining: number;
  ItemizedCount: number;

  /*  A fresh "being itemized" stamp from LumpSumDetails, or null. tProjects
      carries LockedBy/LockedDate; the import stamps them for its duration and
      the server reports one only while it is younger than its TTL. Display
      only: the mutators refuse with 409 Busy on their own. */
  Lock?: LumpSumLock | null;

  /*  The program's approval from LumpSumDetails, or null. Same convention as
      Lock: undefined means "not fetched" (a list row), null means "not
      approved at GAA-R". Display only — every mutator refuses on its own. */
  ProgramApproval?: LumpSumProgramApproval | null;

  // ── General Information ─────────────────────────────────────────────────
  MYId?: string;
  AlternateId?: string;
  ExternalId?: string;
  UACS?: string;
  Tier?: number;
  Rank?: number;
  MYCAApprovalDate?: string | null;
  Description?: string;

  // ── Location Details (all optional under the V2 field spec) ─────────────
  Province?: string;
  City?: string;
  LegislativeDistrict?: string;

  // ── Organizational Responsibilities ─────────────────────────────────────
  DEO?: string;
  Region?: string;
  ImplementingOffice?: string;
  RegionWide?: number;

  // ── Project Source ──────────────────────────────────────────────────────
  Origin?: number;
  Agency?: number;

  // ── Implementation Readiness and Modality ───────────────────────────────
  ImplementationMode?: number;
  EmergencyMode?: number;
  Feasibility?: number;
  FeasibilityDate?: string | null;
  DetailedDesign?: number;
  DetailedDesignDate?: string | null;
  RowAvailable?: number;

  // ── Child rows — LumpSumDetails only (see note above) ───────────────────
  FundingProfiles?: LumpSumFundingProfile[];
  ComponentCosts?: LumpSumComponentCost[];
  ComponentCostPerYear?: LumpSumComponentCostPerYear[];

  /** Read only. A Lump Sum Project is never published by this module. */
  IsPublished: boolean;

  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string | null;
}

/**
 * An itemized project created under a Lump Sum Project.
 *
 * Membership is by PARENT PROJECT — tProjects.ParentProjectId points at the
 * parent's ProjectId. There is no wallet id and no un-itemize.
 *
 * vLumpSumChildSet returns only live rows, so there is no IsDeleted or
 * IsCancelled here and nothing to filter client-side.
 */
export interface LumpSumChild {
  Id: number;
  ProjectPK: string;
  ProjectId: string;
  /** The parent Lump Sum Project's ProjectId. */
  ParentProjectId?: string;
  ProgramId: string;
  RevisionId: number;

  /** Proj-1: 'Itemized' or 'Additional'. */
  ItemizationType?: string;
  /** Proj-9 lifecycle: 'potential' then 'scheduled'. */
  ProjectStatus: string;
  /** PCMA statuses reduced to one project-level answer. */
  ConstructionStatus: string;

  AlternateId?: string;
  Description: string;
  CategoryId: number;
  CategoryName?: string;
  SubCategoryId?: number;
  OperatingUnit: string;
  CurrentStage?: LumpSumStage;

  Region?: string;
  Province?: string;
  City?: string;
  LegislativeDistrict?: string;
  DEO?: string;
  ImplementingOffice?: string;

  Tier: number;
  Rank?: number;
  MYId?: string;
  ExternalId?: string;
  UACS?: string;
  MYCAApprovalDate?: string | null;
  RegionWide: number;
  Origin: number;
  Agency: number;

  /** Read only — publishing belongs to the Programs module. */
  IsPublished: boolean;
  IsRevised: boolean;
  IsPackaged?: boolean;

  FundingTotal: number;
  ComponentCostTotal: number;
  /** What this child drew from its parent. Deleting it returns exactly this. */
  DrawnFromParent: number;
  /** The wallet-draw lines' total on this child's funding profile. */
  CurrentDrawAmount: number;

  /** The draw lines themselves, returned alongside the page. */
  FundingLines: LumpSumChildFundingLine[];

  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string | null;
}

/** One wallet-draw funding line on an itemized child. */
export interface LumpSumChildFundingLine {
  Id: number;
  Source: string;
  Agreement: string;
  Amount: number;
  Percentage: number;
}

/**
 * dbo.vLumpSumBalance, verbatim except for the key's name.
 *
 * Total is nullable in the view (SQL Server infers the sum as NULL-able), so
 * the mapper substitutes 0 rather than letting undefined reach a formatter.
 */
export interface LumpSumBalance {
  LumpSumId: number;
  Total: number;
  Itemized: number;
  Remaining: number;
}

/** One entry in the Activity timeline. Reconstructed from audit columns. */
export interface LumpSumActivityEvent {
  At: string;
  By: string;
  Kind: 'LumpSumCreated' | 'LumpSumUpdated' | 'ProjectItemized' | 'ProjectPublished';
  Summary: string;
}

/**
 * Dropdown sources for the list filter bar — InitFilterLumpSum.
 *
 * Stages come straight off tOptionProgramStage, so the stage's text is `Name`,
 * NOT `StageName` — the latter is what vLumpSumSet calls the same value and
 * reading it here yields undefined: blank options that filter on nothing.
 * They arrive ordered by StageHierarchy, which is the only correct stage order
 * (NameId is insertion order, and it disagrees).
 */
export interface LumpSumFilterOptions {
  Programs: {
    ProgramFK: string;
    ProgramId: string;
    ProgramName: string | null;
    YearStart: number | null;
  }[];
  Stages: { NameId: number; Name: string; Description: string | null }[];
  Categories: { CategoryId: number; CategoryName: string }[];
  Years: number[];
}

// ---------------------------------------------------------------------------
// Wire DTOs — mirror WebAPI/Controllers/Lumpsum/DTOLumpSum.cs
// ---------------------------------------------------------------------------

/**
 * The detail fields shared by create and update, exactly as
 * LumpSumDetailFieldsDTO declares them, so the two paths cannot drift.
 *
 * CurrentStage is absent on purpose: the server accepts it and never writes it,
 * so sending it would only suggest the client can move a project off its
 * program's stage.
 */
export interface DtoLumpSumDetailFields {
  /** tPrograms.ProgramPK. */
  ProgramId: string;
  CategoryId?: number;
  SubCategoryId?: number;
  OperatingUnit?: string;

  MyId?: string;
  AlternateId?: string;
  ExternalId?: string;
  Uacs?: string;
  Tier?: number;
  Rank?: number;
  MycaApprovalDate?: string | null;
  Description?: string;

  Province?: string;
  City?: string;
  LegislativeDistrict?: string;

  Deo?: string;
  Region?: string;
  ImplementingOffice?: string;
  RegionWide?: number;

  Origin?: number;
  Agency?: number;

  ImplementationMode?: number;
  EmergencyMode?: number;
  Feasibility?: number;
  FeasibilityDate?: string | null;
  DetailedDesign?: number;
  DetailedDesignDate?: string | null;
  RowAvailable?: number;

  FundingProfiles: LumpSumFundingProfile[];
  ComponentCosts: LumpSumComponentCost[];
  ComponentCostPerYear: LumpSumComponentCostPerYear[];
}

/**
 * CreateLumpSum. The allocation arrives as ONE number with ONE funding line
 * behind it — not as the child arrays, which the create path does not read.
 *
 * FundingSource and FundingAgreement are collected rather than defaulted:
 * AgreementCode is a foreign key onto tOptionFundingAgreement, so a guessed
 * code is a save failure and a blank one a raw constraint violation.
 */
export interface DtoCreateLumpSum extends DtoLumpSumDetailFields {
  Allocation: number;
  FundingSource?: string;
  FundingAgreement?: string;
}

/** UpdateLumpSum — composite save of the revision plus the full child sets. */
export interface DtoUpdateLumpSum extends DtoLumpSumDetailFields {
  LumpSumId: number;
}

/** ReplenishLumpSum — appends a funding line, never edits an existing one. */
export interface DtoReplenishLumpSum {
  LumpSumId: number;
  /** The new TOTAL allocation, not the delta. Must exceed the current total. */
  NewAmount: number;
  Source?: string;
  Agreement?: string;
}

/**
 * ValidateForItemization's answer. A refusal comes back 200-shaped with
 * Valid false and a reason, because the import dialog renders it — a 400 here
 * would read as a failure rather than as a reason.
 */
export interface LumpSumItemizationCheck {
  Valid: boolean;
  Message?: string;
  Available?: number;
}

/** What both delete endpoints report back. */
export interface LumpSumDeleteResult {
  /** 'Hard' or 'Soft' — the server decides, never the client. */
  Tier: string;
  Message: string;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface LumpSumFilter {
  /** tPrograms.ProgramPK. */
  ProgramFK?: string;
  /** Free-text; the ONLY LIKE filter, matched against the project's Description. */
  ProgramName?: string;
  CurrentStage?: LumpSumStage;
  OperatingUnit?: string;
  CategoryId?: number;
  YearStart?: number;
}

/*  NO LumpSumPagination TYPE (removed 2026-09-10). The list speaks the server's
    keyset contract through the shared PaginatedRequest<LumpSumFilter>: the old
    type had no Navigation and no cursor fields, so the request literally could
    not express "the next page". See usePagination and Service.fetchLumpSumList. */
