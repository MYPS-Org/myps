// revisionActions.ts

import type { ActionRevisionRules } from '../../../Model';

// WebAPI RevisionController's ActionRules (ReviseProject/ViewReviseProject) only encodes role
// permission — CanApprove/CanForCorrection are true for any RPC or AUC user regardless of the
// revision's actual stage, and CanSubmit is just "not AUC". It does not know whether this specific
// transaction is currently pending that role's review, so FE still gates each button against the
// revision's actual stage — actionRules answers "is this role allowed to do this at all", stage
// answers "is it this transaction's turn".
//
// IMPORTANT — do NOT gate on ProjectStatus.RevisionStatus. Live-verified (Playwright against
// https://myps.eptisa-dev.com, 2026-08-19): ViewReviseProject's ProjectStatus object does not
// return a RevisionStatus field at all for an already-submitted transaction — only
// ConstructionStatus/PackageStatus come back. Gating on that field can never work.
//
// Use RevisionDetails.CurrentStage instead — it IS reliably present, computed server-side by the
// SQL function fRevisionDetail() from the live (correct) tRevisionApprovals/fRevisionApprovalStatus
// data, independent of the broken RevisionStatus/tOptionRevisionStatus lookup. Values: 'IO' | 'RO' |
// 'CO' | 'Disapproved' | 'Done'.
//
// One backend write-path bug still leaks through, DB-verified: RequestRevision leaves a
// freshly-submitted revision's RO/CO approval rows at raw status 0 ("Pending") instead of 1
// ("Submitted"), so fRevisionDetail's CASE reads that as CurrentStage 'IO' even though the
// revision has already left the IO's hands and is actually waiting on RO/CO. The only way to tell
// that case apart from a genuine "sent back to IO for correction" purely on the frontend is
// whether a correction event has ever actually been recorded (ForCorrectionsDetails). Until the
// write path is fixed on the backend: CurrentStage 'IO' with zero correction history is treated as
// "awaiting RO/CO", and 'IO' with at least one correction record is the real for-correction/
// resubmit case.
const normalizeStage = (stage?: string | null) => stage?.toLowerCase().trim() ?? '';

const STAGE_LABELS: Record<string, string> = {
  ro: 'For Approval',
  co: 'For Approval',
  disapproved: 'Disapproved',
  done: 'Approved',
};

// Human-facing label for the revision's current stage — use this instead of displaying
// RevisionDetails.CurrentStage or ProjectStatus.RevisionStatus verbatim.
export const getRevisionStageLabel = (currentStage?: string | null, forCorrectionsCount?: number): string => {
  if (!currentStage) return 'N/A';
  const stage = normalizeStage(currentStage);
  if (stage === 'io') {
    return (forCorrectionsCount ?? 0) > 0 ? 'For Correction' : 'For Approval';
  }
  return STAGE_LABELS[stage] ?? currentStage;
};

export type RevisionAction = {
  show: boolean | undefined;
  color: 'green' | 'orange' | 'amber' | 'red';
  label: string;
  loading?: boolean;
  onClick: () => void;
};

type Params = {
  isEdit: boolean;
  // Backend-computed role gate (WebAPI RevisionController: ReviseProject/ViewReviseProject
  // ActionRules) — replaces the old FE-side AUC/RPC/DPC usergroup name checks.
  actionRules?: ActionRevisionRules;
  // RevisionDetails.CurrentStage from ViewReviseProject ('IO' | 'RO' | 'CO' | 'Disapproved' | 'Done').
  // Absent means RevisionDetails itself wasn't returned, i.e. this revision hasn't been submitted yet
  // (ReviseProject, the start-a-new-revision endpoint, never returns a RevisionDetails object).
  currentStage?: string | null;
  // ForCorrectionsDetails?.length — see the CurrentStage 'IO' disambiguation note above.
  forCorrectionsCount?: number;
  createdBy?: string | null;
  currentUserId?: string | null;

  loading: {
    revise?: boolean;
    resubmit?: boolean;
    approve?: boolean;
    review?: boolean;
    reject?: boolean;
    update?: boolean;
  };

  actions: {
    submit: (type: 'new' | 'resubmit' | 'approve') => void;
    update: () => void;
    openApprove: () => void;
    openReview: () => void;
    openReject: () => void;
  };
};

export const getRevisionActions = ({
  isEdit,
  actionRules,
  currentStage,
  forCorrectionsCount,
  createdBy,
  currentUserId,
  loading,
  actions,
}: Params): RevisionAction[] => {
  const stage = normalizeStage(currentStage);
  const notYetSubmitted = !currentStage;
  const hasBeenReturnedForCorrection = (forCorrectionsCount ?? 0) > 0;
  const isForCorrection = stage === 'io' && hasBeenReturnedForCorrection;
  const isPendingApproval = stage === 'ro' || stage === 'co' || (stage === 'io' && !hasBeenReturnedForCorrection);
  const isOwnRevision = !!currentUserId && currentUserId === createdBy;

  return [
    {
      show: isEdit && !!actionRules?.CanSubmit && isForCorrection && isOwnRevision,
      color: 'green',
      label: 'Re-Submit Revision',
      loading: loading.resubmit,
      onClick: () => actions.submit('resubmit'),
    },
    {
      show: isEdit && !!actionRules?.CanSubmit && notYetSubmitted,
      color: 'green',
      label: 'Submit Revision Request',
      loading: loading.revise,
      onClick: () => actions.submit('new'),
    },
    {
      show: isEdit && !!actionRules?.CanApprove && isPendingApproval,
      color: 'green',
      label: 'Approve',
      loading: loading.approve,
      onClick: () => actions.openApprove(),
    },
    {
      show: isEdit && !!actionRules?.CanForCorrection && isPendingApproval,
      color: 'amber',
      label: 'For Correction',
      loading: loading.review,
      onClick: () => actions.openReview(),
    },
    {
      show: isEdit && !!actionRules?.CanApprove && isPendingApproval,
      color: 'red',
      label: 'Disapprove',
      loading: loading.reject,
      onClick: () => actions.openReject(),
    },
  ];
};
