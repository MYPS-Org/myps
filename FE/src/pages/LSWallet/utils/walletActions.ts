// =============================================================================
// walletActions.ts — declarative action-button configuration for LSWallet
//
// Follows the same {show, color, label, disabled, disabledReason, onClick}[]
// shape as src/components/actionButtons/revisionActions.ts.
// The WalletActionButtons.tsx component is the single consumer.
// =============================================================================

import type { LSWallet, ItemizedProject, LSWalletBalance } from '../Model.d';
import { STAGE_ORDER, REPLENISH_ALLOWED_FROM_STAGE } from './constants';

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type WalletActionColor = 'green' | 'orange' | 'amber' | 'red' | 'blue' | 'zinc';

export interface WalletAction {
  show: boolean;
  color: WalletActionColor;
  label: string;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}

export interface ItemizedProjectAction {
  show: boolean;
  color: WalletActionColor;
  label: string;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Helper: is the wallet's stage at or after a reference stage?
// ---------------------------------------------------------------------------

const isStageAtOrAfter = (currentStage: string, referenceStage: string): boolean => {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const referenceIdx = STAGE_ORDER.indexOf(referenceStage);
  if (currentIdx === -1 || referenceIdx === -1) return false;
  return currentIdx >= referenceIdx;
};

// ---------------------------------------------------------------------------
// Action params
// ---------------------------------------------------------------------------

export interface WalletActionParams {
  wallet: LSWallet;
  balance: LSWalletBalance;
  itemizedProjects: ItemizedProject[];
  actions: {
    onReplenish: () => void;
    onAddItemizedProject: () => void;
    onAddNewItemizedProject: () => void;
    onDelete: () => void;
    onAdvanceStage: () => void;  // dev/demo cascade simulation
  };
}

export interface ItemizedProjectActionParams {
  project: ItemizedProject;
  wallet: LSWallet;
  actions: {
    onPublish: () => void;
    onRequestRevision: () => void;
    onDelete: () => void;
    onEditDraw: () => void;
  };
}

// ---------------------------------------------------------------------------
// Main action factories
// ---------------------------------------------------------------------------

/**
 * Returns the declarative action config for a wallet.
 * Consumer: WalletActionButtons.tsx — filter .filter(a => a.show), then render.
 */
export const getWalletActions = ({
  wallet,
  balance,
  actions,
}: WalletActionParams): WalletAction[] => {
  const canReplenish = isStageAtOrAfter(wallet.CurrentStage, REPLENISH_ALLOWED_FROM_STAGE);
  const isAtGAARAndHasFunds =
    wallet.CurrentStage === 'GAA-R' && balance.Available > 0;
  const gaarReason =
    wallet.CurrentStage !== 'GAA-R'
      ? 'Wallet must be at GAA-R stage.'
      : 'No available balance remaining in this wallet.';

  return [
    // Replenish — shown if stage >= GAA
    {
      show: true,
      color: 'orange',
      label: 'Replenish',
      disabled: !canReplenish,
      disabledReason: canReplenish
        ? undefined
        : `Replenish is only available from ${REPLENISH_ALLOWED_FROM_STAGE} stage onwards.`,
      onClick: actions.onReplenish,
    },

    // Add Itemized Project — enabled only at GAA-R with available balance
    {
      show: true,
      color: 'green',
      label: 'Import Itemized Project',
      disabled: !isAtGAARAndHasFunds,
      disabledReason: isAtGAARAndHasFunds ? undefined : gaarReason,
      onClick: actions.onAddItemizedProject,
    },

    {
      show: true,
      color: 'blue',
      label: 'Add Itemized Project',
      disabled: isAtGAARAndHasFunds,
      disabledReason: isAtGAARAndHasFunds ? undefined : gaarReason,
      onClick: actions.onAddNewItemizedProject,
    },

    // Delete — the backend decides whether it's allowed; always clickable here
    {
      show: true,
      color: 'red',
      label: 'Delete Wallet',
      disabled: false,
      onClick: actions.onDelete,
    },
  ];
};

/**
 * Returns the declarative action config for an itemized project.
 * Consumer: WalletActionButtons.tsx (project action variant).
 */
export const getItemizedProjectActions = ({
  actions,
}: ItemizedProjectActionParams): ItemizedProjectAction[] => {
  return [
    // Delete — the backend decides whether it's allowed; always clickable here
    {
      show: true,
      color: 'red',
      label: 'Delete Project',
      disabled: false,
      onClick: actions.onDelete,
    },
  ];
};
