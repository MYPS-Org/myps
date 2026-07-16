// =============================================================================
// LSWallet in-memory mock store.
//
// DEMO/DEV ONLY — this module is NOT persisted. Data resets on page refresh.
// It exists solely to let the frontend behave like a real API while the backend
// schema is being finalised.
//
// Access pattern:
//   - Only Service.ts may import from this module.
//   - No component or hook may import mockData/ directly.
//
// AMOUNT INVARIANT: wallet.Amount is ALWAYS derived as:
//   Amount = SUM(wallet.WalletFundingProfiles where !IsDeleted)
// Every mutation function that touches WalletFundingProfiles must call
// recomputeWalletAmount() afterwards. Never set Amount directly.
//
// DRAW AMOUNT INVARIANT: project.CurrentDrawAmount is ALWAYS derived as:
//   CurrentDrawAmount = SUM(project.FundingLines.Amount)
// updateItemizedProjectDraw() enforces this; never set CurrentDrawAmount directly.
//
// All mutation functions return shallow copies of the mutated entity so callers
// never hold a reference to the live store arrays.
// =============================================================================

import type {
  LSWallet,
  ItemizedProject,
  FundingLine,
  ItemizedProjectRevision,
  WalletStage,
  WalletFundingProfile,
  DtoCreateWallet,
  DtoImportItemizedProjects,
  DtoSubmitRevision,
} from '../Model.d';
import type {
  ComponentCost,
  ComponentCostPerYear,
  MajorItemOfWork,
  MajorItemLocations,
} from '../../Project/Model.d';
import {
  SEED_WALLETS,
  SEED_ITEMIZED_PROJECTS,
} from './walletSeedData';

// ---------------------------------------------------------------------------
// Mutable in-memory state (module-level — survives React renders, resets on HMR)
// ---------------------------------------------------------------------------

const _wallets: LSWallet[] = [...SEED_WALLETS.map(w => ({ ...w }))];
const _itemizedProjects: ItemizedProject[] = [
  ...SEED_ITEMIZED_PROJECTS.map(p => ({ ...p })),
];
const _revisions: ItemizedProjectRevision[] = [];
let _nextWalletId = 100;
let _nextProjectId = 200;
let _nextRevisionId = 300;
// Seed data has WalletFundingProfile IDs up to 3 and WalletComponentCost IDs up to 2
let _nextFundingProfileId = 10;
// Synthetic record IDs for imported sub-rows (FundingLines, ComponentCosts, etc.)
// Module-level so sequential across multiple importItemizedProjects() calls.
let _nextSyntheticId = 5000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recompute a wallet's Amount from its non-deleted funding profiles.
 * Must be called after any mutation to WalletFundingProfiles.
 */
const recomputeWalletAmount = (wallet: LSWallet): LSWallet => {
  const amount = wallet.WalletFundingProfiles
    .filter(p => !p.IsDeleted)
    .reduce((sum, p) => sum + p.Amount, 0);
  return { ...wallet, Amount: amount };
};

/**
 * Recalculate Percentage on each non-deleted profile so they sum to 100%.
 * Deleted profiles keep their existing Percentage value unchanged.
 */
const recalcPercentages = (profiles: WalletFundingProfile[]): WalletFundingProfile[] => {
  const totalAmount = profiles
    .filter(p => !p.IsDeleted)
    .reduce((sum, p) => sum + p.Amount, 0);

  return profiles.map(p => {
    if (p.IsDeleted) return p;
    const pct = totalAmount > 0 ? Math.round((p.Amount / totalAmount) * 10000) / 100 : 0;
    return { ...p, Percentage: pct };
  });
};

/**
 * Compute percentage fields on a FundingLine array so they sum to 100%.
 * Used by importItemizedProjects when building per-project FundingLines.
 */
const calcFundingLinePercentages = (lines: FundingLine[]): FundingLine[] => {
  const total = lines.reduce((sum, l) => sum + l.Amount, 0);
  return lines.map(l => ({
    ...l,
    Percentage: total > 0 ? Math.round((l.Amount / total) * 10000) / 100 : 0,
  }));
};

// ---------------------------------------------------------------------------
// Read helpers (return copies — callers should never mutate returned data)
// ---------------------------------------------------------------------------

