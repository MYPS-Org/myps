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

import { httpClient } from '../../services/httpClient';
import type { ApiResponse } from '../../services/httpClient';
import type {
  ApiLSWalletLatest,
  ApiLSWalletProjectSet,
  ApiLSWalletBalance,
} from './utils/apiMappers';
import {
  mapApiWalletToLSWallet,
  mapApiProjectToItemized,
  mapApiBalance,
} from './utils/apiMappers';
import type {
  LSWallet,
  ItemizedProject,
  ItemizedProjectRevision,
  LSWalletBalance,
  LSWalletPagination,
  DtoCreateWallet,
  DtoUpdateWallet,
  DtoReplenishWallet,
  DtoImportItemizedProjects,
  DtoUpdateDrawAmount,
  DtoSubmitRevision,
  DtoReviewRevision,
  WalletStage,
} from './Model.d';
import * as store from './mockData/walletMockStore';
import { computeWalletBalance } from './utils/walletBalance';
import { defaultStore, syncWalletStoreAtom, walletDataAtom } from './store/walletStore';

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
// Live-data hydration of walletDataAtom
//
// walletDataAtom is seeded from the mock store at import time, and components
// (LSWalletDetail, useWalletBalance) read the wallet out of it rather than
// calling the service directly. Now that the read endpoints are live, those
// components would look up a real wallet Id (10, 11, ...) in a mock-seeded
// atom and render "Wallet Not Found".
//
// So the read functions below push their API results into the atom, exactly as
// store/walletStore.ts prescribes: "Service.ts will call the HTTP endpoint
// instead of the mock store, then update the atom from the API response — the
// atom and component layer stay unchanged."
//
// The FIRST live response evicts the mock seed entirely, so fabricated rows can
// never sit alongside server rows (mock wallets use Id 1-3, which real
// IDENTITY values can reach).
// ---------------------------------------------------------------------------
let atomHydratedFromApi = false;

