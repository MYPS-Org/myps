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
  userGroup?: string;
  regionStatus?: number | null;
  coStatus?: number | null;
  isActive?: boolean;
  isModify?: boolean;
  stageId?: number;

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
  userGroup,
  regionStatus,
  coStatus,
  isActive,
  isModify,
  stageId,
  loading,
  actions,
}: Params): RevisionAction[] => [
  // --- AUC ---
  {
    show: isEdit && userGroup === 'AUC' && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to CO',
    loading: loading.revise,
    onClick: () => actions.submit('new'),
  },
  {
    show: isEdit && userGroup === 'AUC' && coStatus == 0,
    color: 'green',
    label: 'Approve',
    loading: loading.approve,
    onClick: () => actions.submit('approve'),
  },
  {
    show: isEdit && userGroup === 'AUC' && coStatus == 0,
    color: 'amber',
    label: 'For Correction',
    loading: loading.review,
    onClick: () => actions.openReview(),
  },
  {
    show: isEdit && userGroup === 'AUC' && coStatus == 0,
    color: 'red',
    label: 'Disapprove',
    loading: loading.reject,
    onClick: () => actions.openReject(),
  },

  // --- RPC ---
  {
    show: isEdit && userGroup === 'RPC' && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to CO',
    loading: loading.revise,
    onClick: () => actions.submit('new'),
  },
  {
    show: isEdit && userGroup === 'RPC' && regionStatus == 0,
    color: 'green',
    label: 'Approve and Submit Revision to CO',
    loading: loading.approve,
    onClick: () => actions.openApprove(),
  },
  {
    show: isEdit && userGroup === 'RPC' && regionStatus == 0,
    color: 'amber',
    label: 'For Correction',
    loading: loading.review,
    onClick: () => actions.openReview(),
  },
  {
    show: isEdit && userGroup === 'RPC' && regionStatus == 0,
    color: 'red',
    label: 'Disapprove',
    loading: loading.reject,
    onClick: () => actions.openReject(),
  },

  // --- DPC ---
  {
    show: isEdit && userGroup === 'DPC' && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to RO',
    loading: loading.revise,
    onClick: () => actions.submit('new'),
  },
  {
    show: isEdit && userGroup === 'DPC' && (regionStatus === 3 || coStatus === 3),
    color: 'green',
    label: 'Re-Submit Revision',
    loading: loading.resubmit,
    onClick: () => actions.submit('resubmit'),
  },

];
