// =============================================================================
// revisionStore.ts — Jotai atoms for ItemizedProject revision workflow (WF-6).
//
// Mirrors the Modification module's fieldPermissionStore.ts and routeContextStore.ts
// structure: simple primitive atoms + write-only action atoms for updates.
//
// Status code convention (matches Modification module's Region/CO codes):
//   0 = Pending
//   1 = Approved
//   2 = Disapproved
//   3 = ForReview (returned for correction)
// =============================================================================

import { atom } from 'jotai';
import type { ItemizedProjectRevision } from '../Model.d';

// ---------------------------------------------------------------------------
// Revision context atom
// Holds which ItemizedProject and revision is currently in view, avoiding
// prop-drilling through the revision dialog stack.
// Mirrors routeContextStore.ts's transactionIdAtom pattern.
// ---------------------------------------------------------------------------

export interface RevisionContext {
  itemizedProjectId: number | null;
  itemizedProjectProjectId: string | null;  // e.g. "LS-W001-P001"
  revisionId: number | null;
  transactionId: string | null;             // e.g. "LS-W001-P001-R001"
}

/**
 * Stores the revision currently being viewed/actioned.
 * Set by the component that opens a revision dialog.
 */
export const currentRevisionContextAtom = atom<RevisionContext>({
  itemizedProjectId: null,
  itemizedProjectProjectId: null,
  revisionId: null,
  transactionId: null,
});

// ---------------------------------------------------------------------------
// Revision status atoms
// Mirrors pcmaStatusAtom / packageStatusAtom from fieldPermissionStore.ts
// ---------------------------------------------------------------------------

/**
 * Region-level review status for the current revision.
 * 0=Pending, 1=Approved, 2=Disapproved, 3=ForReview
 */
export const regionStatusAtom = atom<0 | 1 | 2 | 3 | null>(null);

/**
 * Central Office review status for the current revision.
 * 0=Pending, 1=Approved, 2=Disapproved, 3=ForReview
 */
export const coStatusAtom = atom<0 | 1 | 2 | 3 | null>(null);

/** The full list of revisions for the currently viewed itemized project. */
export const revisionListAtom = atom<ItemizedProjectRevision[]>([]);

/** The single revision currently being actioned (approve/reject/return). */
export const activeRevisionAtom = atom<ItemizedProjectRevision | null>(null);

// ---------------------------------------------------------------------------
// Derived atoms
// ---------------------------------------------------------------------------

/** Whether a revision is pending Region-level review. */
export const isPendingRegionReviewAtom = atom(
  (get) => get(regionStatusAtom) === 0
);

/** Whether a revision is pending CO-level review. */
export const isPendingCOReviewAtom = atom(
  (get) => get(coStatusAtom) === 0
);

/** Whether the active revision has been returned for correction by anyone. */
export const isReturnedForCorrectionAtom = atom(
  (get) => get(regionStatusAtom) === 3 || get(coStatusAtom) === 3
);

// ---------------------------------------------------------------------------
// Write-only action atoms
// ---------------------------------------------------------------------------

/** Set the revision context (called when opening revision dialogs). */
export const setRevisionContextAtom = atom(
  null,
  (_get, set, context: RevisionContext) => {
    set(currentRevisionContextAtom, context);
  }
);

/** Set Region and CO status from a revision record (called after fetch). */
export const setRevisionStatusFromRevisionAtom = atom(
  null,
  (_get, set, revision: ItemizedProjectRevision) => {
    set(regionStatusAtom, revision.RegionStatus);
    set(coStatusAtom, revision.COStatus);
    set(activeRevisionAtom, revision);
  }
);

/** Reset all revision state (called when navigating away from a revision view). */
export const resetRevisionStateAtom = atom(null, (_get, set) => {
  set(currentRevisionContextAtom, {
    itemizedProjectId: null,
    itemizedProjectProjectId: null,
    revisionId: null,
    transactionId: null,
  });
  set(regionStatusAtom, null);
  set(coStatusAtom, null);
  set(revisionListAtom, []);
  set(activeRevisionAtom, null);
});
