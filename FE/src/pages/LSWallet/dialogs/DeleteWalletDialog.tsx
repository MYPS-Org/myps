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
  tier: 'hard' | 'soft' | 'blocked';
}

/**
 * DeleteWalletDialog displays tier-specific deletion UI.
 *
 * DEVIATION: `tier` is required (not optional) because the caller must determine
 * tier by calling getWalletActions() first, which computes the tier based on
 * HasStageData and active itemized projects. This prevents calling deleteWallet()
 * as a "dry-run" to discover tier (which would perform the deletion).
 */
const DeleteWalletDialog: React.FC<DeleteWalletDialogProps> = ({
  open,
  onClose,
  onSuccess,
  wallet,
  tier,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);

      const result = await deleteWallet(wallet.Id, user?.UserId || '');
      const resultTier = result.Data.tier;

      if (resultTier === 'hard') {
        showToast({
          type: 'success',
          message: 'Wallet permanently deleted.',
        });
      } else if (resultTier === 'soft') {
        showToast({
          type: 'success',
          message: 'Wallet removed from active view. It is retained for audit history.',
        });
      }

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

  const renderBlockedContent = () => (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Cannot Delete Wallet
            </p>
            <p className="text-sm text-red-700 mt-2">
              This wallet has active itemized projects. Remove or cancel all
              itemized projects before deleting this wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSoftDeleteContent = () => (
    <div className="space-y-4">
      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Soft Delete</p>
            <p className="text-sm text-yellow-700 mt-2">
              This wallet will be marked as deleted and hidden from active views.
              However, it will be retained in the system for audit trail and
              historical purposes.
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        <strong>Wallet:</strong> {wallet.ProgramName} (ID: {wallet.Id})
      </p>
    </div>
  );

  const renderHardDeleteContent = () => (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Permanent Deletion
            </p>
            <p className="text-sm text-red-700 mt-2">
              This wallet has no transaction history. It will be permanently and
              irreversibly removed from the system. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        <strong>Wallet:</strong> {wallet.ProgramName} (ID: {wallet.Id})
      </p>
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-6">
            {tier === 'blocked'
              ? 'Cannot Delete Wallet'
              : tier === 'soft'
              ? 'Remove Wallet'
              : 'Delete Wallet'}
          </DialogTitle>

          <div>
            {tier === 'blocked' && renderBlockedContent()}
            {tier === 'soft' && renderSoftDeleteContent()}
            {tier === 'hard' && renderHardDeleteContent()}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            {tier === 'blocked' ? (
              <Button color="zinc" onClick={onClose}>
                Close
              </Button>
            ) : (
              <>
                <Button color="zinc" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  color="red"
                  onClick={handleConfirm}
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Processing...'
                    : tier === 'soft'
                    ? 'Remove Wallet'
                    : 'Delete Permanently'}
                </Button>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteWalletDialog;
