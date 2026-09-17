// =============================================================================
// useLumpSumBalance.ts — read a Lump Sum Project's balance out of the atom.
//
// IT READS; IT DOES NOT COMPUTE. The wallet-era hook called
// computeWalletBalance() over the itemized projects held in state, which is a
// second, client-side answer to a question dbo.vLumpSumBalance already
// answers — and one that silently disagreed whenever the client's copy of the
// children was stale. The figures here are the server's, put in the atom by
// Service.fetchLumpSumById / fetchLumpSumBalance.
//
// Returns null when the project's balance has not been fetched yet. Null means
// "not loaded", never "zero" — rendering ₱0.00 for an unloaded project reads
// as a fully-itemized one.
// =============================================================================

import { useAtomValue } from 'jotai';
import { lumpSumDataAtom } from '../store/lumpSumStore';
import type { LumpSumBalance } from '../Model.d';

export const useLumpSumBalance = (lumpSumId: number): LumpSumBalance | null =>
  useAtomValue(lumpSumDataAtom).balances.find((b) => b.LumpSumId === lumpSumId) ?? null;
