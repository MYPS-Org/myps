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
// Wallet-level delete tier logic (WF-7) — mirrors Service.ts's deleteWallet()
// Tier 1 — Hard delete: wallet itself has no stage data yet (brand new, untouched)
// Tier 2 — Soft delete: wallet has stage data, but no active itemized projects
// Tier 3 — Blocked:     wallet has stage data AND active itemized projects
// ---------------------------------------------------------------------------

type WalletDeleteTier = 'hard' | 'soft' | 'blocked';

export const resolveWalletDeleteTier = (
  wallet: LSWallet,
  itemizedProjects: ItemizedProject[]
): WalletDeleteTier => {
  if (!wallet.HasStageData) return 'hard';

  const activeOwnProjects = itemizedProjects.filter(
    p => p.ParentWalletId === wallet.Id && !p.IsDeleted && !p.IsCancelled
  );

  return activeOwnProjects.length > 0 ? 'blocked' : 'soft';
};

// ---------------------------------------------------------------------------
// Itemized project delete tier (WF-7)
// Tier 1 — Hard delete: project has no stage data (HasStageData = false)
// Tier 2 — Soft delete: project has stage data but is not published
// Tier 3 — Blocked:     project is published (PublishStatus === 'Published')
// ---------------------------------------------------------------------------

type ProjectDeleteTier = 'hard' | 'soft' | 'blocked';

export const resolveProjectDeleteTier = (project: ItemizedProject): ProjectDeleteTier => {
  if (project.PublishStatus === 'Published') return 'blocked';
  if (project.HasStageData) return 'soft';
  return 'hard';
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
  itemizedProjects,
  actions,
}: WalletActionParams): WalletAction[] => {
  const canReplenish = isStageAtOrAfter(wallet.CurrentStage, REPLENISH_ALLOWED_FROM_STAGE);
  const isAtGAARAndHasFunds =
    wallet.CurrentStage === 'GAA-R' && balance.Available > 0;
  const gaarReason =
    wallet.CurrentStage !== 'GAA-R'
      ? 'Wallet must be at GAA-R stage.'
      : 'No available balance remaining in this wallet.';

  const deleteTier = resolveWalletDeleteTier(wallet, itemizedProjects);
  const deleteDisabled = deleteTier === 'blocked';
  const deleteLabel =
    deleteTier === 'hard'
      ? 'Delete Wallet'
      : deleteTier === 'soft'
      ? 'Remove Wallet'
      : 'Delete Wallet';
  const deleteReason =
    deleteTier === 'blocked'
      ? 'Cannot delete: remove or cancel all itemized projects first.'
      : undefined;

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
      label: 'Add Itemized Project',
      disabled: !isAtGAARAndHasFunds,
      disabledReason: isAtGAARAndHasFunds ? undefined : gaarReason,
      onClick: actions.onAddItemizedProject,
    },

    // Delete — always shown; tier determines disabled state
    {
      show: true,
      color: 'red',
      label: deleteLabel,
      disabled: deleteDisabled,
      disabledReason: deleteReason,
      onClick: actions.onDelete,
    },

    // Advance Stage (dev/demo only — labeled clearly to avoid confusion)
    {
      show: true,
      color: 'zinc',
      label: '[Dev] Advance Program Stage',
      disabled: false,
      onClick: actions.onAdvanceStage,
    },
  ];
};

/**
 * Returns the declarative action config for an itemized project.
 * Consumer: WalletActionButtons.tsx (project action variant).
 */
export const getItemizedProjectActions = ({
  project,
  actions,
}: ItemizedProjectActionParams): ItemizedProjectAction[] => {
  const isPublished = project.PublishStatus === 'Published';
  const deleteTier = resolveProjectDeleteTier(project);
  const deleteDisabled = deleteTier === 'blocked';
  const deleteLabel =
    deleteTier === 'hard' ? 'Delete Project' : 'Remove Project';
  const deleteReason =
    deleteTier === 'blocked'
      ? 'Cannot delete a published project. Request a revision to cancel it.'
      : undefined;

  return [
    // Edit Draw — only visible/usable before publish
    {
      show: !isPublished,
      color: 'blue',
      label: 'Edit Draw Amount',
      disabled: false,
      onClick: actions.onEditDraw,
    },

    // Publish — shown only if not yet published
    {
      show: !isPublished,
      color: 'green',
      label: 'Publish',
      disabled: false,
      onClick: actions.onPublish,
    },

    // Request Revision — shown only after publish
    {
      show: isPublished,
      color: 'orange',
      label: 'Request Revision',
      disabled: false,
      onClick: actions.onRequestRevision,
    },

    // Delete — always shown, tier determines disabled state
    {
      show: true,
      color: 'red',
      label: deleteLabel,
      disabled: deleteDisabled,
      disabledReason: deleteReason,
      onClick: actions.onDelete,
    },
  ];
};
