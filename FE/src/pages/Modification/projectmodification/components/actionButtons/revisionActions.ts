// revisionActions.ts

import type { ActionRevisionRules } from '../../../Model';

// WebAPI RevisionController's ActionRules (ReviseProject/ViewReviseProject) only encodes role
// permission — CanApprove/CanForCorrection are true for any RPC or AUC user regardless of the
// revision's actual stage, and CanSubmit is just "not AUC". It does not know whether this specific
// transaction is currently pending that role's review, so FE still gates each button against
// ProjectStatus.RevisionStatus the same way it did before ActionRules existed — actionRules answers
// "is this role allowed to do this at all", revisionStatus answers "is it this transaction's turn".
const normalizeStatus = (status?: string | null) => status?.toLowerCase().replace(/\s+/g, '') ?? '';

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
  const isPendingApproval = status === 'forapproval';
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
