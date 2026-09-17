// =============================================================================
// DeleteLumpSumDialog.tsx — delete a Lump Sum Project.
//
// THE SERVER DECIDES THE TIER. One request goes out; the response says whether
// it ended up a hard delete, a soft one kept for history, or was refused
// (itemized children still attached). The dialog reports back whatever came out
// rather than predicting it — the wallet-era version hardcoded "This will
// permanently delete", which was wrong for two of the three outcomes.
// =============================================================================

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { deleteLumpSum } from '../Service';
import type { LumpSum } from '../Model.d';

interface DeleteLumpSumDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lumpSum: LumpSum;
}

const DeleteLumpSumDialog: React.FC<DeleteLumpSumDialogProps> = ({
  open,
  onClose,
  onSuccess,
  lumpSum,
}) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      const result = await deleteLumpSum(lumpSum.Id);
      showToast({
        type: 'success',
        message: result.Data.Message || 'Lump Sum Project deleted.',
      });
      onSuccess();
      onClose();
    } catch {
      // httpClient's interceptor already raised the toast — including the
      // refusal when itemized projects are still attached.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-6">
            Delete Lump Sum Project
          </DialogTitle>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">This action cannot be undone</p>
                <p className="text-sm text-red-700 mt-2">
                  A project that has never moved past its creation stage is removed outright;
                  one with history is kept and marked deleted. If it still has itemized
                  projects, the deletion is refused — remove those first.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 mt-4 space-y-1">
            <p>
              <strong>Project:</strong> {lumpSum.Description || '—'}
            </p>
            <p className="font-mono text-xs">{lumpSum.ProjectId}</p>
            {lumpSum.ItemizedCount > 0 && (
              <p className="text-red-700">
                {lumpSum.ItemizedCount} itemized project
                {lumpSum.ItemizedCount === 1 ? '' : 's'} still attached.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            <Button color="zinc" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteLumpSumDialog;