export const getAllWallets = (): LSWallet[] =>
  _wallets.map(w => ({ ...w }));

export const getWalletById = (id: number): LSWallet | undefined => {
  const w = _wallets.find(x => x.Id === id);
  return w ? { ...w } : undefined;
};

export const getAllItemizedProjects = (): ItemizedProject[] =>
  _itemizedProjects.map(p => ({ ...p }));

export const getItemizedProjectsByWalletId = (walletId: number): ItemizedProject[] =>
  _itemizedProjects
    .filter(p => p.ParentWalletId === walletId)
    .map(p => ({ ...p }));

export const getItemizedProjectById = (projectId: string): ItemizedProject | undefined => {
  const p = _itemizedProjects.find(x => x.ProjectId === projectId);
  return p ? { ...p } : undefined;
};

export const getRevisionsByItemizedProjectId = (
  itemizedProjectId: number
): ItemizedProjectRevision[] =>
  _revisions
    .filter(r => r.ItemizedProjectId === itemizedProjectId)
    .map(r => ({ ...r }));

export const getRevisionById = (id: number): ItemizedProjectRevision | undefined => {
  const r = _revisions.find(x => x.Id === id);
  return r ? { ...r } : undefined;
};

// ---------------------------------------------------------------------------
// Wallet mutations
// ---------------------------------------------------------------------------

/**
 * WF-1: Create a new LSWallet from the new array-based DTO.
 *
 * Amount is computed from dto.fundingProfiles (AMOUNT INVARIANT) rather than
 * being taken directly from the DTO. ComponentType is always 'LS'.
 */
export const createWallet = (dto: DtoCreateWallet, programName: string): LSWallet => {
  const fundingProfiles = dto.fundingProfiles.map((p, i) => ({
    ...p,
    Id: _nextFundingProfileId + i,
    WalletId: _nextWalletId,
  }));
  _nextFundingProfileId += dto.fundingProfiles.length;

  const profilesWithPct = recalcPercentages(fundingProfiles);

  const newWalletRaw: LSWallet = {
    Id: _nextWalletId++,
    ProgramId: dto.programId,
    ProgramName: programName,
    TypeName: dto.typeName,
    YearStart: dto.yearStart,
    ProgramStageName: dto.programStageName,
    CategoryId: dto.categoryId,
    CategoryName: '',          // Caller should resolve from dropdown data
    SubCategoryId: dto.subCategoryId,
    SubCategoryName: '',       // Caller should resolve from dropdown data
    OperatingUnit: dto.operatingUnit,
    // AMOUNT INVARIANT: derived from funding profiles, not set directly
    Amount: 0,                 // Will be recomputed by recomputeWalletAmount below
    // Seed CurrentStage from the selected program's stage if provided; fall back to 'BP'.
    // advanceProgramStage() (WF-2) will bulk-update this field later for all wallets
    // belonging to the same program when the program stage advances.
    CurrentStage: (dto.currentStage as WalletStage) || 'BP',
    HasStageData: false,       // Brand new — untouched since creation (WF-7 hard-delete tier)
    ComponentType: 'LS',
    WalletFundingProfiles: profilesWithPct,
    WalletComponentCosts: dto.componentCosts.map((c, i) => ({
      ...c,
      Id: i + 1,
      WalletId: _nextWalletId - 1,
    })),
    WalletComponentCostPerYear: dto.componentCostPerYear.map((y, i) => ({
      ...y,
      Id: i + 1,
    })),
    // Optional project-details fields
    MYId: dto.myId,
    AlternateId: dto.alternateId,
    ExternalId: dto.externalId,
    UACS: dto.uacs,
    Tier: dto.tier,
    Rank: dto.rank,
    MYCAApprovalDate: dto.mycaApprovalDate,
    Description: dto.description,
    Province: dto.province,
    City: dto.city,
    LegislativeDistrict: dto.legislativeDistrict,
    DEO: dto.deo,
    Region: dto.region,
    ImplementingOffice: dto.implementingOffice,
    RegionWide: dto.regionWide,
    Origin: dto.origin,
    Agency: dto.agency,
    ImplementationMode: dto.implementationMode,
    EmergencyMode: dto.emergencyMode,
    Feasibility: dto.feasibility,
    FeasibilityDate: dto.feasibilityDate,
    DetailedDesign: dto.detailedDesign,
    DetailedDesignDate: dto.detailedDesignDate,
    RowAvailable: dto.rowAvailable,
    CreatedBy: dto.createdBy,
    CreatedDate: new Date().toISOString(),
    IsDeleted: false,
  };

  // Recompute Amount from profiles (enforces AMOUNT INVARIANT)
  const newWallet = recomputeWalletAmount(newWalletRaw);
  _wallets.push(newWallet);
  return { ...newWallet };
};

