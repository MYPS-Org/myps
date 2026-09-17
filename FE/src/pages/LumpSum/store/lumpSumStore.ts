// =============================================================================
// lumpSumStore.ts — Jotai atoms for Lump Sum module state
//
// THE ATOM STARTS EMPTY. It used to be seeded from the mock store's snapshot,
// so the module rendered three fabricated projects before a single request had
// been made — and a real IDENTITY value could collide with a mock id. Anything
// on screen now came from the server or it is a bug.
//
// Service.ts owns every write: each read patches in what it fetched, and each
// mutation is followed by a re-read of the affected project rather than by a
// client-side guess at what the server did. That matters here more than usual
// because the allocation figures are computed by the view — a local edit to
// Remaining could disagree with the database and look authoritative.
// =============================================================================

import { atom, getDefaultStore } from 'jotai';
import type { LumpSum, LumpSumChild, LumpSumBalance } from '../Model.d';

export interface LumpSumStoreState {
  lumpSums: LumpSum[];
  /** Children of every project fetched so far, keyed by ParentProjectId. */
  children: LumpSumChild[];
  balances: LumpSumBalance[];
}

const EMPTY: LumpSumStoreState = { lumpSums: [], children: [], balances: [] };

/** The full Lump Sum state. Empty until a read fills it. */
export const lumpSumDataAtom = atom<LumpSumStoreState>(EMPTY);

/** Write-only: replaces the whole snapshot. Service.ts is the only caller. */
export const syncLumpSumStoreAtom = atom(
  null,
  (_get, set, snapshot: LumpSumStoreState) => {
    set(lumpSumDataAtom, snapshot);
  },
);

/**
 * Pre-resolved default store, so Service.ts can write to atoms without a React
 * component or Provider context.
 */
export const defaultStore = getDefaultStore();
