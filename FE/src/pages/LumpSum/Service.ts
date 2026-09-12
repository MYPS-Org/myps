// =============================================================================
// Lump Sum Service.ts — ALL data access for the Lump Sum module.
//
// THERE IS NO MOCK LAYER. Every function below posts to a real endpoint on
// LumpsumController. The module previously shipped a 1,253-line mock store
// that 19 of 23 call sites resolved from, with the real httpClient call left
// commented above each body — so creating, saving, replenishing, deleting and
// importing had never once reached a server from this UI.
//
// THE THIRTEEN ACTIONS, AND NOTHING ELSE. There is no publish, no revision
// workflow, no stage cascade, no edit-draw and no "itemize an existing
// project": those features left the module, so the functions that called them
// are deleted rather than stubbed. A stub that resolves is worse than a
// missing export — it compiles, renders, and does nothing.
//
// IMPORTANT: this file is the only one in the module that touches httpClient.
// =============================================================================

import { httpClient } from '../../services/httpClient';
import type { ApiResponse } from '../../services/httpClient';
import type {
  ApiLumpSum,
  ApiLumpSumChild,
  ApiChildFundingLine,
  ApiLumpSumBalance,
  ApiLumpSumDetails,
} from './utils/apiMappers';
import {
  mapApiLumpSum,
  mapApiLumpSumChild,
  mapApiLumpSumDetails,
  mapApiBalance,
} from './utils/apiMappers';
import type {
  LumpSum,
  LumpSumFilter,
  LumpSumChild,
  LumpSumBalance,
  LumpSumFilterOptions,
  LumpSumActivityEvent,
  LumpSumItemizationCheck,
  LumpSumDeleteResult,
  DtoCreateLumpSum,
  DtoUpdateLumpSum,
  DtoReplenishLumpSum,
} from './Model.d';
import {
  defaultStore,
  syncLumpSumStoreAtom,
  lumpSumDataAtom,
} from './store/lumpSumStore';

// ---------------------------------------------------------------------------
// Atom hydration
//
// Components read the project out of lumpSumDataAtom rather than calling the
// service directly, so every read patches what it fetched back in. Patching by
// key rather than replacing wholesale means the list query does not throw away
// the child rows a detail fetch just loaded.
// ---------------------------------------------------------------------------

const patchStore = (patch: {
  lumpSums?: LumpSum[];
  balance?: LumpSumBalance;
  childrenOf?: { parentProjectId: string; children: LumpSumChild[] };
}) => {
  const base = defaultStore.get(lumpSumDataAtom);
  let { lumpSums, children, balances } = base;

  if (patch.lumpSums) {
    const incoming = new Map(patch.lumpSums.map((p) => [p.Id, p]));
    /*  Merge rather than overwrite: a list row carries no child arrays, and
        replacing a detail-loaded project with one would empty the edit form
        behind the user's back. */
    lumpSums = [
      ...lumpSums.map((existing) => {
        const fresh = incoming.get(existing.Id);
        if (!fresh) return existing;
        incoming.delete(existing.Id);
        return {
          ...existing,
          ...fresh,
          FundingProfiles: fresh.FundingProfiles ?? existing.FundingProfiles,
          ComponentCosts: fresh.ComponentCosts ?? existing.ComponentCosts,
          ComponentCostPerYear: fresh.ComponentCostPerYear ?? existing.ComponentCostPerYear,
        };
      }),
      ...incoming.values(),
    ];
  }

  if (patch.balance) {
    const b = patch.balance;
    balances = [...balances.filter((x) => x.LumpSumId !== b.LumpSumId), b];
  }

  if (patch.childrenOf) {
    const { parentProjectId, children: fresh } = patch.childrenOf;
    /*  Replaces this parent's children wholesale, so a row deleted server-side
        drops out instead of lingering. */
    children = [
      ...children.filter((c) => c.ParentProjectId !== parentProjectId),
      ...fresh,
    ];
  }

  defaultStore.set(syncLumpSumStoreAtom, { lumpSums, children, balances });
};

