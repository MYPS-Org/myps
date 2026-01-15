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
  {
    show: isEdit && userGroup === 'AUC' && regionStatus == null,
    color: 'green',
    label: 'Submit Revision Request to CO',
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
  {
    show: isEdit && isActive && (stageId !== 10 || isModify),
    color: 'orange',
    label: 'Update Project',
    loading: loading.update,
    onClick: actions.update,
  },
];
