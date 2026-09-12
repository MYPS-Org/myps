// =============================================================================
// lumpSumActions.ts — declarative action-button configuration for Lump Sum.
//
// Follows the same {show, color, label, disabled, disabledReason, onClick}[]
// shape as src/components/actionButtons/revisionActions.ts.
// LumpSumActionButtons.tsx is the single consumer.
// =============================================================================

import type { LumpSum, LumpSumLock, LumpSumProgramApproval } from '../Model.d';
import { REVISION_STAGES } from './constants';

/**
 * The one sentence every disabled control shows while an import holds the
 * parent. Shared by the action buttons, the Save button and the banner so the
 * three cannot drift.
 */
export const lockReason = (lock: LumpSumLock): string => {
  const since = new Date(lock.LockedDate);
  const time = Number.isNaN(since.getTime())
    ? ''
    : ` since ${since.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`;
  return `Being itemized by ${lock.LockedBy}${time}. Try again shortly.`;
};

/**
 * The one sentence for an action that would DISCARD the form's unsaved funding
 * changes. Import and Delete-child both re-read the parent on success, and the
 * re-read resets the form — so while a Replenish or a line removal is pending,
 * either one would silently throw it away. Shared by the action bar and the
 * per-child buttons so the two cannot drift.
 */
export const UNSAVED_FUNDING_REASON = 'Save or discard your funding changes first.';

/**
 * What an Approved program means for this page (rule revised 2026-09-09 by the
 * client): the money keeps moving, the project's identity does not.
 *
 * An Approved program at GAA-R is the stage where Lump Sum work actually
 * happens, so Replenish, Import Itemized Projects, Save, funding-line Delete
 * and deleting an itemized project all stay available — the first cut of this
 * gate froze the whole page and was wrong about the business. What approval
 * does close is the project's own record: its details and component are
 * read-only, the project cannot be deleted, and no new Lump Sum Project can be
 * created in the program.
 *
 * This sentence is the banner's and the read-only fields'; the Delete button
 * has its own below, because "read-only" does not explain a refused delete.
 */
export const approvedReason = (approval: LumpSumProgramApproval): string =>
  `Program '${approval.ProgramName}' is Approved at ${approval.StageName}. ` +
  "This project's details are read-only and it cannot be deleted while the program stays Approved.";

/** The one sentence for the one action approval still refuses on this page. */
export const approvedDeleteReason = (approval: LumpSumProgramApproval): string =>
  `Program '${approval.ProgramName}' is Approved at ${approval.StageName}. ` +
  'A Lump Sum Project cannot be deleted from an Approved program.';

/**
 * THE CLICK-TIME GATE (2026-09-09). A greyed button is only as fresh as the
 * page's last read, so before a dialog opens the page re-reads the parent and
 * refuses with the current reason — the import lock for every action, the
 * program's approval only where the server refuses on it, and unsaved funding
 * only where opening would go on to discard it. The BUILDERS below wrap every
 * onClick in this gate themselves, choosing the flags in the same branch that
 * greys the button, so the static reason and the click-time refusal come from
 * one predicate: a caller cannot forget the re-read, which is exactly how the
 * child Delete once lost it.
 */
export type ActionGate = (
  open: () => void | Promise<void>,
  opts?: { refuseWhenApproved?: boolean; refuseWhenDirty?: boolean },
) => Promise<void>;

export type LumpSumActionColor = 'green' | 'orange' | 'amber' | 'red' | 'blue' | 'zinc';

export interface LumpSumAction {
  show: boolean;
  color: LumpSumActionColor;
  label: string;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}

/**
 * Membership, not a threshold.
 *
 * The wallet-era code ranked stages in a hand-written STAGE_ORDER array and
 * asked "is this stage at or after GAA?". That array listed five of the
 * database's twelve stages and omitted TF and TF-R entirely, so indexOf
 * returned -1 and Replenish rendered disabled on every Trust Fund project —
 * which is what all the sample data is.
 */
const isRevisionStage = (stage: string): boolean => REVISION_STAGES.includes(stage);

export interface LumpSumActionParams {
  lumpSum: LumpSum;
  /** A fresh "being itemized" stamp disables every action with one reason. */
  lock?: LumpSumLock | null;
  /**
   * The form holds a Replenish or a line removal that has not been saved.
   * Disables Import (which would re-read the parent and discard it). Replenish
   * stays available — top-ups stack locally — and so does Delete Lump Sum,
   * which confirms and makes the pending change moot.
   */
  hasUnsavedFunding?: boolean;
  /**
   * The detail fetch has landed and the project's funding lines are in hand.
   * False while it is in flight, and after one that failed — the page still
   * renders from the cached list row, which carries no lines. Replenish must
   * wait: it sizes the top-up as `newTotal − current funded total`, and with no
   * lines that reads as zero, making the draft the whole new total.
   */
  fundingLinesLoaded?: boolean;
  /**
   * The program is Approved at GAA-R. Reaches **Delete Lump Sum Project alone**
   * (with approvedDeleteReason); Replenish and Import are deliberately
   * untouched — see approvedReason for the rule.
   */
  programApproval?: LumpSumProgramApproval | null;
  /** The page's click-time gate — see ActionGate. Absent only in tests. */
  gate?: ActionGate;
  /** Bare openers. The builder gates each one; do not wrap them yourself. */
  actions: {
    onReplenish: () => void;
    onImportItemizedProjects: () => void | Promise<void>;
    onDelete: () => void;
  };
}