/** The Lump Sum Project currently in the atom, if any. */
const cached = (lumpSumId: number): LumpSum | undefined =>
  defaultStore.get(lumpSumDataAtom).lumpSums.find((p) => p.Id === lumpSumId);

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** InitFilterLumpSum — dropdown sources for the list filter bar. */
export const fetchLumpSumFilterOptions = async (): Promise<ApiResponse<LumpSumFilterOptions>> =>
  httpClient.post<LumpSumFilterOptions>(
    '/Lumpsum/InitFilterLumpSum',
    {},
    { preloaderMessage: 'Loading filters...' },
  );

/**
 * ShowLumpSum — the paged grid.
 *
 * KEYSET PAGINATION, AND THE WHOLE REQUEST HAS TO REACH THE SERVER (2026-09-10).
 * FilterDataCursor has no OFFSET: a request carries a Navigation mode and the
 * cursor that mode needs, and anything without one is treated as First and
 * answered with page 1. This used to send a bare `page: N` and nothing else,
 * which is why the list could never leave page 1 — so the request is spread
 * through verbatim and usePagination owns the cursors.
 *
 * Filters is projected explicitly rather than passed along: the controller
 * dereferences dto.Filters.ProgramFK with no null guard, so the key must be an
 * object on the wire even when nothing is filtered.
 */
export const fetchLumpSumList = async (
  request: PaginatedRequest<LumpSumFilter>,
): Promise<ApiResponse<PaginationResponse<LumpSum>>> => {
  const filters = request.Filters;
  const response = await httpClient.post<PaginationResponse<ApiLumpSum>>(
    '/Lumpsum/ShowLumpSum',
    {
      ...request,
      Filters: {
        ProgramFK: filters?.ProgramFK,
        ProgramName: filters?.ProgramName,
        CurrentStage: filters?.CurrentStage,
        OperatingUnit: filters?.OperatingUnit,
        CategoryId: filters?.CategoryId,
        YearStart: filters?.YearStart,
      },
      /*  Inert on this endpoint — the controller pins Id DESC and the cursor
          helper never reads it — but kept so the wire shape stays constant. */
      sortDirection: request.sortDirection ?? 0,
    },
    { preloaderMessage: 'Loading Lump Sum Projects...' },
  );

  const lists = (response.Data?.lists ?? []).map(mapApiLumpSum);

  // Feeds the atom so opening a row's detail page resolves the project.
  patchStore({ lumpSums: lists });

  return { ...response, Data: { ...response.Data, lists } };
};

/**
 * LumpSumDetails — one project with its balance and its child rows.
 *
 * This is what populates the edit form. A deep link or refresh straight onto
 * /lumpsum/:id never runs the list query, so this is the only thing that puts
 * the project in the atom on that path.
 */
export const fetchLumpSumById = async (
  lumpSumId: number,
  /*  BACKGROUND RE-READ (2026-09-08). The detail page refreshes the import lock on
      window focus and before each mutator, which must not flash the global
      preloader over a page the user is already reading, and must not toast if it
      fails — the last known state stays on screen instead. httpClient's `silent`
      does all three (preloader, success and error paths). Default is unchanged, so
      the mount fetch and the post-mutation re-reads below stay loud. */
  options?: { background?: boolean },
): Promise<ApiResponse<LumpSum>> => {
  const response = await httpClient.post<ApiLumpSumDetails>(
    '/Lumpsum/LumpSumDetails',
    { LumpSumId: lumpSumId },
    options?.background
      ? { silent: true }
      : { preloaderMessage: 'Loading Lump Sum Project...' },
  );

  const lumpSum = mapApiLumpSumDetails(response.Data);

  patchStore({ lumpSums: [lumpSum], balance: mapApiBalance(response.Data.Balance) });

  return { ...response, Data: lumpSum };
};

/**
 * LumpSumBalance — Total / Itemized / Remaining, recomputed server-side on
 * every read.
 *
 * There is no stored counter and no client-side mirror of the formula: the
 * wallet-era computeWalletBalance() summed the children's draws locally, which
 * is a second answer to a question the view already answers.
 */
export const fetchLumpSumBalance = async (
  lumpSumId: number,
): Promise<ApiResponse<LumpSumBalance>> => {
  const response = await httpClient.post<ApiLumpSumBalance>(
    '/Lumpsum/LumpSumBalance',
    { LumpSumId: lumpSumId },
    { preloaderMessage: 'Computing balance...' },
  );

  const balance = mapApiBalance(response.Data);
  patchStore({ balance });

  return { ...response, Data: balance };
};

