import { Button } from '../tailwindui/button';
import { getRevisionActions } from './revisionActions';

type Props = {
  mode: string;
  userGroup?: string;
  initialData: any;
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

export const RevisionActionButtons = ({
  mode,
  userGroup,
  initialData,
  currentUserId,
  loading,
  actions,
}: Props) => {
  const actionsList = getRevisionActions({
    isEdit: mode === 'edit',
    userGroup,
    regionStatus: initialData?.RevisionDetails?.RegionStatus,
    coStatus: initialData?.RevisionDetails?.COStatus,
    isActive: initialData?.IsActive,
    isModify: initialData?.IsModify,
    stageId: initialData?.ProgramDetails?.StageId,
    createdBy: initialData?.RevisionDetails?.CreatedBy,
    currentUserId,
    loading,
    actions,
  });

  return (
    <div className="flex space-x-3">
      {actionsList
        .filter(a => a.show)
        .map((a, i) => (
          <Button
            key={i}
            color={a.color}
            disabled={a.loading}
            onClick={a.onClick}
          >
            {a.loading ? 'Processing...' : a.label}
          </Button>
        ))}
    </div>
  );
};