export interface ItemizedProjectActionParams {
  /** Same meaning as on the parent: deleting a child re-reads the parent. */
  hasUnsavedFunding?: boolean;
  /**
   * Same stamp the parent's actions read. DeleteItemizedProject never reads it,
   * but it does take the parent's applock — so during a real import this button
   * blocks for the lock timeout and answers 409. Greying it names the reason up
   * front instead, exactly as the parent's buttons do.
   */
  lock?: LumpSumLock | null;
  /** The page's click-time gate — see ActionGate. */
  gate?: ActionGate;
  actions: {
    onDelete: () => void;
  };
}

/** No gate supplied (tests): open directly. */
const ungated: ActionGate = async (open) => { await open(); };

/**
 * The project-level actions.
 *
 * These are UX HINTS ONLY — the greying AND the click-time re-read. The server
 * decides: LumpsumController.RevisionStages enforces the stage gate and the
 * strictly-increasing replenish rule, AssertProgramNotApprovedAsync the
 * program-approval gate (Create and Delete alone), the applock the import
 * conflict. A disabled button and a refused click both save a round trip; they
 * do not make a decision.
 */
export const getLumpSumActions = ({
  lumpSum,
  lock = null,
  hasUnsavedFunding = false,
  fundingLinesLoaded = true,
  programApproval = null,
  gate = ungated,
  actions,
}: LumpSumActionParams): LumpSumAction[] => {
  // Replenish and Import share one gate: the project must be on a revision
  // stage. Import additionally needs something left to itemize.
  const onRevisionStage = isRevisionStage(lumpSum.CurrentStage);
  const stageReason =
    `Only available at ${REVISION_STAGES.join(' or ')}. ` +
    `This Lump Sum Project is at '${lumpSum.CurrentStage || '—'}'.`;
  const canImport = onRevisionStage && lumpSum.Remaining > 0;

  /*  An import in flight outranks every other reason: while it holds the
      parent, each of these would be answered 409 Busy by the server anyway
      (see LumpsumController.Locking.cs). Still a hint — the lock is the rule. */
  const busy = lock ? lockReason(lock) : undefined;

  /*  Precedence for Import: busy, then unsaved funding, then stage, then
      remaining. The dirty reason sits above the stage reason because it is the
      one the user can act on from this page, right now. */
  const dirty = hasUnsavedFunding ? UNSAVED_FUNDING_REASON : undefined;

  /*  THE APPROVAL REACHES ONE BUTTON ONLY (2026-09-09). Replenish and Import
      are exactly the work an Approved GAA-R program is for, so neither takes
      this reason; only Delete does, and it outranks busy because a program that
      has closed will not reopen in the moment "try again shortly" implies. */
  const approvedDelete = programApproval ? approvedDeleteReason(programApproval) : undefined;

  return [
    {
      show: true,
      color: 'orange',
      label: 'Replenish',
      disabled: !!busy || !fundingLinesLoaded || !onRevisionStage,
      disabledReason: busy
        ?? (fundingLinesLoaded
          ? (onRevisionStage ? undefined : stageReason)
          : "This project's funding lines have not loaded. Reload the page before replenishing."),
      // Lock only: a top-up is allowed on an Approved program.
      onClick: () => void gate(actions.onReplenish),
    },
    {
      show: true,
      color: 'green',
      label: 'Import Itemized Projects',
      disabled: !!busy || !!dirty || !canImport,
      disabledReason: busy ?? dirty ?? (!onRevisionStage
        ? stageReason
        : 'No allocation remaining in this Lump Sum Project.'),
      // Lock, and unsaved funding re-checked after the re-read — an import
      // re-reads the parent on success and would discard a draft made meanwhile.
      onClick: () => void gate(actions.onImportItemizedProjects, { refuseWhenDirty: true }),
    },
    // Delete — the server decides hard, soft or refused; clickable unless the
    // program is Approved or an import holds the parent. The one action whose
    // gate carries the approval, in the same branch that greys it.
    {
      show: true,
      color: 'red',
      label: 'Delete Lump Sum Project',
      disabled: !!approvedDelete || !!busy,
      disabledReason: approvedDelete ?? busy,
      onClick: () => void gate(actions.onDelete, { refuseWhenApproved: true }),
    },
  ];
};

/**
 * The per-child actions. Delete is the only one V2 ships.
 *
 * NOT gated by the program's approval (2026-09-09): children can be imported
 * into an Approved program, so an import mistake has to stay correctable, and
 * the delete returns the child's cost to the parent the same way Replenish adds
 * to it. It IS gated by the import stamp — see the `lock` prop.
 */
export const getItemizedProjectActions = ({
  hasUnsavedFunding = false,
  lock = null,
  gate = ungated,
  actions,
}: ItemizedProjectActionParams): LumpSumAction[] => {
  const busy = lock ? lockReason(lock) : undefined;
  return [
    {
      show: true,
      color: 'red',
      label: 'Delete Project',
      disabled: !!busy || hasUnsavedFunding,
      disabledReason: busy ?? (hasUnsavedFunding ? UNSAVED_FUNDING_REASON : undefined),
      // Lock and unsaved funding, never the approval: a child delete re-reads
      // the parent on success, and is allowed on an Approved program.
      onClick: () => void gate(actions.onDelete, { refuseWhenDirty: true }),
    },
  ];
};
