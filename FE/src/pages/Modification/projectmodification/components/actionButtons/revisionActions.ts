// revisionActions.ts

import type { ActionRevisionRules } from '../../../Model';

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
  // Backend-computed gate (WebAPI RevisionController: ReviseProject/ViewReviseProject
  // ActionRules) — replaces the old FE-side AUC/RPC/DPC usergroup name checks.
  actionRules?: ActionRevisionRules;
  // ProjectStatus.RevisionStatus from the API, e.g. "For Approval" | "Approved" | "Disapproved" | "For Correction".
  // Only used here to pick the Submit vs Re-Submit label/handler — visibility itself comes from actionRules.
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
  const isForCorrection = normalizeStatus(revisionStatus) === 'forcorrection';
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
      show: isEdit && !!actionRules?.CanSubmit && !isForCorrection,
      color: 'green',
      label: 'Submit Revision Request',
      loading: loading.revise,
      onClick: () => actions.submit('new'),
    },
    {
      show: isEdit && !!actionRules?.CanApprove,
      color: 'green',
      label: 'Approve',
      loading: loading.approve,
      onClick: () => actions.openApprove(),
    },
    {
      show: isEdit && !!actionRules?.CanForCorrection,
      color: 'amber',
      label: 'For Correction',
      loading: loading.review,
      onClick: () => actions.openReview(),
    },
    {
      show: isEdit && !!actionRules?.CanApprove,
      color: 'red',
      label: 'Disapprove',
      loading: loading.reject,
      onClick: () => actions.openReject(),
    },
  ];
};
