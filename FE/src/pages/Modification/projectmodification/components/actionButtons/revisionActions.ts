// revisionActions.ts

// The API only exposes a single collapsed status string (ProjectStatus.RevisionStatus) — it does
// not distinguish "awaiting RPC (region) review" from "awaiting AUC (central office) review" (that
// split exists server-side as ApprovalStatus.ROStatus/COStatus but is never returned to the client).
// Until the API is extended to expose both, AUC and RPC share the same pending-approval gate below.
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
  userGroups?: string[];
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
  userGroups,
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

  return [
    // --- AUC ---
    {
      show: isEdit && !!userGroups?.find(g => g === 'AUC') && notYetSubmitted,
      color: 'green',
      label: 'Submit Revision Request to CO',
      loading: loading.revise,
      onClick: () => actions.submit('new'),
    },
    {
      show: isEdit && !!userGroups?.find(g => g === 'AUC') && isPendingApproval,
      color: 'green',
      label: 'Approve',
      loading: loading.approve,
      onClick: () => actions.submit('approve'),
    },
    {
      show: isEdit && !!userGroups?.find(g => g === 'AUC') && isPendingApproval,
      color: 'amber',
      label: 'For Correction',
      loading: loading.review,
      onClick: () => actions.openReview(),
    },
    {
      show: isEdit && !!userGroups?.find(g => g === 'AUC') && isPendingApproval,
      color: 'red',
      label: 'Disapprove',
      loading: loading.reject,
      onClick: () => actions.openReject(),
    },

    // --- RPC ---
    {
      show: isEdit && !!userGroups?.find(g => g === 'RPC') && notYetSubmitted,
      color: 'green',
      label: 'Submit Revision Request to CO',
      loading: loading.revise,
      onClick: () => actions.submit('new'),
    },
    {
      show: isEdit && !!userGroups?.find(g => g === 'RPC') && isPendingApproval,
      color: 'green',
      label: 'Approve and Submit Revision to CO',
      loading: loading.approve,
      onClick: () => actions.openApprove(),
    },
    {
      show: isEdit && !!userGroups?.find(g => g === 'RPC') && isPendingApproval,
      color: 'amber',
      label: 'For Correction',
      loading: loading.review,
      onClick: () => actions.openReview(),
    },
    {
      show: isEdit && !!userGroups?.find(g => g === 'RPC') && isPendingApproval,
      color: 'red',
      label: 'Disapprove',
      loading: loading.reject,
      onClick: () => actions.openReject(),
    },

    // --- DPC ---
    {
      show: isEdit && !!userGroups?.find(g => g === 'DPC') && notYetSubmitted,
      color: 'green',
      label: 'Submit Revision Request to RO',
      loading: loading.revise,
      onClick: () => actions.submit('new'),
    },

    // --- Re-Submit: whoever created the revision resubmits it (any group) ---
    {
      show: isEdit && isForCorrection && !!currentUserId && currentUserId === createdBy && !!userGroups?.length,
      color: 'green',
      label: 'Re-Submit Revision',
      loading: loading.resubmit,
      onClick: () => actions.submit('resubmit'),
    },
  ];
};
