import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import CheckCircleIcon from '@heroicons/react/24/outline/CheckCircleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { approveRevision } from '../Service';
import type { ItemizedProjectRevision } from '../Model.d';

interface ApproveRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (revision: ItemizedProjectRevision) => void;
  revision: ItemizedProjectRevision;
  stage: 'Region' | 'CO';
}

const ApproveRevisionDialog: React.FC<ApproveRevisionDialogProps> = ({
  open,
  onClose,
  onSuccess,
  revision,
  stage,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);

    try {
      const response = await approveRevision({
        revisionId: revision.Id,
        stage,
        reviewedBy: user?.UserId || '',
      });

      const updatedRevision = response.Data;
      onSuccess(updatedRevision);
      showToast({
        type: 'success',
        message: `Revision approved at ${stage} stage.`,
      });
      onClose();
    } catch (err) {
      console.error('Error approving revision:', err);
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      showToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stageLabel = stage === 'Region' ? 'Region' : 'Central Office';
  const currentStatus = stage === 'Region' ? revision.RegionStatus : revision.COStatus;

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Approve Revision
              </DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Warning Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">
                Are you sure you want to approve this revision at {stageLabel} level?
              </p>
              <p className="text-sm text-green-700 mt-2">
                This will update the revision status and advance it through the approval workflow.
              </p>
            </div>

            {/* Revision Information */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Revision Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Transaction ID:</span>
                  <p className="text-gray-600">{revision.TransactionId}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Current Stage:</span>
                  <p className="text-gray-600">{stageLabel}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Requested Cost:</span>
                  <p className="text-gray-600">
                    ₱{revision.RequestedCost.toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Current Status:</span>
                  <p className="text-gray-600">
                    {currentStatus === 0 && 'Pending'}
                    {currentStatus === 1 && 'Approved'}
                    {currentStatus === 2 && 'Disapproved'}
                    {currentStatus === 3 && 'For Review'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">Reason:</span>
                  <p className="text-gray-600">{revision.Reason}</p>
                </div>
                {revision.Notes && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Notes:</span>
                    <p className="text-gray-600">{revision.Notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
            <Button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              color="green"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Approving...' : 'Approve Revision'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ApproveRevisionDialog;
