// =============================================================================
// apiMappers.ts — backend row  ->  LSWallet module view-model
//
// WHY THIS FILE EXISTS
// The backend stores a wallet FLAT: dbo.tLSWallets holds ONE funding source and
// ONE component year per wallet. The UI types in Model.d.ts were designed
// around ARRAYS (WalletFundingProfiles[], WalletComponentCosts[], ...).
// Rather than rewrite every component, the single flat row is widened into
// one-element arrays here, in one place.
//
// Consequently a number of Model.d.ts fields have NO column behind them and are
// deliberately left `undefined` — see UNBACKED FIELDS below. Do not "fix" them
// by inventing values; they need real columns on tLSWallets first.
// =============================================================================

import type {
  LSWallet,
  WalletStage,
  ItemizedProject,
  LSWalletBalance,
} from '../Model.d';

// ---------------------------------------------------------------------------
// Wire shapes — mirror dbo.vLSWalletLatest / vLSWalletProjectSet / vLSWalletBalance
// ---------------------------------------------------------------------------

export interface ApiLSWalletLatest {
  Id: number;
  ProgramFK: string;          // tPrograms.ProgramPK, e.g. "PRG-2026-B001"
  ProgramId: string;          // tPrograms.ProgramId — a GUID, not user-facing
  ProgramName: string | null;
  TypeName: string | null;
  YearStart: number;
  ProgramStageName: string | null;
  CategoryId: number | null;
  CategoryName: string | null;
  SubCategoryFK: number | null;
  SubCategoryName: string | null;
  OperatingUnit: string | null;
  Amount: number;
  CurrentStage: string | null;
  FundingSource: string | null;
  FundingAgreement: string | null;
  FundingPercentage: number | null;
  ComponentYear: number | null;
  ComponentUACS: string | null;
  ComponentStartDate: string | null;
  ComponentEndDate: string | null;
  ComponentType: string;
  HasStageData: boolean;
  MYId: string | null;
  AlternateId: string | null;
  ExternalId: string | null;
  UACS: string | null;
  Tier: number | null;
  Rank: number | null;
  MYCAApprovalDate: string | null;
  Description: string | null;
  Province: string | null;
  City: string | null;
  LegislativeDistrict: string | null;
  DEO: string | null;
  Region: string | null;
  ImplementingOffice: string | null;
  RegionWide: number | null;
  Origin: number | null;
  Agency: number | null;
  ImplementationMode: number | null;
  EmergencyMode: number | null;
  Feasibility: number | null;
  FeasibilityDate: string | null;
  DetailedDesign: number | null;
  DetailedDesignDate: string | null;
  RowAvailable: number | null;
  Total: number;
  Used: number;
  Available: number;
  ProjectCount: number;
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy: string | null;
  UpdatedDate: string | null;
}

export interface ApiLSWalletProjectSet {
  Id: number;
  ProjectPK: string;
  ParentWalletId: number;
  ProgramFK: string;
  ProgramId: string;
  ProjectType: string;
  RevisionId: number;
  ProjectId: string;
  AlternateId: string | null;
  Description: string | null;
  Region: string | null;
  Province: string | null;
  City: string | null;
  LegislativeDistrict: string | null;
  DEO: string | null;
  OperatingUnit: string | null;
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
  WalletDrawFrozen: number | null;
  CurrentDrawAmount: number;
  EffectiveDraw: number;
  CreatedBy: string;
  CreatedDate: string;
  UpdatedBy: string | null;
  UpdatedDate: string | null;
}

