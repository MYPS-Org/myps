import { Button } from '../../../../../components/tailwindui/button';
import { getRevisionActions } from './revisionActions';
import type { RevisionProjectPayload } from '../../../Model';

type Props = {
  mode: string;
  initialData?: RevisionProjectPayload;
  isRPCUser?: boolean;

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
    openEndorse: () => void;
  };
};

export const RevisionActionButtons = ({
  mode,
  initialData,
  isRPCUser,
  loading,
  actions,
}: Props) => {
  const actionsList = getRevisionActions({
    isEdit: mode === 'edit',
    actionRules: initialData?.ActionRules,
    currentStage: initialData?.RevisionDetails?.CurrentStage,
    isRPCUser,
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
