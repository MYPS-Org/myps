import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';

interface SaveLumpSumConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  programName?: string;
  /** Dialog heading. Defaults to the add-mode wording. */
  title?: string;
  /** Confirm button label. Defaults to the add-mode wording. */
  confirmLabel?: string;
}

const SaveLumpSumConfirmDialog: React.FC<SaveLumpSumConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  programName,
  title,
  confirmLabel,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const dialogTitle = title ?? 'Create Lump Sum Project';
  const buttonLabel = confirmLabel ?? 'Create Lump Sum Project';
  const savingLabel = confirmLabel ? 'Saving...' : 'Creating...';

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      /*  Always close. onConfirm handles its own errors — httpClient's
          interceptor raises the toast — so a failure leaves the form intact
          behind this dialog rather than trapping the user in it. */
      setIsConfirming(false);
      onClose();
    }
  };

  const handleClose = () => {
    if (!isConfirming) onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            {dialogTitle}
          </DialogTitle>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                {confirmLabel
                  ? 'Save this Lump Sum Project? Changes take effect immediately.'
                  : 'Create this Lump Sum Project? Its allocation becomes available to itemize against straight away.'}
              </p>
            </div>

            {programName && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Program:</h4>
                <p className="text-sm text-gray-700">{programName}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            <Button color="zinc" onClick={handleClose} disabled={isConfirming}>
              Cancel
            </Button>
            <Button color="green" onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {savingLabel}
                </div>
              ) : (
                buttonLabel
              )}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default SaveLumpSumConfirmDialog;
