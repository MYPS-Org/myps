// =============================================================================
// apiMappers.ts — server row  ->  Lump Sum module view-model
//
// WHY THIS FILE EXISTS
// The views name their columns for the database, not for the UI: the balance
// key is WalletId, the category is Category, the stage is StageName, and
// nullability follows the column rather than the field spec. Translating that
// in one place keeps every component reading one vocabulary.
//
// WHAT IT NO LONGER DOES
// The wallet-era version widened a single flat tLSWallets row into one-element
// arrays and synthesized a funding line hardcoded to 'GOP'. There is no flat
// row any more — funding, component costs and per-year rows are real
// tProject* rows and arrive as themselves. Nothing here invents a value: a
// field the server did not send stays undefined.
// =============================================================================

import type {
  LumpSum,
  LumpSumChild,
  LumpSumChildFundingLine,
  LumpSumBalance,
  LumpSumFundingProfile,
  LumpSumComponentCost,
  LumpSumComponentCostPerYear,
} from '../Model.d';

// ---------------------------------------------------------------------------
// Wire shapes — mirror dbo.vLumpSumSet / vLumpSumChildSet / vLumpSumBalance
// and the tProject* rows LumpSumDetails returns alongside them.
// ---------------------------------------------------------------------------

export interface ApiLumpSum {
  Id: number;
  ProjectPK: string;
  ProgramFK: string;
  /** The program's GUID — not user-facing. ProgramFK is the readable key. */
  ProgramId: string;
  ProgramName: string | null;
  StartYear: number | null;
  ProjectType: string;

  RevisionId: number;
  ProjectId: string;
  AlternateId: string | null;
  Description: string;
  Category: number;
  CategoryName: string | null;
  OperatingUnit: string;
  Region: string | null;
  StageName: string | null;

  Thrust: number | null;
  Tier: number;
  Rank: number | null;
  RegionWide: number;
  Origin: number;
  Agency: number;

  Province: string | null;
  City: string | null;
  LegislativeDistrict: string | null;
  DEO: string | null;
  ImplementingOffice: string | null;

  MYCAApprovalDate: string | null;
  ImplementationMode: number | null;
  EmergencyMode: number | null;
  Feasibility: number | null;
  FeasibilityDate: string | null;
  DetailedDesign: number | null;
  DetailedDesignDate: string | null;
  RowAvailable: number | null;

  MYId: string | null;
  ExternalId: string | null;

  Remaining: number;
  ItemizedTotal: number;
  ItemizedCount: number;
  /** Nullable in the view — Remaining + ItemizedTotal, reconstructed not stored. */
  OriginalAllocation: number | null;

  UACS: string | null;
  IsPublished: boolean;

  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy: string | null;
  UpdatedDate: string | null;
}

export interface ApiLumpSumChild {
  Id: number;
  ProjectPK: string;
  ParentProjectId: string | null;
  ProgramFK: string;
  ProgramId: string;
  ProjectType: string;
  ItemizationType: string | null;
  ProjectStatus: string;

  RevisionId: number;
  ProjectId: string;
  AlternateId: string | null;
  Description: string;

  Region: string | null;
  Province: string | null;
  City: string | null;
  LegislativeDistrict: string | null;
  DEO: string | null;
  OperatingUnit: string;
  ImplementingOffice: string | null;

  Category: number;
  CategoryName: string | null;
  Thrust: number | null;
  Tier: number;
  Rank: number | null;
  StageName: string | null;

  MYId: string | null;
  ExternalId: string | null;
  UACS: string | null;
  MYCAApprovalDate: string | null;

  RegionWide: number;
  Origin: number;
  Agency: number;
  ImplementationMode: number | null;
  EmergencyMode: number | null;
  Feasibility: number | null;
  FeasibilityDate: string | null;
  DetailedDesign: number | null;
  DetailedDesignDate: string | null;
  RowAvailable: number | null;

  IsPublished: boolean;
  IsRevised: boolean;
  ConstructionStatus: string;
  IsPackaged: boolean | null;

  FundingTotal: number;
  ComponentCostTotal: number;
  DrawnFromParent: number;
  CurrentDrawAmount: number;

  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy: string | null;
  UpdatedDate: string | null;
}

/**
 * The wallet-draw funding lines ShowItemizedProjects returns beside the page.
 *
 * A SIBLING COLLECTION, NOT A PROPERTY. LumpSumChild is bound by column name
 * out of vLumpSumChildSet, and a property with no matching column aborts the
 * whole query — so the lines come back keyed by ProjectPK and are stitched on
 * here.
 */
export interface ApiChildFundingLine {
  ProjectPK: string;
  Id: number;
  SourceOrg: string;
  AgreementCode: string;
  Amount: number;
  Percentage: number;
}

export interface ApiLumpSumBalance {
  /** vLumpSumBalance still names the key WalletId; it is the project's Id. */
  WalletId: number;
  Total: number | null;
  Itemized: number;
  Remaining: number;
}