/**
 * WF-3: Replenish a wallet's budget by adding a new "Replenishment" funding line.
 *
 * Rather than mutating Amount directly, this adds a new WalletFundingProfile
 * (Source: 'Replenishment') sized to bring the total to newAmount, then
 * recomputes Amount = SUM(WalletFundingProfiles). The DtoReplenishWallet
 * contract (walletId, newAmount, updatedBy) is unchanged — ReplenishWalletDialog
 * needs no edits.
 *
 * Guard: newAmount must be strictly greater than the current Amount.
 * Throws with a descriptive message that Service.ts surfaces to the UI.
 */
export const replenishWallet = (walletId: number, newAmount: number, updatedBy: string): LSWallet => {
  const idx = _wallets.findIndex(w => w.Id === walletId);
  if (idx === -1) throw new Error('Wallet not found.');
  const wallet = _wallets[idx];

  if (newAmount <= wallet.Amount) {
    throw new Error(
      `Replenish amount must be greater than the current amount (₱${wallet.Amount.toLocaleString('en-PH')}). Decreases are not allowed.`
    );
  }

  const topupAmount = newAmount - wallet.Amount;

  const replenishLine: WalletFundingProfile = {
    Id: _nextFundingProfileId++,
    WalletId: walletId,
    Source: 'Replenishment',
    Agreement: '',
    Amount: topupAmount,
    Percentage: 0,   // Recalculated by recalcPercentages below
    CreatedBy: updatedBy,
    CreatedDate: new Date().toISOString(),
    IsDeleted: false,
  };

  const newProfiles = recalcPercentages([
    ...wallet.WalletFundingProfiles,
    replenishLine,
  ]);

  const updatedRaw: LSWallet = {
    ...wallet,
    WalletFundingProfiles: newProfiles,
    HasStageData: true, // Replenish only happens at GAA+, so the wallet now has history
    UpdatedBy: updatedBy,
    UpdatedDate: new Date().toISOString(),
  };

  // AMOUNT INVARIANT: recompute from profiles
  const updated = recomputeWalletAmount(updatedRaw);
  _wallets[idx] = updated;
  return { ...updated };
};

/**
 * WF-7 Soft delete: marks IsDeleted = true.
 * Returns the updated wallet (shallow copy).
 */
export const softDeleteWallet = (walletId: number, updatedBy: string): LSWallet => {
  const idx = _wallets.findIndex(w => w.Id === walletId);
  if (idx === -1) throw new Error('Wallet not found.');

  const updated: LSWallet = {
    ..._wallets[idx],
    IsDeleted: true,
    UpdatedBy: updatedBy,
    UpdatedDate: new Date().toISOString(),
  };
  _wallets[idx] = updated;
  return { ...updated };
};

/**
 * WF-7 Hard delete: removes the wallet from the store entirely.
 * Returns the deleted wallet snapshot (shallow copy).
 */
export const hardDeleteWallet = (walletId: number): LSWallet => {
  const idx = _wallets.findIndex(w => w.Id === walletId);
  if (idx === -1) throw new Error('Wallet not found.');

  const [deleted] = _wallets.splice(idx, 1);
  return { ...deleted };
};

// ---------------------------------------------------------------------------
// Itemized project mutations
// ---------------------------------------------------------------------------

