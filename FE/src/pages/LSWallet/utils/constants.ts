// =============================================================================
// LSWallet module constants
// =============================================================================

/**
 * Component type codes (ComponentTypeEnum.ComponentId values) that are exclusive
 * to the LSWallet module and MUST NOT appear in the regular Project component-type
 * dropdown (ComponentCostDialog.tsx).
 *
 * The 'LS' code corresponds to the "Lump Sum" component type in the code tables.
 * See ComponentCostDialog.tsx for how this constant is applied to the filter.
 *
 * If the backend adds additional wallet-exclusive component types in the future,
 * add them to this array — the filtering logic in ComponentCostDialog.tsx will
 * pick them up automatically.
 */
export const WALLET_EXCLUSIVE_COMPONENT_TYPES: string[] = ['LS'];

/**
 * Ordered list of program stages (earliest → latest).
 * Used by getWalletActions() to determine whether a stage-gated action is
 * available (e.g., Replenish is allowed from GAA onwards).
 *
 * Changing REPLENISH_ALLOWED_FROM_STAGE tightens/loosens the replenish gate —
 * no other code needs to change (OPEN-2 from the plan).
 */
export const STAGE_ORDER: readonly string[] = [
  'BP',
  'NEP',
  'HGAB',
  'GAA',
  'GAA-R',
] as const;

/**
 * The earliest stage at which replenish is allowed (inclusive).
 * Plan OPEN-2: currently set to 'GAA' (and all later stages).
 * Change to 'GAA-R' to tighten to a single stage — one-line change.
 */
export const REPLENISH_ALLOWED_FROM_STAGE = 'GAA';
