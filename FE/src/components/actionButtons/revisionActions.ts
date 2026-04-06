// revisionActions.ts

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
  regionStatus?: number | null;
  coStatus?: number | null;
  isActive?: boolean;
  isModify?: boolean;
  stageId?: number;
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
  regionStatus,
  coStatus,
  isActive,
  isModify,
  stageId,
  createdBy,
  currentUserId,
  loading,
  actions,
}: Params): RevisionAction[] => [
  // --- AUC ---
  {
    show: isEdit && userGroups?.find(g => g === 'AUC') && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to CO',
    loading: loading.revise,
    onClick: () => actions.submit('new'),
  },
  {
    show: isEdit && userGroups?.find(g => g === 'AUC') && coStatus == 0,
    color: 'green',
    label: 'Approve',
    loading: loading.approve,
    onClick: () => actions.submit('approve'),
  },
  {
    show: isEdit && userGroups?.find(g => g === 'AUC') && coStatus == 0,
    color: 'amber',
    label: 'For Correction',
    loading: loading.review,
    onClick: () => actions.openReview(),
  },
  {
    show: isEdit && userGroups?.find(g => g === 'AUC') && coStatus == 0,
    color: 'red',
    label: 'Disapprove',
    loading: loading.reject,
    onClick: () => actions.openReject(),
  },

  // --- RPC ---
  {
    show: isEdit && userGroups?.find(g => g === 'RPC') && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to CO',
    loading: loading.revise,
    onClick: () => actions.submit('new'),
  },
  {
    show: isEdit && userGroups?.find(g => g === 'RPC') && regionStatus == 0,
    color: 'green',
    label: 'Approve and Submit Revision to CO',
    loading: loading.approve,
    onClick: () => actions.openApprove(),
  },
  {
    show: isEdit && userGroups?.find(g => g === 'RPC') && regionStatus == 0,
    color: 'amber',
    label: 'For Correction',
    loading: loading.review,
    onClick: () => actions.openReview(),
  },
  {
    show: isEdit && userGroups?.find(g => g === 'RPC') && regionStatus == 0,
    color: 'red',
    label: 'Disapprove',
    loading: loading.reject,
    onClick: () => actions.openReject(),
  },

  // --- DPC ---
  {
    show: isEdit && userGroups?.find(g => g === 'DPC') && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to RO',
    loading: loading.revise,
    onClick: () => actions.submit('new'),
  },

  // --- Re-Submit: whoever created the revision resubmits it (any group) ---
  {
    show: isEdit && (regionStatus === 3 || coStatus === 3) && !!currentUserId && currentUserId === createdBy && !!userGroups?.length,
    color: 'green',
    label: 'Re-Submit Revision',
    loading: loading.resubmit,
    onClick: () => actions.submit('resubmit'),
  },

];
