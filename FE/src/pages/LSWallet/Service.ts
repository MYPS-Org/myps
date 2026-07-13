// =============================================================================
// LSWallet Service.ts — all data access for the LSWallet module.
//
// MOCK/API SWAP SEAM:
//   Every function follows this structure:
//     1. A comment block shows the real httpClient.post<T>() call and endpoint.
//     2. The function body resolves from walletMockStore.ts instead.
//     3. Return value is always ApiResponse<T>-shaped: { Data, Status, Message? }
//
//   When the real backend is ready, replace the mock body with the commented
//   httpClient call — NO COMPONENT CHANGES REQUIRED.
//
// IMPORTANT: No component or hook may import from mockData/ directly.
//   All data access must go through this service file.
// =============================================================================

import type { ApiResponse } from '../../services/httpClient';
import type {
  LSWallet,
  ItemizedProject,
  ItemizedProjectRevision,
  LSWalletBalance,
  LSWalletPagination,
  DtoCreateWallet,
  DtoReplenishWallet,
  DtoCreateItemizedProject,
  DtoUpdateDrawAmount,
  DtoSubmitRevision,
  DtoReviewRevision,
  WalletStage,
} from './Model.d';
import * as store from './mockData/walletMockStore';
import { computeWalletBalance } from './utils/walletBalance';
import { defaultStore, syncWalletStoreAtom } from './store/walletStore';

// ---------------------------------------------------------------------------
// Helper: build an ApiResponse<T>-shaped mock response
// ---------------------------------------------------------------------------
const mockResponse = <T>(data: T): ApiResponse<T> => ({
  Data: data,
  Status: 200,
});

/** Push the updated store snapshot into Jotai so components re-render. */
const syncAtom = () => {
  defaultStore.set(syncWalletStoreAtom, store.getStoreSnapshot());
};

// ---------------------------------------------------------------------------
// 13-rule compliance check result type (WF-8)
// ---------------------------------------------------------------------------
export interface ComplianceRule {
  RuleName: string;
  Pass: boolean;
  FailReason?: string;
}

export interface PublishComplianceResult {
  Rules: ComplianceRule[];
  AllPassed: boolean;
}

// ---------------------------------------------------------------------------
// WF-1 / List / Detail
// ---------------------------------------------------------------------------

/**
 * Fetch paginated wallet list.
 *
 * REAL API SWAP:
 *   return httpClient.post<PaginationResponse<LSWallet>>(
 *     '/LSWallet/list',
 *     pagination,
 *     { preloaderMessage: 'Loading wallets...' }
 *   );
 */
