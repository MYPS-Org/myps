// revisionActions.ts

import type { ActionRevisionRules } from '../../../Model';

// WebAPI RevisionController's ActionRules (ReviseProject/ViewReviseProject) only encodes role
// permission — CanApprove/CanForCorrection are true for any RPC or AUC user regardless of the
// revision's actual stage, and CanSubmit is just "not AUC". It does not know whether this specific
// transaction is currently pending that role's review, so FE still gates each button against
// ProjectStatus.RevisionStatus the same way it did before ActionRules existed — actionRules answers
// "is this role allowed to do this at all", revisionStatus answers "is it this transaction's turn".
//
// IMPORTANT — ProjectStatus.RevisionStatus is NOT the literal label it looks like. BE-verified
// (live tOptionRevisionStatus + RevisionController.cs, 2026): the code table backing this string
// was reseeded for a newer 6-state scheme (0 Pending/"not yet submitted", 1 Submitted, 2 ForApproval,
// 3 ForCorrection, 4 Approved, 5 Disapproved), but RequestRevision/UpdateRevisionStatus still write
// raw values using the OLD 4-state EnumRevisionStatus (Pending=0 meaning "awaiting review",
// Approved=1, Rejected=2, ForCorrection=3). Net effect on the string this endpoint actually returns:
//   "Pending"        -> really means "awaiting RO/CO review" (write path's Pending=0)
//   "Submitted"       -> really means CO Approved (write path wrote raw 1 for Approved)
//   "ForApproval"     -> really means CO Disapproved/Rejected (write path wrote raw 2 for Rejected)
//   "ForCorrection"   -> matches its label (raw 3 lines up in both schemes)
// This is a backend write-path bug (see WebAPI/Controllers/Revision/RevisionController.cs), not
// something to fix by relabeling the table — remap the *known* strings below until it's reconciled.
// Do not match "For Approval" here: the write path never produces that text.
const REVISION_STATUS_LABELS: Record<string, string> = {
  pending: 'For Approval',
  submitted: 'Approved',
  forapproval: 'Disapproved',
  forcorrection: 'For Correction',
};

const normalizeStatus = (status?: string | null) => status?.toLowerCase().replace(/\s+/g, '') ?? '';

// Human-facing label for ProjectStatus.RevisionStatus — use this instead of displaying the raw
// string, which reads backwards for Approved/Disapproved (see note above).
export const getRevisionStatusLabel = (status?: string | null): string => {
  const key = normalizeStatus(status);
  return REVISION_STATUS_LABELS[key] ?? (status || 'N/A');
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
  // ProjectStatus.RevisionStatus from the API, e.g. "For Approval" | "Approved" | "Disapproved" | "For Correction".
  // Absent/undefined means the revision hasn't been submitted yet.
  revisionStatus?: string | null;
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
  revisionStatus,
  createdBy,
  currentUserId,
  loading,
  actions,
}: Params): RevisionAction[] => {
  const status = normalizeStatus(revisionStatus);
  const notYetSubmitted = status === '';
  // "pending" is what the write path actually emits for "awaiting RO/CO review" — see the note
  // above REVISION_STATUS_LABELS. Do not match "forapproval" here: that string is only ever
  // reached once CO has already rejected the revision, and treating it as pending would let
  // Approve/Disapprove render again on an already-decided transaction.
  const isPendingApproval = status === 'pending';
  const isForCorrection = status === 'forcorrection';
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
