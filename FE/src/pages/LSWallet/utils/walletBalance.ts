// =============================================================================
// walletBalance.ts — pure balance computation for LSWallet
//
// FORMULA:
//   Total     = wallet.Amount
//   Used      = SUM of effective draw amounts for all ACTIVE itemized projects
//               belonging to this wallet, where "active" means:
//                 IsDeleted === false AND IsCancelled === false
//               and "effective draw amount" is:
//                 project.PublishedDrawAmount ?? project.CurrentDrawAmount
//
//   Available = Total - Used
//
// DRAW-SYNC LIFECYCLE (mirroring the eventual vLSWalletBalance SQL view):
//   Before publish  → draw flows live through CurrentDrawAmount.
//                     Any edit to CurrentDrawAmount is instantly reflected in Used.
//   After publish   → draw is frozen at PublishedDrawAmount (captured at WF-8).
//                     CurrentDrawAmount may diverge during a WF-6 revision cycle,
//                     but Used stays pinned at the frozen value until a new publish
//                     or revision approval updates the record.
//
// This function is intentionally free of side effects — it does not read any
// Jotai atoms, does not trigger re-renders, and can be unit-tested in isolation.
// =============================================================================

import type { LSWallet, ItemizedProject, LSWalletBalance } from '../Model.d';

/**
 * Compute Total / Used / Available for a wallet given its itemized projects.
 *
 * @param wallet           - The LSWallet record to compute the balance for.
 * @param itemizedProjects - ALL itemized projects in the store; this function
 *                           filters to the wallet's own projects internally.
 * @returns LSWalletBalance with WalletId, Total, Used, Available.
 */
export const computeWalletBalance = (
  wallet: LSWallet,
  itemizedProjects: ItemizedProject[]
): LSWalletBalance => {
  const total = wallet.Amount;

  const used = itemizedProjects
    .filter(
      p =>
        p.ParentWalletId === wallet.Id &&
        p.IsDeleted === false &&
        p.IsCancelled === false
    )
    .reduce((sum, p) => {
      // Post-publish: use the frozen snapshot; pre-publish: use the live amount
      const effectiveDraw = p.PublishedDrawAmount ?? p.CurrentDrawAmount;
      return sum + effectiveDraw;
    }, 0);

  return {
    WalletId: wallet.Id,
    Total: total,
    Used: used,
    Available: total - used,
  };
};