/**
 * WF-4: Batch-import Excel-sourced itemized projects into a wallet.
 *
 * For each parsed project in dto.projects:
 *  1. Assigns a generated ProjectId: "LS-W{walletId}-P{_nextProjectId}"
 *  2. Builds FundingLines from the project's Excel funding profile rows.
 *     Percentages are computed from amounts. IsWalletLine has been removed —
 *     all lines represent real funding sources.
 *  3. Sets CurrentDrawAmount = SUM(FundingLines.Amount)  [DRAW AMOUNT INVARIANT]
 *  4. Builds ComponentCosts / ComponentCostPerYear by grouping parsed
 *     ImportedComponentCost rows by ComponentId. The generated ProjectId
 *     replaces the Excel placeholder ProjectId in every row.
 *  5. Builds MajorItemOfWorks / MajorItemLocations by grouping parsed
 *     ImportedMajorItem rows by ReferenceId.
 *  6. Copies project detail fields (MYId, ExternalId, UACS, Description,
 *     Province, City, LegislativeDistrict, DEO, Region, ImplementingOffice,
 *     OperatingUnit) directly from the Excel parsed data.
 *
 * NOTE (mock limitation): CategoryId and SubCategoryId cannot be resolved from
 * the Excel raw names (e.g. "MFO 2: ...") without a lookup table, so the wallet's
 * own values are used as placeholders. The real backend will resolve these names
 * to IDs server-side.
 *
 * Replaces the removed addItemizedProject() (single project + manual draw amount).
 */
