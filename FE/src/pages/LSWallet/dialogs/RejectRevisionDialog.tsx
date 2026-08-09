import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { rejectRevision } from '../Service';
import type { ItemizedProjectRevision } from '../Model.d';

interface RejectRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (revision: ItemizedProjectRevision) => void;
  revision: ItemizedProjectRevision;
  stage: 'Region' | 'CO';
}

const RejectRevisionDialog: React.FC<RejectRevisionDialogProps> = ({
  open,
  onClose,
  onSuccess,
  revision,
  stage,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleClose = () => {
    setRejectionReason('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rejectionReason.trim()) {
      showToast({
        type: 'error',
        message: 'Please provide a reason for rejecting this revision.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await rejectRevision({
        revisionId: revision.Id,
        stage,
        notes: rejectionReason.trim(),
        reviewedBy: user?.UserId || '',
      });

      const updatedRevision = response.Data;
      onSuccess(updatedRevision);
      showToast({
        type: 'success',
        message: `Revision rejected at ${stage} stage. The requester will be notified.`,
      });
      handleClose();
    } catch (err) {
      console.error('Error rejecting revision:', err);
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
    <Dialog open={open} onClose={handleClose} className="fixed z-10 inset-0 overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Reject Revision
              </DialogTitle>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6">
              {/* Warning Message */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium">
                  You are about to reject this revision at {stageLabel} level.
                </p>
                <p className="text-sm text-red-700 mt-2">
                  This action will decline the proposed changes and notify the requester. Please provide a clear reason for rejection.
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

              {/* Rejection Reason - Required */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  *Reason for Rejection
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this revision is being rejected..."
                  rows={5}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  Please provide a clear and detailed explanation for the rejection.
                </p>
              </div>

              {/* Confirmation Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> Once rejected, the requester will need to submit a new revision request if changes are still needed.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
              <Button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="red"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Revision'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default RejectRevisionDialog;