/** dbo.tProjectFundingProfile, as LumpSumDetails returns it. */
export interface ApiFundingProfileRow {
  Id: number;
  SourceOrg: string;
  AgreementCode: string;
  Amount: number;
  Percentage: number;
  IsDeleted: boolean;
}

/** dbo.tProjectComponentCost. ComponentType is stored as the NAME. */
export interface ApiComponentCostRow {
  Id: number;
  ComponentType: string;
  ComponentId: string;
  Description: string | null;
  Total: number;
  IsDeleted: boolean;
  CreatedBy: string | null;
  CreatedDate: string | null;
  UpdatedBy: string | null;
  UpdatedDate: string | null;
}

/** dbo.tProjectComponentCostPerYear. */
export interface ApiComponentCostPerYearRow {
  Id: number;
  ComponentCostFK: number;
  ComponentId: string;
  Amount: number;
  Year: number;
  UACS: string | null;
  StartDate: string | null;
  EndDate: string | null;
  IsDeleted: boolean;
  CreatedBy: string | null;
  CreatedDate: string | null;
  UpdatedBy: string | null;
  UpdatedDate: string | null;
}

/** Everything LumpSumDetails returns for one project. */
export interface ApiLumpSumDetails {
  LumpSumProject: ApiLumpSum;
  Balance: ApiLumpSumBalance;
  OperatingUnitName: string | null;
  FundingProfiles: ApiFundingProfileRow[];
  ComponentCosts: ApiComponentCostRow[];
  ComponentCostPerYear: ApiComponentCostPerYearRow[];
  /** A fresh "being itemized" stamp, or null. Older payloads omit it entirely. */
  Lock?: { LockedBy: string; LockedDate: string } | null;
  /** The program Approved at GAA-R, or null. Older payloads omit it entirely. */
  ProgramApproval?: { ProgramName: string; StageName: string; Status: string } | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** `null` and `''` both mean "not set" for an optional string field. */
const opt = (value: string | null | undefined): string | undefined =>
  value == null || value === '' ? undefined : value;

/**
 * vLumpSumSet row -> LumpSum.
 *
 * The child arrays are LEFT UNDEFINED. A list row genuinely has none, and
 * defaulting them to [] would tell the edit form the project has no funding
 * profile — which UpdateLumpSum refuses.
 */
export const mapApiLumpSum = (row: ApiLumpSum): LumpSum => ({
  Id: row.Id,
  ProjectPK: row.ProjectPK,
  ProjectId: row.ProjectId,
  RevisionId: row.RevisionId,

  // The readable "PRG-2026-B001" key, not the view's GUID ProgramId column.
  ProgramId: row.ProgramFK,
  ProgramName: row.ProgramName ?? '',
  StartYear: row.StartYear ?? undefined,

  CategoryId: row.Category,
  CategoryName: row.CategoryName ?? '',
  SubCategoryId: row.Thrust ?? undefined,
  OperatingUnit: row.OperatingUnit,

  CurrentStage: row.StageName ?? '',

  // OriginalAllocation is nullable in the view; Remaining + Itemized is the
  // same figure and is not, so it is the better fallback than 0.
  Allocation: row.OriginalAllocation ?? row.Remaining + row.ItemizedTotal,
  Itemized: row.ItemizedTotal,
  Remaining: row.Remaining,
  ItemizedCount: row.ItemizedCount,

  MYId: opt(row.MYId),
  AlternateId: opt(row.AlternateId),
  ExternalId: opt(row.ExternalId),
  UACS: opt(row.UACS),
  Tier: row.Tier,
  Rank: row.Rank ?? undefined,
  MYCAApprovalDate: row.MYCAApprovalDate,
  Description: opt(row.Description),

  Province: opt(row.Province),
  City: opt(row.City),
  LegislativeDistrict: opt(row.LegislativeDistrict),

  DEO: opt(row.DEO),
  Region: opt(row.Region),
  ImplementingOffice: opt(row.ImplementingOffice),
  RegionWide: row.RegionWide,

  Origin: row.Origin,
  Agency: row.Agency,

  ImplementationMode: row.ImplementationMode ?? undefined,
  EmergencyMode: row.EmergencyMode ?? undefined,
  Feasibility: row.Feasibility ?? undefined,
  FeasibilityDate: row.FeasibilityDate,
  DetailedDesign: row.DetailedDesign ?? undefined,
  DetailedDesignDate: row.DetailedDesignDate,
  RowAvailable: row.RowAvailable ?? undefined,

  IsPublished: row.IsPublished,

  CreatedBy: row.CreatedBy,
  CreatedDate: row.CreatedDate,
  UpdatedBy: row.UpdatedBy ?? undefined,
  UpdatedDate: row.UpdatedDate,
});

export const mapApiFundingProfile = (row: ApiFundingProfileRow): LumpSumFundingProfile => ({
  Id: row.Id,
  Source: row.SourceOrg,
  Agreement: row.AgreementCode,
  Amount: row.Amount,
  Percentage: row.Percentage,
  IsDeleted: row.IsDeleted,
});

/**
 * CostId is String(Id) for a persisted cost, which is what makes the per-year
 * rows below able to point at it: the server's CostId map resolves an existing
 * row's CostId back to that same Id.
 */
export const mapApiComponentCost = (row: ApiComponentCostRow): LumpSumComponentCost => ({
  Id: row.Id,
  CostId: String(row.Id),
  ComponentType: row.ComponentType,
  ComponentId: row.ComponentId,
  Description: row.Description ?? undefined,
  Total: row.Total,
  IsDeleted: row.IsDeleted,
  CreatedBy: row.CreatedBy ?? undefined,
  CreatedDate: row.CreatedDate,
  UpdatedBy: row.UpdatedBy ?? undefined,
  UpdatedDate: row.UpdatedDate,
});

export const mapApiComponentCostPerYear = (
  row: ApiComponentCostPerYearRow,
): LumpSumComponentCostPerYear => ({
  Id: row.Id,
  ComponentCostId: String(row.ComponentCostFK),
  Amount: row.Amount,
  Year: row.Year,
  UACS: row.UACS ?? undefined,
  StartDate: row.StartDate,
  EndDate: row.EndDate,
  IsDeleted: row.IsDeleted,
  CreatedBy: row.CreatedBy ?? undefined,
  CreatedDate: row.CreatedDate,
  UpdatedBy: row.UpdatedBy ?? undefined,
  UpdatedDate: row.UpdatedDate,
});

/** The whole LumpSumDetails payload folded into one LumpSum. */
export const mapApiLumpSumDetails = (payload: ApiLumpSumDetails): LumpSum => ({
  ...mapApiLumpSum(payload.LumpSumProject),
  OperatingUnitName: payload.OperatingUnitName ?? undefined,
  FundingProfiles: (payload.FundingProfiles ?? []).map(mapApiFundingProfile),
  ComponentCosts: (payload.ComponentCosts ?? []).map(mapApiComponentCost),
  ComponentCostPerYear: (payload.ComponentCostPerYear ?? []).map(mapApiComponentCostPerYear),
  Lock: payload.Lock ?? null,
  ProgramApproval: payload.ProgramApproval ?? null,
});

/**
 * vLumpSumChildSet row -> LumpSumChild, with its draw lines stitched on from
 * the sibling collection.
 */
export const mapApiLumpSumChild = (
  row: ApiLumpSumChild,
  fundingLines: ApiChildFundingLine[] = [],
): LumpSumChild => ({
  Id: row.Id,
  ProjectPK: row.ProjectPK,
  ProjectId: row.ProjectId,
  ParentProjectId: opt(row.ParentProjectId),
  ProgramId: row.ProgramFK,
  RevisionId: row.RevisionId,

  ItemizationType: opt(row.ItemizationType),
  ProjectStatus: row.ProjectStatus,
  ConstructionStatus: row.ConstructionStatus,

  AlternateId: opt(row.AlternateId),
  Description: row.Description,
  CategoryId: row.Category,
  CategoryName: opt(row.CategoryName),
  SubCategoryId: row.Thrust ?? undefined,
  OperatingUnit: row.OperatingUnit,
  CurrentStage: opt(row.StageName),

  Region: opt(row.Region),
  Province: opt(row.Province),
  City: opt(row.City),
  LegislativeDistrict: opt(row.LegislativeDistrict),
  DEO: opt(row.DEO),
  ImplementingOffice: opt(row.ImplementingOffice),

  Tier: row.Tier,
  Rank: row.Rank ?? undefined,
  MYId: opt(row.MYId),
  ExternalId: opt(row.ExternalId),
  UACS: opt(row.UACS),
  MYCAApprovalDate: row.MYCAApprovalDate,
  RegionWide: row.RegionWide,
  Origin: row.Origin,
  Agency: row.Agency,

  IsPublished: row.IsPublished,
  IsRevised: row.IsRevised,
  IsPackaged: row.IsPackaged ?? undefined,

  FundingTotal: row.FundingTotal,
  ComponentCostTotal: row.ComponentCostTotal,
  DrawnFromParent: row.DrawnFromParent,
  CurrentDrawAmount: row.CurrentDrawAmount,

  FundingLines: fundingLines
    .filter((line) => line.ProjectPK === row.ProjectPK)
    .map(
      (line): LumpSumChildFundingLine => ({
        Id: line.Id,
        Source: line.SourceOrg,
        Agreement: line.AgreementCode,
        Amount: line.Amount,
        Percentage: line.Percentage,
      }),
    ),

  CreatedBy: row.CreatedBy,
  CreatedDate: row.CreatedDate,
  UpdatedBy: row.UpdatedBy ?? undefined,
  UpdatedDate: row.UpdatedDate,
});

export const mapApiBalance = (row: ApiLumpSumBalance): LumpSumBalance => ({
  LumpSumId: row.WalletId,
  Total: row.Total ?? 0,
  Itemized: row.Itemized,
  Remaining: row.Remaining,
});