export const importItemizedProjects = (dto: DtoImportItemizedProjects): ItemizedProject[] => {
  const wallet = _wallets.find(w => w.Id === dto.parentWalletId);
  if (!wallet) throw new Error('Parent wallet not found.');

  const created: ItemizedProject[] = [];
  const now = new Date().toISOString();

  for (const importedProject of dto.projects) {
    const numericId = _nextProjectId++;
    const projectId = `LS-W${String(dto.parentWalletId).padStart(3, '0')}-P${String(numericId).padStart(3, '0')}`;

    // ─── FundingLines ──────────────────────────────────────────────────────
    // Build from the parsed funding profile rows. Percentage is computed from
    // amount ratios. All lines contribute to CurrentDrawAmount.
    const rawLines: FundingLine[] = importedProject.FundingProfiles.map((fp) => ({
      Id: _nextSyntheticId++,      // module-level counter avoids cross-call collisions
      Source: fp.Source,
      Agreement: fp.Agreement,
      Amount: fp.Amount,
      Percentage: 0,               // computed below
    }));
    const fundingLines = calcFundingLinePercentages(rawLines);

    // DRAW AMOUNT INVARIANT: total = SUM(funding lines)
    const currentDrawAmount = fundingLines.reduce((sum, fl) => sum + fl.Amount, 0);

    // ─── ComponentCosts + ComponentCostPerYear ─────────────────────────────
    // Group by ComponentId: one ComponentCost per unique ComponentId,
    // one ComponentCostPerYear per ImportedComponentCost row.
    // The generated projectId replaces the Excel placeholder ProjectId.
    const costMap = new Map<string, ComponentCost>();
    const perYearRows: ComponentCostPerYear[] = [];

    for (const ic of importedProject.ComponentCosts) {
      const costId = `${projectId}-${ic.ComponentId}`;

      if (!costMap.has(costId)) {
        costMap.set(costId, {
          Id: _nextSyntheticId++,
          ProjectId: projectId,        // generated ID replaces Excel placeholder
          CostId: costId,
          ComponentType: ic.ComponentType,
          ComponentId: ic.ComponentId,
          Description: ic.Description,
          Total: 0,                    // accumulated below
          IsDeleted: false,
          CreatedBy: dto.createdBy,
          CreatedDate: now,
        });
      }
      costMap.get(costId)!.Total += ic.Total;

      perYearRows.push({
        Id: _nextSyntheticId++,
        ComponentCostId: costId,
        Amount: ic.Total,
        Year: ic.ActivityYear,
        StartDate: ic.StartDate ?? null,
        EndDate: ic.EndDate ?? null,
        IsDeleted: false,
        CreatedBy: dto.createdBy,
        CreatedDate: now,
      });
    }

    // ─── MajorItemOfWorks + MajorItemLocations ─────────────────────────────
    // Group by ReferenceId: one MajorItemOfWork per unique ReferenceId,
    // one MajorItemLocations per ImportedMajorItem row.
    const workMap = new Map<string, MajorItemOfWork>();
    const locations: MajorItemLocations[] = [];
    let fallbackRefCounter = 0;

    for (const mi of importedProject.MajorItemsOfWork) {
      // Use the Excel's Reference ID if present; generate one as fallback.
      const refId = mi.ReferenceId || `${projectId}-${mi.ComponentId}-${++fallbackRefCounter}`;

      if (!workMap.has(refId)) {
        workMap.set(refId, {
          Id: _nextSyntheticId++,
          ProjectId: projectId,
          ReferenceId: refId,
          ComponentId: mi.ComponentId,
          YearOfWork: mi.ActivityYear ?? 0,
          // WorkTypeId and InfraType require lookup resolution that the mock
          // cannot perform without the enum tables. The real API resolves these.
          WorkTypeId: 0,
          InfraType: '',
          TargetUnitId: 0,
          TargetUnit: mi.TargetUnit ?? '',
          CreatedBy: dto.createdBy,
          IsDeleted: false,
        });
      }

      locations.push({
        Id: _nextSyntheticId++,
        ParentId: refId,
        StageName: '',
        InfraId: mi.InfraId ?? '',
        DetailedScope: mi.DetailedScope ?? '',
        TargetUnitId: 0,
        TargetUnit: mi.TargetUnit ?? '',
        PhysicalTarget: mi.PhysicalTarget ?? null,
        Length: mi.Length ?? null,
        StartChainage: mi.StartChainage ?? 0,
        EndChainage: mi.EndChainage ?? 0,
        StartX: mi.StartX ?? 0,
        StartY: mi.StartY ?? 0,
        EndX: mi.EndX ?? null,
        EndY: mi.EndY ?? null,
        StartStationLimit: mi.StartStation ?? '',
        EndStationLimit: mi.EndStation ?? '',
        IsDeleted: false,
      });
    }

    // ─── Project detail fields ─────────────────────────────────────────────
    // Copy directly from the Excel parsed data (per plan: these come from the
    // Excel, not force-copied from the wallet).
    const d = importedProject.ProjectDetails;

    const newProject: ItemizedProject = {
      Id: numericId,
      ProjectId: projectId,
      ParentWalletId: dto.parentWalletId,
      ProjectType: 'LS',
      // CategoryId/SubCategoryId: mock limitation — wallet values used as placeholders
      // since the mock cannot resolve Excel category names to IDs. Real API resolves.
      CategoryId: wallet.CategoryId,
      SubCategoryId: wallet.SubCategoryId,
      // OperatingUnit comes from Excel directly (may differ from wallet's OU)
      OperatingUnit: d.OperatingUnit ?? wallet.OperatingUnit,
      ProgramId: dto.programId,
      FundingLines: fundingLines,
      ComponentCosts: Array.from(costMap.values()),
      ComponentCostPerYear: perYearRows,
      MajorItemOfWorks: Array.from(workMap.values()),
      MajorItemLocations: locations,
      // DRAW AMOUNT INVARIANT: computed from funding lines
      CurrentDrawAmount: currentDrawAmount,
      PublishedDrawAmount: null,
      PublishStatus: 'NotPublished',
      ProjectStatus: 'NotYetStarted',
      HasStageData: false,
      IsDeleted: false,
      IsCancelled: false,
      CreatedDate: now,
      // Project-detail parity fields from Excel
      MYId: d.MYId,
      // AlternateId is NOT used as the wallet-link field (ParentWalletId is).
      // Leave it undefined for imported projects; Excel doesn't carry this field.
      AlternateId: undefined,
      ExternalId: d.ExternalId,
      UACS: d.UACS,
      Description: d.Description,
      Province: d.Province,
      City: d.City,
      LegislativeDistrict: d.LegislativeDistrict,
      DEO: d.DEO,
      Region: d.Region,
      ImplementingOffice: d.ImplementingOffice,
      // Enum fields (Origin, Agency, ImplementationMode, etc.) require name-to-ID
      // resolution that the mock cannot perform. Leave undefined; real API resolves.
    };

    _itemizedProjects.push(newProject);
    created.push({ ...newProject });
  }

  return created;
};

