// =============================================================================
// EditDrawAmountDialog.tsx — Edit draw amount for an unpublished itemized project
//
// Only valid before publish. Post-publish edits go through revision requests.
//
// Balance guard: the change in draw (newAmount - currentDraw) must not exceed
// the wallet's Available balance — i.e. newAmount <= currentDraw + available.
// Decreasing the draw is always allowed (negative delta returns funds to wallet).
// =============================================================================

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { updateItemizedProjectDraw } from '../Service';
import type { ItemizedProject, LSWallet, LSWalletBalance } from '../Model.d';

interface EditDrawAmountDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: ItemizedProject) => void;
  project: ItemizedProject;
  wallet: LSWallet;
  balance: LSWalletBalance;
}

const EditDrawAmountDialog: React.FC<EditDrawAmountDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
  wallet,
  balance,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Pre-fill with the current draw amount so the user sees what they're editing
  const [newAmount, setNewAmount] = useState<number | ''>(project.CurrentDrawAmount);
  const [isLoading, setIsLoading] = useState(false);

  // The maximum new draw is: whatever the wallet currently has available PLUS what
  // this project already holds (since changing to a smaller amount frees funds first)
  const maxAllowed = project.CurrentDrawAmount + balance.Available;

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const numeric = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(numeric)) {
      setNewAmount(numeric);
    } else if (raw === '') {
      setNewAmount('');
    }
  };

  const formatCurrency = (value: number | '') => {
    if (value === '') return '';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleSubmit = async () => {
    if (newAmount === '' || typeof newAmount !== 'number') {
      showToast({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    if (newAmount <= 0) {
      showToast({ type: 'error', message: 'Draw amount must be greater than zero.' });
      return;
    }

    // Guard: don't allow an edit that would push wallet Available negative
    if (newAmount > maxAllowed) {
      showToast({
        type: 'error',
        message: `New draw amount would exceed wallet capacity. Maximum allowed: ${formatCurrency(maxAllowed)}.`,
      });
      return;
    }

    try {
      setIsLoading(true);
      const result = await updateItemizedProjectDraw({
        projectId: project.ProjectId,
        newDrawAmount: newAmount,
        updatedBy: user?.UserId || '',
      });
      showToast({
        type: 'success',
        message: `Draw amount updated to ${formatCurrency(newAmount)}.`,
      });
      onSuccess(result.Data);
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNewAmount('');
    onClose();
  };

  const diff = typeof newAmount === 'number' ? newAmount - project.CurrentDrawAmount : 0;

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Edit Draw Amount
          </DialogTitle>

          <div className="space-y-6">
            {/* Context summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Project</span>
                <span className="font-mono font-medium text-gray-800">{project.ProjectId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Wallet</span>
                <span className="font-medium text-gray-800">{wallet.ProgramName}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600">Current Draw Amount</span>
                <span className="font-medium">{formatCurrency(project.CurrentDrawAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Wallet Available Balance</span>
                <span className="font-medium">{formatCurrency(balance.Available)}</span>
              </div>
              <div className="flex justify-between text-blue-700 font-medium">
                <span>Maximum New Draw</span>
                <span>{formatCurrency(maxAllowed)}</span>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-red-500">*</span> New Draw Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">₱</span>
                <input
                  type="text"
                  value={typeof newAmount === 'number' ? newAmount.toLocaleString('en-PH') : ''}
                  onChange={handleCurrencyChange}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be positive and not exceed the wallet's available capacity.
              </p>
            </div>

            {/* Change indicator — only shown when the amount differs from current */}
            {typeof newAmount === 'number' && newAmount !== project.CurrentDrawAmount && (
              <div
                className={`rounded-lg p-4 border text-sm ${
                  diff > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-green-50 border-green-200 text-green-800'
                }`}
              >
                <strong>{diff > 0 ? 'Increase:' : 'Decrease:'}</strong>{' '}
                {formatCurrency(Math.abs(diff))}{' '}
                {diff > 0
                  ? "will be drawn from the wallet's available balance."
                  : "will be returned to the wallet's available balance."}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            <Button color="zinc" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default EditDrawAmountDialog;