const patchStore = (patch: {
  wallets?: LSWallet[];
  projectsForWallet?: { walletId: number; projects: ItemizedProject[] };
}) => {
  const base = atomHydratedFromApi
    ? defaultStore.get(walletDataAtom)
    : { wallets: [], itemizedProjects: [] };
  atomHydratedFromApi = true;

  let { wallets, itemizedProjects } = base;

  if (patch.wallets) {
    const incoming = new Set(patch.wallets.map((w) => w.Id));
    wallets = [...wallets.filter((w) => !incoming.has(w.Id)), ...patch.wallets];
  }

  if (patch.projectsForWallet) {
    const { walletId, projects } = patch.projectsForWallet;
    itemizedProjects = [
      ...itemizedProjects.filter((p) => p.ParentWalletId !== walletId),
      ...projects,
    ];
  }

  defaultStore.set(syncWalletStoreAtom, { wallets, itemizedProjects });
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
 * Fetch paginated wallet list. LIVE — reads dbo.vLSWalletLatest.
 *
 * Keyset (cursor) pagination: the backend walks pages using the Id of the last
 * row it returned, so pass NextFilteredId/PreviousFilteredId straight back from
 * the previous response rather than computing an offset.
 */
export const fetchWalletList = async (
  pagination: LSWalletPagination
): Promise<ApiResponse<PaginationResponse<LSWallet>>> => {
  const payload = {
    Filters: {
      // LSWalletFilter.ProgramId carries the readable program key (ProgramFK).
      ProgramFK: pagination.filters?.ProgramId,
      CurrentStage: pagination.filters?.CurrentStage,
      OperatingUnit: pagination.filters?.OperatingUnit,
    },
    limit: pagination.limit,
    page: pagination.page,
    // 0 = Next, 1 = Previous — matches the C# PaginationDirection enum.
    Direction: 0,
  };

  const response = await httpClient.post<PaginationResponse<ApiLSWalletLatest>>(
    '/Lumpsum/ShowLumpsum',
    payload,
    { preloaderMessage: 'Loading wallets...' }
  );

  const lists = (response.Data?.lists ?? []).map(mapApiWalletToLSWallet);

  // Feed the atom so opening a row's detail page resolves the wallet.
  patchStore({ wallets: lists });

  return { ...response, Data: { ...response.Data, lists } };
};

/**
 * Fetch a single wallet by ID. LIVE — reads dbo.vLSWalletLatest + vLSWalletBalance.
 */
export const fetchWalletById = async (id: number): Promise<ApiResponse<LSWallet>> => {
  const response = await httpClient.post<{
    Wallet: ApiLSWalletLatest;
    Balance: ApiLSWalletBalance;
  }>('/Lumpsum/LumpsumDetails', { WalletId: id }, { preloaderMessage: 'Loading wallet...' });

  const wallet = mapApiWalletToLSWallet(response.Data.Wallet);

  // Deep-link / refresh straight onto /lumpsum/:id never runs the list query,
  // so this is what puts the wallet into the atom for LSWalletDetail.
  patchStore({ wallets: [wallet] });

  return { ...response, Data: wallet };
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
 * Update an existing wallet's full composite state (Program Details + Wallet Details +
 * Funding Profile + Component Cost). Mirrors the updateEntireProject pattern.
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWallet>(
 *     '/LSWallet/update',
 *     payload,
 *     { preloaderMessage: 'Updating wallet...' }
 *   );
 *   // Expected payload: DtoUpdateWallet (full replacement arrays + flat fields)
 *   // Expected response: ApiResponse<LSWallet> (updated entity with all recomputed fields)
 *   // NOTE: Amount in the response should equal SUM(non-deleted WalletFundingProfile.Amount)
 */
export const updateWallet = async (
  payload: DtoUpdateWallet,
  programName: string
): Promise<ApiResponse<LSWallet>> => {
  try {
    const updated = store.updateWallet(payload, programName);
    syncAtom();
    return mockResponse(updated);
  } catch (err) {
    console.error('updateWallet error:', err);
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
 * WF-7: Delete a wallet. The backend owns whether this ends up a hard or soft
 * delete and whether it's blocked (e.g. active itemized projects still attached) —
 * the caller just sends the request and handles success/error, same as
 * Program's deleteProgram() (see Program/Service.ts).
 *
 * REAL API SWAP:
 *   return httpClient.post<LSWallet>(
 *     '/LSWallet/delete',
 *     { walletId, updatedBy },
 *     { preloaderMessage: 'Deleting wallet...' }
 *   );
 */
export const deleteWallet = async (
  walletId: number,
  updatedBy: string
): Promise<ApiResponse<LSWallet | null>> => {
  try {
    const wallet = store.getWalletById(walletId);
    if (!wallet) throw new Error('Wallet not found.');

    const allProjects = store.getAllItemizedProjects();
    const activeOwnProjects = allProjects.filter(
      p => p.ParentWalletId === walletId && !p.IsDeleted && !p.IsCancelled
    );
    if (activeOwnProjects.length > 0) {
      throw new Error('Cannot delete: remove or cancel all itemized projects first.');
    }

    const deleted = store.deleteWallet(walletId, updatedBy);
    syncAtom();
    return mockResponse(deleted);
  } catch (err) {
    console.error('deleteWallet error:', err);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// WF-4 Itemized project operations
// ---------------------------------------------------------------------------

/**
 * Fetch all itemized projects for a wallet. LIVE — reads dbo.vLSWalletProjectSet.
 *
 * The view returns only ProjectType = 'LS' rows that still have a live revision,
 * so cancelled/deleted projects never appear. Cost-breakdown arrays are not
 * included by this endpoint — see mapApiProjectToItemized.
 */
export const fetchItemizedProjectsByWalletId = async (
  walletId: number
): Promise<ApiResponse<ItemizedProject[]>> => {
  const response = await httpClient.post<PaginationResponse<ApiLSWalletProjectSet>>(
    '/Lumpsum/ShowItemizedProjects',
    {
      Filters: { WalletId: walletId },
      // The detail page renders the full set; 200 is the backend's hard cap.
      limit: 200,
      page: 1,
      Direction: 0,
    },
    { preloaderMessage: 'Loading projects...' }
  );

  const projects = (response.Data?.lists ?? []).map(mapApiProjectToItemized);

  // Replaces this wallet's projects wholesale, so rows deleted server-side drop
  // out instead of lingering. Also what useWalletBalance recomputes from.
  patchStore({ projectsForWallet: { walletId, projects } });

  return { ...response, Data: projects };
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
 * WF-4: Batch-import Excel-sourced itemized projects into a wallet.
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProject[]>(
 *     '/LSWallet/itemized-projects/import',
 *     payload,
 *     { preloaderMessage: 'Importing itemized projects...' }
 *   );
 *   // Expected payload: DtoImportItemizedProjects
 *   // Expected response: ApiResponse<ItemizedProject[]>
 */
export const importItemizedProjects = async (
  payload: DtoImportItemizedProjects
): Promise<ApiResponse<ItemizedProject[]>> => {
  try {
    const created = store.importItemizedProjects(payload);
    syncAtom();
    return mockResponse(created);
  } catch (err) {
    console.error('importItemizedProjects error:', err);
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
      payload.fundingLines,
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
 * WF-7: Delete an itemized project. The backend owns whether this ends up a
 * hard or soft delete and whether it's blocked (e.g. already Published) —
 * the caller just sends the request and handles success/error, same as
 * Program's deleteProgram() (see Program/Service.ts).
 *
 * REAL API SWAP:
 *   return httpClient.post<ItemizedProject>(
 *     '/LSWallet/itemized-projects/delete',
 *     { projectId, updatedBy },
 *     { preloaderMessage: 'Deleting project...' }
 *   );
 */
export const deleteItemizedProject = async (
  projectId: string
): Promise<ApiResponse<ItemizedProject | null>> => {
  try {
    const project = store.getItemizedProjectById(projectId);
    if (!project) throw new Error('Itemized project not found.');

    if (project.PublishStatus === 'Published') {
      throw new Error('Cannot delete a published project. Request a revision to cancel it.');
    }

    const deleted = store.deleteItemizedProject(projectId);
    syncAtom();
    return mockResponse(deleted);
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
 * Fetch the current balance for a wallet. LIVE — reads dbo.vLSWalletBalance.
 *
 * Total/Used/Available are computed server-side on every read; there is no
 * stored counter, so the figures cannot drift out of sync with the projects.
 * computeWalletBalance() in utils/walletBalance.ts remains the client-side
 * mirror of this formula and is still used for optimistic UI updates.
 */
export const fetchWalletBalance = async (
  walletId: number
): Promise<ApiResponse<LSWalletBalance>> => {
  const response = await httpClient.post<ApiLSWalletBalance>(
    '/Lumpsum/WalletBalance',
    { WalletId: walletId },
    { preloaderMessage: 'Computing balance...' }
  );

  return { ...response, Data: mapApiBalance(response.Data) };
};