/**
 * Update the funding lines and recompute draw amount (pre-publish edit).
 *
 * Accepts the full updated FundingLines array instead of a single numeric
 * amount. CurrentDrawAmount is recomputed as SUM(fundingLines.Amount) to
 * enforce the DRAW AMOUNT INVARIANT.
 *
 * NOTE: This NEVER touches PublishedDrawAmount — that field is frozen at
 * publish time. Post-publish draws must go through the WF-6 revision workflow.
 *
 * REAL API SWAP NOTE: Service.ts should destructure the DtoUpdateDrawAmount
 * payload and call this function as:
 *   store.updateItemizedProjectDraw(payload.projectId, payload.fundingLines, payload.updatedBy)
 */
export const updateItemizedProjectDraw = (
  projectId: string,
  fundingLines: FundingLine[],
  updatedBy?: string
): ItemizedProject => {
  const idx = _itemizedProjects.findIndex(p => p.ProjectId === projectId);
  if (idx === -1) throw new Error('Itemized project not found.');

  const project = _itemizedProjects[idx];
  if (project.PublishStatus === 'Published') {
    throw new Error(
      'Cannot edit draw amount directly on a published project. Use Request Revision (WF-6) instead.'
    );
  }

  // DRAW AMOUNT INVARIANT: recompute total from the new lines
  const newTotal = fundingLines.reduce((sum, fl) => sum + fl.Amount, 0);

  const updated: ItemizedProject = {
    ...project,
    FundingLines: fundingLines,
    CurrentDrawAmount: newTotal,
    UpdatedDate: new Date().toISOString(),
    ...(updatedBy ? { UpdatedDate: new Date().toISOString() } : {}),
  };
  _itemizedProjects[idx] = updated;
  return { ...updated };
};

/**
 * WF-7 Soft delete an itemized project.
 * Soft-deleting an unpublished project immediately frees its draw back to
 * Available (the balance formula excludes IsDeleted=true projects).
 */
export const softDeleteItemizedProject = (projectId: string): ItemizedProject => {
  const idx = _itemizedProjects.findIndex(p => p.ProjectId === projectId);
  if (idx === -1) throw new Error('Itemized project not found.');

  const updated: ItemizedProject = {
    ..._itemizedProjects[idx],
    IsDeleted: true,
    UpdatedDate: new Date().toISOString(),
  };
  _itemizedProjects[idx] = updated;
  return { ...updated };
};

/**
 * WF-7 Hard delete an itemized project (no stage data).
 * Removes the project entirely from the store.
 */
export const hardDeleteItemizedProject = (projectId: string): ItemizedProject => {
  const idx = _itemizedProjects.findIndex(p => p.ProjectId === projectId);
  if (idx === -1) throw new Error('Itemized project not found.');

  const [deleted] = _itemizedProjects.splice(idx, 1);
  return { ...deleted };
};

/**
 * WF-8 Publish an itemized project.
 *
 * OPEN-1 MOCK STAND-IN: In the real API, the snapshot mechanism that freezes
 * PublishedDrawAmount is handled server-side (exact mechanism unresolved as of
 * plan date 2026-07-09). Here we mimic it by capturing PublishedDrawAmount =
 * CurrentDrawAmount at the moment publishItemizedProject() is called.
 * This must be replaced with the actual API-returned value when backend is wired.
 */
export const publishItemizedProject = (projectId: string): ItemizedProject => {
  const idx = _itemizedProjects.findIndex(p => p.ProjectId === projectId);
  if (idx === -1) throw new Error('Itemized project not found.');

  const project = _itemizedProjects[idx];
  if (project.PublishStatus === 'Published') {
    throw new Error('Project is already published.');
  }

  const updated: ItemizedProject = {
    ...project,
    // OPEN-1: freeze the draw amount as the published snapshot
    PublishedDrawAmount: project.CurrentDrawAmount,
    PublishStatus: 'Published',
    UpdatedDate: new Date().toISOString(),
  };
  _itemizedProjects[idx] = updated;
  return { ...updated };
};

// ---------------------------------------------------------------------------
// Revision mutations
// ---------------------------------------------------------------------------

