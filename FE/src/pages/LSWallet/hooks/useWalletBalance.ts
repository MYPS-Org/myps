// =============================================================================
// useWalletBalance.ts — hook that computes live wallet balance from Jotai state
//
// Re-computes whenever walletDataAtom changes (i.e., after any mutation that
// calls syncWalletStoreAtom through Service.ts).
// =============================================================================

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { walletDataAtom } from '../store/walletStore';
import { computeWalletBalance } from '../utils/walletBalance';
import type { LSWalletBalance } from '../Model.d';

/**
 * Returns the live balance for a single wallet.
 * Memoized so computeWalletBalance only re-runs when the atom changes.
 *
 * @param walletId - The Id of the wallet to compute the balance for.
 * @returns LSWalletBalance or null if the wallet is not found.
 */
export const useWalletBalance = (walletId: number): LSWalletBalance | null => {
  const { wallets, itemizedProjects } = useAtomValue(walletDataAtom);

  return useMemo(() => {
    const wallet = wallets.find(w => w.Id === walletId);
    if (!wallet) return null;
    return computeWalletBalance(wallet, itemizedProjects);
  }, [wallets, itemizedProjects, walletId]);
};

/**
 * Returns balances for ALL active (non-deleted) wallets.
 * Useful for the LSWalletList page's summary row.
 */
export const useAllWalletBalances = (): LSWalletBalance[] => {
  const { wallets, itemizedProjects } = useAtomValue(walletDataAtom);

  return useMemo(
    () =>
      wallets
        .filter(w => !w.IsDeleted)
        .map(w => computeWalletBalance(w, itemizedProjects)),
    [wallets, itemizedProjects]
  );
};
