import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { returnRevisionForReview } from '../Service';
import type { ItemizedProjectRevision } from '../Model.d';

interface ReturnRevisionForReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (revision: ItemizedProjectRevision) => void;
  revision: ItemizedProjectRevision;
  stage: 'Region' | 'CO';
}

const ReturnRevisionForReviewDialog: React.FC<ReturnRevisionForReviewDialogProps> = ({
  open,
  onClose,
  onSuccess,
  revision,
  stage,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewComments, setReviewComments] = useState('');

  const handleClose = () => {
    setReviewComments('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reviewComments.trim()) {
      showToast({
        type: 'error',
        message: 'Please provide review comments explaining what needs to be changed.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await returnRevisionForReview({
        revisionId: revision.Id,
        stage,
        notes: reviewComments.trim(),
        reviewedBy: user?.UserId || '',
      });

      const updatedRevision = response.Data;
      onSuccess(updatedRevision);
      showToast({
        type: 'success',
        message: `Revision returned for review at ${stage} stage. The requester will be notified.`,
      });
      handleClose();
    } catch (err) {
      console.error('Error returning revision for review:', err);
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
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Return Revision for Review
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 font-medium">
                  This revision requires additional assessment or changes at {stageLabel} level.
                </p>
                <p className="text-sm text-amber-700 mt-2">
                  The revision will be sent back to the requester with your comments for revision.
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

              {/* Review Comments - Required */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  *Review Comments
                </label>
                <textarea
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="Describe what changes or additional information is needed..."
                  rows={5}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  Please provide specific details about what needs to be revised or clarified.
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
                color="amber"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send for Review'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ReturnRevisionForReviewDialog;