export const fetchWalletList = async (
  pagination: LSWalletPagination
): Promise<ApiResponse<PaginationResponse<LSWallet>>> => {
  try {
    let wallets = store.getAllWallets().filter(w => !w.IsDeleted);

    // Apply filters if provided
    if (pagination.filters?.ProgramId) {
      wallets = wallets.filter(w => w.ProgramId === pagination.filters!.ProgramId);
    }
    if (pagination.filters?.CurrentStage) {
      wallets = wallets.filter(w => w.CurrentStage === pagination.filters!.CurrentStage);
    }
    if (pagination.filters?.OperatingUnit) {
      wallets = wallets.filter(w =>
        w.OperatingUnit.toLowerCase().includes(pagination.filters!.OperatingUnit!.toLowerCase())
      );
    }

    const total = wallets.length;
    const start = (pagination.page - 1) * pagination.limit;
    const page = wallets.slice(start, start + pagination.limit);

    return mockResponse<PaginationResponse<LSWallet>>({
      lists: page,
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (err) {
    console.error('fetchWalletList error:', err);
    throw err;
  }
};

/**
 * Fetch a single wallet by ID.
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWallet>(
 *     '/LSWallet/detail',
 *     { walletId: id },
 *     { preloaderMessage: 'Loading wallet...' }
 *   );
 */
export const fetchWalletById = async (id: number): Promise<ApiResponse<LSWallet>> => {
  try {
    const wallet = store.getWalletById(id);
    if (!wallet) throw new Error('Wallet not found.');
    return mockResponse(wallet);
  } catch (err) {
    console.error('fetchWalletById error:', err);
    throw err;
  }
};

/**
 * WF-1: Create a new wallet.
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWallet>(
 *     '/LSWallet/create',
 *     payload,
 *     { preloaderMessage: 'Creating wallet...' }
 *   );
 *   // Expected payload: DtoCreateWallet (array-based fundingProfiles + componentCosts)
 *   // Expected response: ApiResponse<LSWallet> (the created entity with all new fields)
 *   // NOTE: Amount in the response should equal SUM(fundingProfiles) — backend must
 *   // enforce the AMOUNT INVARIANT on its end as well.
 */
export const createWallet = async (
  payload: DtoCreateWallet,
  programName: string
): Promise<ApiResponse<LSWallet>> => {
  try {
    const created = store.createWallet(payload, programName);
    syncAtom();
    return mockResponse(created);
  } catch (err) {
    console.error('createWallet error:', err);
    throw err;
  }
};

/**
 * WF-3: Replenish (increase) the wallet's Amount.
 * Guard: newAmount must be strictly greater than current Amount.
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWallet>(
 *     '/LSWallet/replenish',
 *     payload,
 *     { preloaderMessage: 'Replenishing wallet...' }
 *   );
 *   // Expected payload: DtoReplenishWallet
 *   // Expected response: ApiResponse<LSWallet> (updated wallet)
 */
export const replenishWallet = async (
  payload: DtoReplenishWallet
): Promise<ApiResponse<LSWallet>> => {
  try {
    const updated = store.replenishWallet(payload.walletId, payload.newAmount, payload.updatedBy);
    syncAtom();
    return mockResponse(updated);
  } catch (err) {
    console.error('replenishWallet error:', err);
    throw err;
  }
};

/**
 * WF-7: Delete a wallet (tier-aware: hard / soft / blocked).
 *
 * Returns { tier, wallet } so the UI can show a tier-specific message.
 *
 * REAL API SWAP:
 *   return httpClient.post<{ tier: string; wallet: LSWallet }>(
 *     '/LSWallet/delete',
 *     { walletId, updatedBy },
 *     { preloaderMessage: 'Deleting wallet...' }
 *   );
 *   // The API should return the tier it applied so the UI can show the right message.
 */
export const deleteWallet = async (
  walletId: number,
  updatedBy: string
): Promise<ApiResponse<{ tier: 'hard' | 'soft' | 'blocked'; wallet: LSWallet | null }>> => {
  try {
    const wallet = store.getWalletById(walletId);
    if (!wallet) throw new Error('Wallet not found.');

    if (!wallet.HasStageData) {
      // Tier 1 — hard delete (brand new, untouched since creation)
      const deleted = store.hardDeleteWallet(walletId);
      syncAtom();
      return mockResponse({ tier: 'hard' as const, wallet: deleted });
    }

    const allProjects = store.getAllItemizedProjects();
    const activeOwnProjects = allProjects.filter(
      p => p.ParentWalletId === walletId && !p.IsDeleted && !p.IsCancelled
    );

    if (activeOwnProjects.length > 0) {
      // Tier 3 — blocked (has active itemized projects)
      return mockResponse({ tier: 'blocked' as const, wallet });
    }

    // Tier 2 — soft delete (has stage data, no active itemized projects)
    const softDeleted = store.softDeleteWallet(walletId, updatedBy);
    syncAtom();
    return mockResponse({ tier: 'soft' as const, wallet: softDeleted });
  } catch (err) {
    console.error('deleteWallet error:', err);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// WF-4 Itemized project operations
// ---------------------------------------------------------------------------

/**
 * Fetch all itemized projects for a wallet.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProject[]>(
 *     '/LSWallet/itemized-projects',
 *     { walletId },
 *     { preloaderMessage: 'Loading projects...' }
 *   );
 */
export const fetchItemizedProjectsByWalletId = async (
  walletId: number
): Promise<ApiResponse<ItemizedProject[]>> => {
  try {
    const projects = store.getItemizedProjectsByWalletId(walletId);
    return mockResponse(projects);
  } catch (err) {
    console.error('fetchItemizedProjectsByWalletId error:', err);
    throw err;
  }
};

/**
 * Option A validation check for WF-4 itemization (distinct error messages per the plan):
 *   "Wallet not found"           — wallet does not exist
 *   "Wallet must be at GAA-R"    — wallet stage is not GAA-R
 *   "Insufficient Wallet balance" — Available <= 0
 *
 * Returns { valid: true } or throws with the appropriate message.
 *
 * REAL API SWAP:
 *   return httpClient.post<{ valid: boolean; message?: string }>(
 *     '/LSWallet/validate-for-itemization',
 *     { walletId },
 *     { preloaderMessage: 'Validating wallet...' }
 *   );
 */
export const validateWalletForItemization = async (
  walletId: number
): Promise<ApiResponse<{ valid: boolean; message?: string }>> => {
  try {
    const wallet = store.getWalletById(walletId);
    if (!wallet) {
      return mockResponse({ valid: false, message: 'Wallet not found.' });
    }

    if (wallet.CurrentStage !== 'GAA-R') {
      return mockResponse({ valid: false, message: 'Wallet must be at GAA-R.' });
    }

    const allProjects = store.getAllItemizedProjects();
    const balance = computeWalletBalance(wallet, allProjects);
    if (balance.Available <= 0) {
      return mockResponse({ valid: false, message: 'Insufficient Wallet balance.' });
    }

    return mockResponse({ valid: true });
  } catch (err) {
    console.error('validateWalletForItemization error:', err);
    throw err;
  }
};

/**
 * WF-4: Create an itemized project linked to a wallet.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProject>(
 *     '/LSWallet/itemized-projects/create',
 *     payload,
 *     { preloaderMessage: 'Creating itemized project...' }
 *   );
 *   // Expected payload: DtoCreateItemizedProject
 *   // Expected response: ApiResponse<ItemizedProject>
 */
export const createItemizedProject = async (
  payload: DtoCreateItemizedProject
): Promise<ApiResponse<ItemizedProject>> => {
  try {
    const created = store.addItemizedProject(payload);
    syncAtom();
    return mockResponse(created);
  } catch (err) {
    console.error('createItemizedProject error:', err);
    throw err;
  }
};

/**
 * Update the live draw amount on an unpublished itemized project.
 * Post-publish edits are rejected by the mock store (use submitRevision instead).
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProject>(
 *     '/LSWallet/itemized-projects/update-draw',
 *     payload,
 *     { preloaderMessage: 'Updating draw amount...' }
 *   );
 *   // Expected payload: DtoUpdateDrawAmount
 */
export const updateItemizedProjectDraw = async (
  payload: DtoUpdateDrawAmount
): Promise<ApiResponse<ItemizedProject>> => {
  try {
    const updated = store.updateItemizedProjectDraw(
      payload.projectId,
      payload.newDrawAmount,
      payload.updatedBy
    );
    syncAtom();
    return mockResponse(updated);
  } catch (err) {
    console.error('updateItemizedProjectDraw error:', err);
    throw err;
  }
};

/**
 * WF-7: Delete an itemized project (tier-aware).
 *
 * REAL API SWAP:
 *   return httpClient.post<{ tier: string; project: ItemizedProject | null }>(
 *     '/LSWallet/itemized-projects/delete',
 *     { projectId, updatedBy },
 *     { preloaderMessage: 'Deleting project...' }
 *   );
 */
export const deleteItemizedProject = async (
  projectId: string
): Promise<ApiResponse<{ tier: 'hard' | 'soft' | 'blocked'; project: ItemizedProject | null }>> => {
  try {
    const project = store.getItemizedProjectById(projectId);
    if (!project) throw new Error('Itemized project not found.');

    if (project.PublishStatus === 'Published') {
      return mockResponse({ tier: 'blocked' as const, project });
    }

    if (project.HasStageData) {
      const softDeleted = store.softDeleteItemizedProject(projectId);
      syncAtom();
      return mockResponse({ tier: 'soft' as const, project: softDeleted });
    }

    const hardDeleted = store.hardDeleteItemizedProject(projectId);
    syncAtom();
    return mockResponse({ tier: 'hard' as const, project: hardDeleted });
  } catch (err) {
    console.error('deleteItemizedProject error:', err);
    throw err;
  }
};

/**
 * WF-8: Publish an itemized project.
 * Runs the mock 13-rule compliance check first.
 * On all-pass: freezes PublishedDrawAmount and flips status to Published.
 *
 * REAL API SWAP:
 *   return httpClient.post<{ complianceResult: PublishComplianceResult; project: ItemizedProject }>(
 *     '/LSWallet/itemized-projects/publish',
 *     { projectId },
 *     { preloaderMessage: 'Publishing project...' }
 *   );
 *   // The real API runs the 13 rules server-side and returns Pass/Fail per rule.
 *   // The real content of the 13 rules must be confirmed with the team before
 *   // backend wiring (see plan RISK note).
 */
export const publishItemizedProject = async (
  projectId: string
): Promise<ApiResponse<{ complianceResult: PublishComplianceResult; project: ItemizedProject | null }>> => {
  try {
    const project = store.getItemizedProjectById(projectId);
    if (!project) throw new Error('Itemized project not found.');

    const wallet = store.getWalletById(project.ParentWalletId);
    const allProjects = store.getAllItemizedProjects();
    const balance = wallet ? computeWalletBalance(wallet, allProjects) : null;

    // Mock 13-rule compliance check:
    // Rules 1–12: always pass (placeholder names — real rules TBD with team)
    // Rule 13: checks CurrentDrawAmount <= Available balance
    const rules: ComplianceRule[] = [
      { RuleName: 'R01 — Project ID format is valid', Pass: true },
      { RuleName: 'R02 — Category and Sub-category are populated', Pass: true },
      { RuleName: 'R03 — Operating Unit is assigned', Pass: true },
      { RuleName: 'R04 — Program association is active', Pass: true },
      { RuleName: 'R05 — Funding line is present and wallet-flagged', Pass: true },
      { RuleName: 'R06 — Funding percentage sums to 100%', Pass: true },
      { RuleName: 'R07 — Draw amount is greater than zero', Pass: project.CurrentDrawAmount > 0 },
      { RuleName: 'R08 — No duplicate project in same wallet', Pass: true },
      { RuleName: 'R09 — Project is not cancelled', Pass: !project.IsCancelled },
      { RuleName: 'R10 — Project is not soft-deleted', Pass: !project.IsDeleted },
      { RuleName: 'R11 — Wallet is not soft-deleted', Pass: wallet ? !wallet.IsDeleted : false },
      { RuleName: 'R12 — Wallet stage is GAA-R', Pass: wallet?.CurrentStage === 'GAA-R' },
      {
        RuleName: 'R13 — Draw amount does not exceed wallet Available balance',
        Pass: balance !== null && project.CurrentDrawAmount <= balance.Available,
        FailReason:
          balance !== null && project.CurrentDrawAmount > balance.Available
            ? `Draw (₱${project.CurrentDrawAmount.toLocaleString('en-PH')}) exceeds Available (₱${balance.Available.toLocaleString('en-PH')}).`
            : undefined,
      },
    ];

    const allPassed = rules.every(r => r.Pass);

    if (!allPassed) {
      return mockResponse({
        complianceResult: { Rules: rules, AllPassed: false },
        project: null,
      });
    }

    const published = store.publishItemizedProject(projectId);
    syncAtom();

    return mockResponse({
      complianceResult: { Rules: rules, AllPassed: true },
      project: published,
    });
  } catch (err) {
    console.error('publishItemizedProject error:', err);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// WF-6 Revision operations
// ---------------------------------------------------------------------------

/**
 * Fetch revision history for an itemized project.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProjectRevision[]>(
 *     '/LSWallet/revisions/list',
 *     { itemizedProjectId },
 *     { preloaderMessage: 'Loading revisions...' }
 *   );
 */
export const fetchWalletRevisions = async (
  itemizedProjectId: number
): Promise<ApiResponse<ItemizedProjectRevision[]>> => {
  try {
    const revisions = store.getRevisionsByItemizedProjectId(itemizedProjectId);
    return mockResponse(revisions);
  } catch (err) {
    console.error('fetchWalletRevisions error:', err);
    throw err;
  }
};

/**
 * Submit a new revision request (WF-6).
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProjectRevision>(
 *     '/LSWallet/revisions/submit',
 *     payload,
 *     { preloaderMessage: 'Submitting revision...' }
 *   );
 *   // Expected payload: DtoSubmitRevision
 */
export const submitRevision = async (
  payload: DtoSubmitRevision
): Promise<ApiResponse<ItemizedProjectRevision>> => {
  try {
    const revision = store.submitRevision(payload);
    return mockResponse(revision);
  } catch (err) {
    console.error('submitRevision error:', err);
    throw err;
  }
};

/**
 * Approve a revision at Region or CO level.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProjectRevision>(
 *     '/LSWallet/revisions/approve',
 *     payload,
 *     { preloaderMessage: 'Approving revision...' }
 *   );
 *   // Expected payload: DtoReviewRevision
 */
export const approveRevision = async (
  payload: DtoReviewRevision
): Promise<ApiResponse<ItemizedProjectRevision>> => {
  try {
    const updated = store.approveRevision(payload.revisionId, payload.stage);
    return mockResponse(updated);
  } catch (err) {
    console.error('approveRevision error:', err);
    throw err;
  }
};

/**
 * Reject (disapprove) a revision at Region or CO level.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProjectRevision>(
 *     '/LSWallet/revisions/reject',
 *     payload,
 *     { preloaderMessage: 'Rejecting revision...' }
 *   );
 */
export const rejectRevision = async (
  payload: DtoReviewRevision
): Promise<ApiResponse<ItemizedProjectRevision>> => {
  try {
    const updated = store.rejectRevision(payload.revisionId, payload.stage);
    return mockResponse(updated);
  } catch (err) {
    console.error('rejectRevision error:', err);
    throw err;
  }
};

/**
 * Return a revision for correction at Region or CO level.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProjectRevision>(
 *     '/LSWallet/revisions/return-for-review',
 *     payload,
 *     { preloaderMessage: 'Returning revision for correction...' }
 *   );
 */
export const returnRevisionForReview = async (
  payload: DtoReviewRevision
): Promise<ApiResponse<ItemizedProjectRevision>> => {
  try {
    const updated = store.returnRevisionForReview(payload.revisionId, payload.stage);
    return mockResponse(updated);
  } catch (err) {
    console.error('returnRevisionForReview error:', err);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// WF-2 Stage cascade (dev/demo only)
// ---------------------------------------------------------------------------

/**
 * Advance the stage for all wallets belonging to a Program.
 * This is a dev/demo simulation of the real stage advance (which is driven
 * by the Program module and cascades to wallets server-side).
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWallet[]>(
 *     '/LSWallet/advance-stage',
 *     { programId, newStage },
 *     { preloaderMessage: 'Advancing program stage...' }
 *   );
 *   // The real endpoint is likely triggered by the Program advance, not a
 *   // standalone LSWallet endpoint — adjust accordingly when wiring.
 */
export const advanceProgramStage = async (
  programId: string,
  newStage: WalletStage
): Promise<ApiResponse<LSWallet[]>> => {
  try {
    const updated = store.advanceProgramStage(programId, newStage);
    syncAtom();
    return mockResponse(updated);
  } catch (err) {
    console.error('advanceProgramStage error:', err);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Live balance helper (convenience wrapper — reads current atom state)
// ---------------------------------------------------------------------------

/**
 * Compute the current balance for a wallet.
 * This is a client-side computation, not an API call.
 * The real balance will come from the vLSWalletBalance view via the API.
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWalletBalance>(
 *     '/LSWallet/balance',
 *     { walletId },
 *     { preloaderMessage: 'Computing balance...' }
 *   );
 */
export const fetchWalletBalance = async (
  walletId: number
): Promise<ApiResponse<LSWalletBalance>> => {
  try {
    const wallet = store.getWalletById(walletId);
    if (!wallet) throw new Error('Wallet not found.');

    const allProjects = store.getAllItemizedProjects();
    const balance = computeWalletBalance(wallet, allProjects);
    return mockResponse(balance);
  } catch (err) {
    console.error('fetchWalletBalance error:', err);
    throw err;
  }
};