/** ShowLumpSumActivity — the dated timeline, reconstructed from audit columns. */
export const fetchLumpSumActivity = async (
  lumpSumId: number,
): Promise<ApiResponse<{ Events: LumpSumActivityEvent[]; Count: number }>> =>
  httpClient.post<{ Events: LumpSumActivityEvent[]; Count: number }>(
    '/Lumpsum/ShowLumpSumActivity',
    { LumpSumId: lumpSumId },
    { preloaderMessage: 'Loading activity...' },
  );

/**
 * ShowItemizedProjects — the children of one Lump Sum Project.
 *
 * Scoped by PARENT PROJECT, so the caller passes the parent's Id and the
 * server resolves its ProjectId. The response carries the wallet-draw funding
 * lines as a sibling collection, which the mapper stitches onto each child.
 */
export const fetchItemizedProjects = async (
  lumpSumId: number,
  parentProjectId: string,
): Promise<ApiResponse<LumpSumChild[]>> => {
  const response = await httpClient.post<
    PaginationResponse<ApiLumpSumChild> & { FundingLines: ApiChildFundingLine[] }
  >(
    '/Lumpsum/ShowItemizedProjects',
    {
      Filters: { LumpSumId: lumpSumId },
      // The detail page renders the full set; 200 is the server's hard cap.
      limit: 200,
      page: 1,
      sortDirection: 0,
    },
    { preloaderMessage: 'Loading itemized projects...' },
  );

  const lines = response.Data?.FundingLines ?? [];
  const children = (response.Data?.lists ?? []).map((row) => mapApiLumpSumChild(row, lines));

  patchStore({ childrenOf: { parentProjectId, children } });

  return { ...response, Data: children };
};

/**
 * ValidateForItemization — may this project be itemized right now?
 *
 * Answers 200-shaped either way: { Valid: false, Message } is a REASON, not a
 * failure, and the import dialog renders it as one.
 */
export const validateForItemization = async (
  lumpSumId: number,
): Promise<ApiResponse<LumpSumItemizationCheck>> =>
  httpClient.post<LumpSumItemizationCheck>(
    '/Lumpsum/ValidateForItemization',
    { LumpSumId: lumpSumId },
    { preloaderMessage: 'Checking allocation...' },
  );

// ---------------------------------------------------------------------------
// Writes
//
// Each one re-reads the project it changed rather than patching the atom from
// the request. The allocation figures are computed by vLumpSumSet, so the only
// way to know what a write actually did is to ask.
// ---------------------------------------------------------------------------

/** CreateLumpSum. Returns the new project, already in the atom. */
export const createLumpSum = async (
  payload: DtoCreateLumpSum,
): Promise<ApiResponse<{ LumpSumId: number; LumpSumProject: ApiLumpSum }>> => {
  const response = await httpClient.post<{ LumpSumId: number; LumpSumProject: ApiLumpSum }>(
    '/Lumpsum/CreateLumpSum',
    payload,
    { preloaderMessage: 'Creating Lump Sum Project...' },
  );

  if (response.Data?.LumpSumProject) {
    patchStore({ lumpSums: [mapApiLumpSum(response.Data.LumpSumProject)] });
  }

  return response;
};

/**
 * UpdateLumpSum — the composite save: revision detail plus all three child sets.
 *
 * ONE REQUEST, ONE ANSWER (2026-09-10). The server answers with the whole
 * project in LumpSumDetails' shape, the child rows with their new Ids
 * included, so there is no second read to lose. Finding 2 of the 2026-09-10
 * review: this used to be two requests, and a second read that timed out after
 * the save had committed left the draft on screen as unsaved, one press from
 * being inserted again. The store is patched the same way a detail read patches
 * it, so the page and the widget hold what the server now holds.
 */
