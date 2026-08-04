import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { deleteWallet } from '../Service';
import { useAuth } from '../../../contexts/AuthContext';
import type { LSWallet } from '../Model.d';

interface DeleteWalletDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wallet: LSWallet;
}

/**
 * DeleteWalletDialog sends a single delete request; the backend decides
 * whether it ends up a hard or soft delete, or rejects it (e.g. active
 * itemized projects still attached) — mirrors Program's DeleteProgramDialog.
 */
const DeleteWalletDialog: React.FC<DeleteWalletDialogProps> = ({
  open,
  onClose,
  onSuccess,
  wallet,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);

      await deleteWallet(wallet.Id, user?.UserId || '');
      showToast({ type: 'success', message: 'Wallet deleted.' });

      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      showToast({ type: 'error', message: errorMessage });
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
            Delete Wallet
          </DialogTitle>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  This action cannot be undone
                </p>
                <p className="text-sm text-red-700 mt-2">
                  This will permanently delete the wallet from the system.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            <strong>Wallet:</strong> {wallet.ProgramName} (ID: {wallet.Id})
          </p>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            <Button color="zinc" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete Wallet'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteWalletDialog;
