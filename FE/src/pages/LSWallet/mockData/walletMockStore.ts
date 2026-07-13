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
// All mutation functions return shallow copies of the mutated entity so callers
// never hold a reference to the live store arrays.
// =============================================================================

import type {
  LSWallet,
  ItemizedProject,
  ItemizedProjectRevision,
  WalletStage,
  WalletFundingProfile,
  DtoCreateWallet,
  DtoCreateItemizedProject,
  DtoSubmitRevision,
} from '../Model.d';
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
 * WF-4: Add an ItemizedProject to a wallet.
 * A single wallet-line FundingLine is auto-created with IsWalletLine = true.
 * Source/Agreement are pulled from the first non-deleted WalletFundingProfile.
 */
export const addItemizedProject = (dto: DtoCreateItemizedProject): ItemizedProject => {
  const wallet = _wallets.find(w => w.Id === dto.parentWalletId);
  if (!wallet) throw new Error('Parent wallet not found.');

  const projectId = `LS-W${String(dto.parentWalletId).padStart(3, '0')}-P${String(_nextProjectId).padStart(3, '0')}`;

  // Use the first non-deleted funding profile for the itemized project's funding line
  const primaryProfile = wallet.WalletFundingProfiles.find(p => !p.IsDeleted);

  const newProject: ItemizedProject = {
    Id: _nextProjectId++,
    ProjectId: projectId,
    ParentWalletId: dto.parentWalletId,
    ProjectType: 'LS',
    CategoryId: dto.categoryId,
    SubCategoryId: dto.subCategoryId,
    OperatingUnit: dto.operatingUnit,
    ProgramId: dto.programId,
    FundingLines: [
      {
        Id: Date.now(),
        Source: primaryProfile?.Source || '',
        Agreement: primaryProfile?.Agreement || '',
        Amount: dto.drawAmount,
        Percentage: 100,
        IsWalletLine: true,
      },
    ],
    ComponentCosts: [],
    CurrentDrawAmount: dto.drawAmount,
    PublishedDrawAmount: null,
    PublishStatus: 'NotPublished',
    ProjectStatus: 'NotYetStarted',
    HasStageData: false,
    IsDeleted: false,
    IsCancelled: false,
    CreatedDate: new Date().toISOString(),
  };

  _itemizedProjects.push(newProject);
  return { ...newProject };
};

/**
 * Update the live draw amount (pre-publish edit).
 * NOTE: This NEVER touches PublishedDrawAmount — that field is frozen at publish time.
 * Post-publish draws must go through the WF-6 revision workflow.
 */
export const updateItemizedProjectDraw = (
  projectId: string,
  newAmount: number,
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

  const updated: ItemizedProject = {
    ...project,
    CurrentDrawAmount: newAmount,
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