export const updateLumpSum = async (payload: DtoUpdateLumpSum): Promise<ApiResponse<LumpSum>> => {
  const response = await httpClient.post<ApiLumpSumDetails>(
    '/Lumpsum/UpdateLumpSum',
    payload,
    { preloaderMessage: 'Saving Lump Sum Project...' },
  );

  const lumpSum = mapApiLumpSumDetails(response.Data);
  patchStore({ lumpSums: [lumpSum], balance: mapApiBalance(response.Data.Balance) });

  return { ...response, Data: lumpSum };
};

/**
 * Did the server REFUSE, or did its answer never arrive?
 *
 * httpClient throws two shapes: its own ErrorResponse, with Status set, when the
 * server answered; and the raw transport error, with no Status, when it did
 * not. A refusal — any 4xx, including the 400 the interceptor relabels as 404
 * and a 409 Busy — means nothing was written and a form may keep its edits.
 * Anything else is an UNKNOWN OUTCOME: no answer at all, or a 5xx, which
 * UpdateLumpSum can return after its commit when the read-back throws. A form
 * must not resubmit on an unknown outcome; it reloads and looks.
 */
export const isServerRefusal = (err: unknown): boolean => {
  const status = (err as { Status?: unknown } | null)?.Status;
  return typeof status === 'number' && status >= 400 && status < 500;
};

/**
 * ReplenishLumpSum — raises the allocation by appending a funding line.
 *
 * NOT CALLED BY THE UI SINCE 2026-09-08. The Replenish dialog appends the line
 * to the form's local state and "Save Lump Sum Project" carries it through
 * updateLumpSum, so the page has one commit point. Kept as the API-level top-up
 * (ls-contract and ls-data-security specify it); nothing on a page imports it.
 */
export const replenishLumpSum = async (
  payload: DtoReplenishLumpSum,
): Promise<ApiResponse<LumpSum>> => {
  const response = await httpClient.post<{ Added: number }>(
    '/Lumpsum/ReplenishLumpSum',
    payload,
    { preloaderMessage: 'Replenishing...' },
  );

  const refreshed = await fetchLumpSumById(payload.LumpSumId);
  return { ...response, Data: refreshed.Data };
};

/**
 * DeleteLumpSum. The server decides hard, soft, or refused — the caller sends
 * the request and reports back whatever came out.
 */
export const deleteLumpSum = async (
  lumpSumId: number,
): Promise<ApiResponse<LumpSumDeleteResult>> => {
  const response = await httpClient.post<{ LumpSumId: number; Tier: string; Message: string }>(
    '/Lumpsum/DeleteLumpSum',
    { LumpSumId: lumpSumId },
    { preloaderMessage: 'Deleting Lump Sum Project...' },
  );

  const { lumpSums, children, balances } = defaultStore.get(lumpSumDataAtom);
  const gone = cached(lumpSumId);
  defaultStore.set(syncLumpSumStoreAtom, {
    lumpSums: lumpSums.filter((p) => p.Id !== lumpSumId),
    children: gone ? children.filter((c) => c.ParentProjectId !== gone.ProjectId) : children,
    balances: balances.filter((b) => b.LumpSumId !== lumpSumId),
  });

  return {
    ...response,
    Data: { Tier: response.Data?.Tier ?? '', Message: response.Data?.Message ?? '' },
  };
};

/**
 * DeleteItemizedProject — addressed by the child's ProjectPK.
 *
 * Deleting a child returns its whole cost to the parent's LS component, so the
 * parent is re-read: its Remaining has changed and the balance widget is
 * showing the old one.
 */
export const deleteItemizedProject = async (
  projectPK: string,
  parent: { lumpSumId: number; projectId: string },
): Promise<ApiResponse<LumpSumDeleteResult>> => {
  const response = await httpClient.post<{ ProjectId: string; Tier: string; Message: string }>(
    '/Lumpsum/DeleteItemizedProject',
    { ProjectId: projectPK },
    { preloaderMessage: 'Deleting itemized project...' },
  );

  await fetchLumpSumById(parent.lumpSumId);
  await fetchItemizedProjects(parent.lumpSumId, parent.projectId);

  return {
    ...response,
    Data: { Tier: response.Data?.Tier ?? '', Message: response.Data?.Message ?? '' },
  };
};