export interface ApiLSWalletBalance {
  WalletId: number;
  Total: number;
  Used: number;
  Available: number;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * vLSWalletLatest row -> LSWallet.
 *
 * Every field on the LSWallet type now has a real column behind it
 * (LSWallet.Schema.sql added the wallet detail columns), so nothing is
 * synthesized here except the three arrays described below.
 *
 * ProgramId is mapped from ProgramFK (the readable "PRG-2026-B001" key) rather
 * than the view's ProgramId column, which is an opaque GUID.
 */
export const mapApiWalletToLSWallet = (row: ApiLSWalletLatest): LSWallet => ({
  Id: row.Id,
  ProgramId: row.ProgramFK,
  ProgramName: row.ProgramName ?? '',
  TypeName: row.TypeName ?? undefined,
  YearStart: row.YearStart,
  ProgramStageName: row.ProgramStageName ?? undefined,
  CategoryId: row.CategoryId ?? 0,
  CategoryName: row.CategoryName ?? '',
  SubCategoryId: row.SubCategoryFK ?? 0,
  SubCategoryName: row.SubCategoryName ?? '',
  OperatingUnit: row.OperatingUnit ?? '',
  Amount: row.Amount,
  CurrentStage: (row.CurrentStage ?? 'BP') as WalletStage,
  HasStageData: row.HasStageData,
  ComponentType: 'LS',

  // Flat row widened to the one-element arrays the UI expects.
  WalletFundingProfiles: [
    {
      Id: 1,
      WalletId: row.Id,
      Source: row.FundingSource ?? '',
      Agreement: row.FundingAgreement ?? '',
      Percentage: row.FundingPercentage ?? 0,
      Amount: row.Amount,
      CreatedBy: row.CreatedBy,
      CreatedDate: row.CreatedDate,
      IsDeleted: false,
    },
  ],
  WalletComponentCosts: [
    {
      Id: 1,
      WalletId: row.Id,
      CostId: `${row.Id}-1`,
      ComponentType: 'LS',
      ComponentId: String(row.Id),
      Total: row.Amount,
      StageName: row.CurrentStage ?? undefined,
      IsDeleted: false,
      CreatedBy: row.CreatedBy,
      CreatedDate: row.CreatedDate,
      UpdatedBy: row.UpdatedBy ?? undefined,
      UpdatedDate: row.UpdatedDate ?? undefined,
    },
  ],
  WalletComponentCostPerYear: [
    {
      Id: 1,
      ComponentCostId: `${row.Id}-1`,
      StageName: row.CurrentStage ?? undefined,
      Amount: row.Amount,
      Year: row.ComponentYear ?? undefined,
      StartDate: row.ComponentStartDate,
      EndDate: row.ComponentEndDate,
      CreatedBy: row.CreatedBy,
      CreatedDate: row.CreatedDate,
      UpdatedBy: row.UpdatedBy ?? undefined,
      UpdatedDate: row.UpdatedDate ?? undefined,
      IsDeleted: false,
    },
  ],

  // ── General Information ──────────────────────────────────────────────────
  MYId: row.MYId ?? undefined,
  AlternateId: row.AlternateId ?? undefined,
  ExternalId: row.ExternalId ?? undefined,
  // Wallet-level UACS; the component/fiscal-year UACS lives on
  // WalletComponentCostPerYear above and comes from ComponentUACS.
  UACS: row.UACS ?? undefined,
  Tier: row.Tier ?? undefined,
  Rank: row.Rank ?? undefined,
  MYCAApprovalDate: row.MYCAApprovalDate,
  Description: row.Description ?? undefined,

  // ── Location Details ─────────────────────────────────────────────────────
  Province: row.Province ?? undefined,
  City: row.City ?? undefined,
  LegislativeDistrict: row.LegislativeDistrict ?? undefined,

  // ── Organizational Responsibilities ──────────────────────────────────────
  DEO: row.DEO ?? undefined,
  Region: row.Region ?? undefined,
  ImplementingOffice: row.ImplementingOffice ?? undefined,
  RegionWide: row.RegionWide ?? undefined,

  // ── Project Source ───────────────────────────────────────────────────────
  Origin: row.Origin ?? undefined,
  Agency: row.Agency ?? undefined,

  // ── Implementation Readiness and Modality ────────────────────────────────
  ImplementationMode: row.ImplementationMode ?? undefined,
  EmergencyMode: row.EmergencyMode ?? undefined,
  Feasibility: row.Feasibility ?? undefined,
  FeasibilityDate: row.FeasibilityDate,
  DetailedDesign: row.DetailedDesign ?? undefined,
  DetailedDesignDate: row.DetailedDesignDate,
  RowAvailable: row.RowAvailable ?? undefined,

  CreatedBy: row.CreatedBy,
  CreatedDate: row.CreatedDate,
  UpdatedBy: row.UpdatedBy ?? undefined,
  UpdatedDate: row.UpdatedDate ?? undefined,
  IsDeleted: false,
});

/**
 * vLSWalletProjectSet row -> ItemizedProject.
 *
 * The cost breakdown arrays (ComponentCosts, ComponentCostPerYear,
 * MajorItemOfWorks, MajorItemLocations) are NOT loaded by the Phase 1 list
 * endpoint and come back empty. Fetch them from the Project module when a
 * single itemized project is opened.
 *
 * ProjectStatus has no backing column and is reported as 'NotYetStarted'.
 */
export const mapApiProjectToItemized = (row: ApiLSWalletProjectSet): ItemizedProject => ({
  Id: row.Id,
  ProjectId: row.ProjectId,
  ParentWalletId: row.ParentWalletId,
  ProjectType: 'LS',
  CategoryId: row.Category,
  SubCategoryId: row.Thrust ?? 0,
  OperatingUnit: row.OperatingUnit ?? '',
  ProgramId: row.ProgramFK,

  // One synthesized line representing the wallet draw (IsWalletDraw = 1).
  FundingLines: [
    {
      Id: 1,
      Source: 'GOP',
      Agreement: '',
      Amount: row.CurrentDrawAmount,
      Percentage: 100,
    },
  ],

  ComponentCosts: [],
  ComponentCostPerYear: [],
  MajorItemOfWorks: [],
  MajorItemLocations: [],

  CurrentDrawAmount: row.CurrentDrawAmount,
  PublishedDrawAmount: row.WalletDrawFrozen,

  PublishStatus: row.IsPublished ? 'Published' : 'NotPublished',
  ProjectStatus: 'NotYetStarted',
  HasStageData: !!row.StageName,
  IsDeleted: false,
  IsCancelled: false,

  // ── General Information ──────────────────────────────────────────────────
  MYId: row.MYId ?? undefined,
  AlternateId: row.AlternateId ?? undefined,
  ExternalId: row.ExternalId ?? undefined,
  UACS: row.UACS ?? undefined,
  Tier: row.Tier,
  Rank: row.Rank ?? undefined,
  MYCAApprovalDate: row.MYCAApprovalDate,
  Description: row.Description ?? undefined,

  // ── Location Details ─────────────────────────────────────────────────────
  Province: row.Province ?? undefined,
  City: row.City ?? undefined,
  LegislativeDistrict: row.LegislativeDistrict ?? undefined,

  // ── Organizational Responsibilities ──────────────────────────────────────
  DEO: row.DEO ?? undefined,
  Region: row.Region ?? undefined,
  ImplementingOffice: row.ImplementingOffice ?? undefined,
  RegionWide: row.RegionWide,

  // ── Project Source ───────────────────────────────────────────────────────
  Origin: row.Origin,
  Agency: row.Agency,

  // ── Implementation Readiness and Modality ────────────────────────────────
  ImplementationMode: row.ImplementationMode ?? undefined,
  EmergencyMode: row.EmergencyMode ?? undefined,
  Feasibility: row.Feasibility ?? undefined,
  FeasibilityDate: row.FeasibilityDate,
  DetailedDesign: row.DetailedDesign ?? undefined,
  DetailedDesignDate: row.DetailedDesignDate,
  RowAvailable: row.RowAvailable ?? undefined,

  CreatedDate: row.CreatedDate,
  UpdatedDate: row.UpdatedDate ?? undefined,
});

export const mapApiBalance = (row: ApiLSWalletBalance): LSWalletBalance => ({
  WalletId: row.WalletId,
  Total: row.Total,
  Used: row.Used,
  Available: row.Available,
});
