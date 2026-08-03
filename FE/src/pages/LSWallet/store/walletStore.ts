// =============================================================================
// walletStore.ts — Jotai atoms for LSWallet module state
//
// ARCHITECTURE DECISION (for the next engineer):
// Service.ts functions update the underlying walletMockStore.ts arrays AND then
// call `getDefaultStore().set(walletDataAtom, getStoreSnapshot())` to push the
// change into the Jotai atom. This means:
//   - Components never import walletMockStore directly (only Service.ts does)
//   - Components read data via useAtomValue(walletDataAtom)
//   - After any mutation (create/delete/replenish/etc.), Service.ts flushes the
//     atom so all subscribed components re-render without a page reload
//
// When the real API lands, Service.ts will call the HTTP endpoint instead of
// the mock store, then update the atom from the API response — the atom and
// component layer stay unchanged.
//
// This pattern mirrors how rbiaAtoms.ts wraps paginated data in Jotai atoms and
// is consistent with the write-only action atoms in fieldPermissionStore.ts.
// =============================================================================

import { atom, getDefaultStore } from 'jotai';
import type { LSWallet, ItemizedProject } from '../Model.d';
import { getStoreSnapshot } from '../mockData/walletMockStore';

// ---------------------------------------------------------------------------
// Shape of the wallet data atom
// ---------------------------------------------------------------------------

export interface WalletStoreState {
  wallets: LSWallet[];
  itemizedProjects: ItemizedProject[];
}

// ---------------------------------------------------------------------------
// Primary atom — seeded from the mock store's initial snapshot
// ---------------------------------------------------------------------------

/**
 * walletDataAtom — holds the full wallet + itemized project state.
 * Seeded from walletSeedData (via walletMockStore's initial state) on first load.
 */
export const walletDataAtom = atom<WalletStoreState>(getStoreSnapshot());

// ---------------------------------------------------------------------------
// Derived atoms
// ---------------------------------------------------------------------------

/** Returns only non-deleted wallets for list display. */
export const activeWalletsAtom = atom((get) =>
  get(walletDataAtom).wallets.filter(w => !w.IsDeleted)
);

/** Returns all itemized projects (components read and filter as needed). */
export const itemizedProjectsAtom = atom((get) =>
  get(walletDataAtom).itemizedProjects
);

// ---------------------------------------------------------------------------
// Write-only action atom — called by Service.ts after each mutation
// ---------------------------------------------------------------------------

/**
 * Call this after any mutation to sync the Jotai atom with the mock store.
 * Usage in Service.ts: getDefaultStore().set(syncWalletStoreAtom, getStoreSnapshot())
 */
export const syncWalletStoreAtom = atom(
  null,
  (_get, set, snapshot: WalletStoreState) => {
    set(walletDataAtom, snapshot);
  }
);

// ---------------------------------------------------------------------------
// Convenience: expose the Jotai default store so Service.ts can write to atoms
// without needing a React component or Provider context.
// ---------------------------------------------------------------------------

/** Pre-resolved default store — used by Service.ts to push mutations into atoms. */
export const defaultStore = getDefaultStore();