/** What a successful ImportItemizedProjects reports back. */
export interface LumpSumImportResult {
  Count: number;
  Itemized: number;
  Message: string;
  Title?: string;
  /** Non-blocking observations — duplicate Descriptions the import let through. */
  Notices?: string[];
  /*  WARNED ROWS WERE IMPORTED (2026-09-06). One line per row the validators
      warned on, in the Errors tab's format; the value behind an unreadable cell
      is stored blank, a wrong-but-readable one as typed. ReportFileName is the
      .txt saying the same thing durably — a tab is gone on the next refresh —
      fetched with downloadImportWarningReport. Null when nothing warned. */
  Warnings?: string[];
  WarningCount?: number;
  ReportFileName?: string | null;
  /*  REFUSED PROJECTS TRAVEL WITH A 200 (2026-09-06, per-project atomicity). A
      project that failed on any sheet is left out and described here — one line
      per row, plus the annotated workbook — while every other project in the
      workbook was imported. Empty when nothing was refused. RefusedCount is
      projects, not rows. */
  Errors?: string[];
  ErrorFileName?: string | null;
  RefusedCount?: number;
}

/**
 * The body of a 400 from ImportItemizedProjects when the WORKBOOK failed
 * validation (as opposed to a batch-level refusal such as "Insufficient
 * Balance", which carries Message/Title only). Errors is one line per failing
 * row; ErrorFileName is the annotated .xlsm, fetched via
 * downloadImportErrorWorkbook.
 */
export interface LumpSumImportRejection {
  Message?: string;
  Title?: string;
  Errors?: string[];
  ErrorFileName?: string;
}

/** Narrow an httpClient ErrorResponse's Data to the rejection shape, or null. */
export const asImportRejection = (error: unknown): LumpSumImportRejection | null => {
  const data = (error as { Data?: unknown } | null)?.Data;
  if (!data || typeof data !== 'object') return null;
  const body = data as LumpSumImportRejection;
  return Array.isArray(body.Errors) || typeof body.ErrorFileName === 'string' ? body : null;
};

/**
 * ImportItemizedProjects — the ONLY itemization path the module has.
 *
 * THE WORKBOOK IS THE REQUEST. The file is posted as-is (multipart) and the
 * server reads, gates and validates it with the Program importer's own code —
 * the browser's parse of the same file is a preview, nothing more. Mode 2 is
 * gone: a Lump Sum Project is itemized into NEW projects, never by attaching
 * an existing one, so there is no other call to make.
 */
export const importItemizedProjects = async (
  file: File,
  parentLumpSumId: number,
  programId: string,
  parentProjectId: string,
): Promise<ApiResponse<LumpSumImportResult>> => {
  const formData = new FormData();
  formData.append('File', file, file.name);
  formData.append('ParentLumpSumId', String(parentLumpSumId));
  formData.append('ProgramId', programId);

  const response = await httpClient.post<LumpSumImportResult>(
    '/Lumpsum/ImportItemizedProjects',
    formData,
    {
      // Force off the instance's default JSON Content-Type so axios doesn't
      // JSON.stringify the FormData — the browser fills in the multipart
      // boundary itself once this header is out of the way.
      headers: { 'Content-Type': 'multipart/form-data' },
      preloaderMessage: 'Importing itemized projects...',
    },
  );

  await fetchLumpSumById(parentLumpSumId);
  await fetchItemizedProjects(parentLumpSumId, parentProjectId);

  return response;
};

/**
 * The annotated error workbook a rejected import wrote — served by the
 * Importing module's own endpoint, since the file sits in its folder.
 */
export const downloadImportErrorWorkbook = async (
  fileName: string,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await httpClient.get<Blob>(
    '/Importing/DownloadImportFile',
    { fileName },
    { preloaderMessage: 'Downloading error workbook...', responseType: 'blob' },
  );
  return { blob: response.Data as Blob, filename: fileName };
};

/**
 * The warning report a successful-but-warned import wrote — same endpoint and
 * same folder as the error workbook, served as text/plain because of its
 * extension.
 */
export const downloadImportWarningReport = async (
  fileName: string,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await httpClient.get<Blob>(
    '/Importing/DownloadImportFile',
    { fileName },
    { preloaderMessage: 'Downloading warning report...', responseType: 'blob' },
  );
  return { blob: response.Data as Blob, filename: fileName };
};
