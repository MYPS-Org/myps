// =============================================================================
// Lump Sum module constants
// =============================================================================

/**
 * Component type codes (tOptionProjectComponentType.ComponentId) that belong to
 * the Lump Sum module and MUST NOT appear in the regular Project component-type
 * dropdown (Project/dialogs/ComponentCostDialog.tsx).
 *
 * 'LS' is the Lump Sum component: holding one is what makes a project a Lump
 * Sum Project, and its cost IS the allocation that itemization draws down. A
 * user adding it to an ordinary project through the Projects form would create
 * something this module then lists and lets people itemize.
 *
 * If the backend adds further Lump Sum-exclusive component types, add them
 * here — ComponentCostDialog's filter picks them up automatically.
 */
export const LUMPSUM_EXCLUSIVE_COMPONENT_TYPES: string[] = ['LS'];

/**
 * The one component type a Lump Sum Project may hold
 * (tOptionProjectComponentType row 6: ComponentId 'LS', ComponentName 'Lump
 * Sum'). LumpSumComponentCostDialog pins Component Type and Component ID to it
 * rather than offering a choice — every other type is simply wrong here.
 *
 * Matched on the CODE, never on the display name: 'Lump Sum' is user-visible
 * text and could be reworded without anything breaking loudly.
 */
export const LUMPSUM_COMPONENT_ID = 'LS';

/**
 * The "with Revisions" stage — the only stage at which a Lump Sum Project's
 * allocation may be moved. Both Replenish and Import Itemized Projects are
 * gated on membership here.
 *
 * GAA-R ONLY (client's revised business rule, 2026-09-04). TF-R was previously
 * included; Trust Fund work is now out of scope for itemization. Keep this in
 * step with LumpsumController.RevisionStages — they are two halves of one rule.
 *
 * THIS IS A UX HINT, NOT THE RULE. LumpsumController.RevisionStages enforces
 * it; disabling a button early only saves a round trip.
 *
 * AND IT IS MEMBERSHIP, NOT A THRESHOLD. The wallet-era code ranked stages in a
 * hand-written STAGE_ORDER array and asked "is the stage at or after GAA?".
 * That array listed five of the database's twelve stages and omitted TF and
 * TF-R entirely, so indexOf returned -1 and Replenish rendered disabled on
 * every Trust Fund project. Ordering stages on the frontend is what caused
 * that; do not reintroduce it, even now that the set holds one value.
 */
export const REVISION_STAGES: readonly string[] = ['GAA-R'] as const;

/**
 * Is a program's latest revision Approved at a revision stage? The state in
 * which a Lump Sum Project can be neither created nor deleted, and its details
 * are read-only (2026-09-09 — and nothing more: Replenish, Import, Save and
 * the row-level Deletes stay allowed). Same two halves as the server's
 * ReadProgramApprovalAsync — the status NAME (vProgramLatest.Status is
 * "Approved" / "Working", never a code) and membership in REVISION_STAGES — so
 * the Add page's picker and the detail page agree with the server about which
 * programs are closed to creation. A UX hint like the rest of this file: the
 * server refuses Create and Delete on its own; the read-only details are the
 * page's rule alone.
 */
export const isProgramApproved = (status?: string | null, stage?: string | null): boolean =>
  (status ?? '').trim().toLowerCase() === 'approved' &&
  REVISION_STAGES.includes((stage ?? '').trim());