/** Submit a new revision request for a published itemized project (WF-6). */
export const submitRevision = (dto: DtoSubmitRevision): ItemizedProjectRevision => {
  // Count existing revisions for this project to generate revision number
  const existingCount = _revisions.filter(
    r => r.ItemizedProjectId === dto.itemizedProjectId
  ).length;

  const project = _itemizedProjects.find(p => p.Id === dto.itemizedProjectId);
  if (!project) throw new Error('Itemized project not found.');

  const revisionNumber = existingCount + 1;
  const transactionId = `${project.ProjectId}-R${String(revisionNumber).padStart(3, '0')}`;

  const revision: ItemizedProjectRevision = {
    Id: _nextRevisionId++,
    ItemizedProjectId: dto.itemizedProjectId,
    TransactionId: transactionId,
    RegionStatus: 0,  // Pending
    COStatus: 0,      // Pending
    Reason: dto.reason,
    Notes: dto.notes,
    RequestedCost: dto.requestedCost,
    CreatedBy: dto.createdBy,
    CreatedDate: new Date().toISOString(),
  };

  _revisions.push(revision);
  return { ...revision };
};

/** Approve a revision at Region or CO stage. */
export const approveRevision = (
  revisionId: number,
  stage: 'Region' | 'CO'
): ItemizedProjectRevision => {
  const idx = _revisions.findIndex(r => r.Id === revisionId);
  if (idx === -1) throw new Error('Revision not found.');

  const updated: ItemizedProjectRevision = {
    ..._revisions[idx],
    ...(stage === 'Region' ? { RegionStatus: 1 as const } : { COStatus: 1 as const }),
  };
  _revisions[idx] = updated;
  return { ...updated };
};

/** Disapprove a revision at Region or CO stage. */
export const rejectRevision = (
  revisionId: number,
  stage: 'Region' | 'CO'
): ItemizedProjectRevision => {
  const idx = _revisions.findIndex(r => r.Id === revisionId);
  if (idx === -1) throw new Error('Revision not found.');

  const updated: ItemizedProjectRevision = {
    ..._revisions[idx],
    ...(stage === 'Region' ? { RegionStatus: 2 as const } : { COStatus: 2 as const }),
  };
  _revisions[idx] = updated;
  return { ...updated };
};

/** Return a revision for correction at Region or CO stage. */
export const returnRevisionForReview = (
  revisionId: number,
  stage: 'Region' | 'CO'
): ItemizedProjectRevision => {
  const idx = _revisions.findIndex(r => r.Id === revisionId);
  if (idx === -1) throw new Error('Revision not found.');

  const updated: ItemizedProjectRevision = {
    ..._revisions[idx],
    ...(stage === 'Region' ? { RegionStatus: 3 as const } : { COStatus: 3 as const }),
  };
  _revisions[idx] = updated;
  return { ...updated };
};

// ---------------------------------------------------------------------------
// WF-2 Stage cascade (dev/demo simulation)
// ---------------------------------------------------------------------------

/**
 * Bulk-advance CurrentStage on every wallet whose ProgramId matches.
 * There is no per-wallet opt-out (stage advance is driven by Program, not Wallet).
 * Returns shallow copies of all updated wallets.
 */
export const advanceProgramStage = (
  programId: string,
  newStage: WalletStage
): LSWallet[] => {
  const updated: LSWallet[] = [];

  _wallets.forEach((wallet, idx) => {
    if (wallet.ProgramId === programId) {
      const updatedWallet: LSWallet = {
        ...wallet,
        CurrentStage: newStage,
        HasStageData: true, // A stage cascade is definitive evidence of progression
        UpdatedDate: new Date().toISOString(),
      };
      _wallets[idx] = updatedWallet;
      updated.push({ ...updatedWallet });
    }
  });

  return updated;
};

// ---------------------------------------------------------------------------
// Store snapshot helper (used by walletStore.ts to sync Jotai after mutations)
// ---------------------------------------------------------------------------

/** Returns a snapshot of the full store state (shallow copies of all items). */
export const getStoreSnapshot = () => ({
  wallets: _wallets.map(w => ({ ...w })),
  itemizedProjects: _itemizedProjects.map(p => ({ ...p })),
});
