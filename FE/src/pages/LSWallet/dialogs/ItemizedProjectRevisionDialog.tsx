import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import DocumentPlusIcon from '@heroicons/react/24/outline/DocumentPlusIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { submitRevision } from '../Service';
import type { ItemizedProject, LSWallet, ItemizedProjectRevision } from '../Model.d';

interface ItemizedProjectRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (revision: ItemizedProjectRevision) => void;
  project: ItemizedProject;
  wallet: LSWallet;
}

const ItemizedProjectRevisionDialog: React.FC<ItemizedProjectRevisionDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
  wallet,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [requestedCost, setRequestedCost] = useState('');

  const handleClose = () => {
    setReason('');
    setNotes('');
    setRequestedCost('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!reason.trim()) {
      showToast({
        type: 'error',
        message: 'Please provide a reason for this revision request.',
      });
      return;
    }

    const costNum = parseFloat(requestedCost);
    if (!requestedCost.trim() || isNaN(costNum) || costNum <= 0) {
      showToast({
        type: 'error',
        message: 'Requested cost must be a valid amount greater than zero.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitRevision({
        itemizedProjectId: project.Id,
        requestedCost: costNum,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        createdBy: user?.UserId || '',
      });

      const revision = response.Data;
      onSuccess(revision);
      showToast({
        type: 'success',
        message: `Revision ${revision.TransactionId} submitted for review.`,
      });
      handleClose();
    } catch (err) {
      console.error('Error submitting revision:', err);
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      showToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} className="fixed z-10 inset-0 overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <DocumentPlusIcon className="h-6 w-6 text-blue-600" />
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Request Revision
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
              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium">
                  Submit a revision request for this itemized project.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  This revision changes the project's cost but does NOT affect the wallet's Used/Available balance — the wallet's contribution stays frozen at the published amount.
                </p>
              </div>

              {/* Project Context */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Project Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Project ID:</span>
                    <p className="text-gray-600">{project.ProjectId}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Published Draw Amount:</span>
                    <p className="text-gray-600">
                      ₱{(project.PublishedDrawAmount ?? 0).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Wallet:</span>
                    <p className="text-gray-600">{wallet.ProgramName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Wallet Amount:</span>
                    <p className="text-gray-600">
                      ₱{wallet.Amount.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason Field - Required */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  *Reason for Revision
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this revision is needed..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  Provide a clear explanation for the requested revision.
                </p>
              </div>

              {/* Requested Cost Field - Required */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  *Requested Cost (₱)
                </label>
                <input
                  type="number"
                  value={requestedCost}
                  onChange={(e) => setRequestedCost(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  Enter the new cost being requested via this revision.
                </p>
              </div>

              {/* Notes Field - Optional */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any supporting details or context..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
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
                color="blue"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Revision'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ItemizedProjectRevisionDialog;
