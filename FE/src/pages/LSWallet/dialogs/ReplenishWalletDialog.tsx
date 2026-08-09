import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { replenishWallet } from '../Service';
import { useAuth } from '../../../contexts/AuthContext';
import type { LSWallet, LSWalletBalance, DtoReplenishWallet } from '../Model.d';

interface ReplenishWalletDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (wallet: LSWallet) => void;
  wallet: LSWallet;
  currentBalance: LSWalletBalance;
}

const ReplenishWalletDialog: React.FC<ReplenishWalletDialogProps> = ({
  open,
  onClose,
  onSuccess,
  wallet,
  currentBalance,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(numericValue)) {
      setNewAmount(numericValue);
    } else if (value === '') {
      setNewAmount('');
    }
  };

  const handleCurrencyBlur = () => {
    if (typeof newAmount === 'number' && newAmount > 0) {
      setNewAmount(newAmount);
    }
  };

  const handleCurrencyFocus = () => {
    // Clear for easier editing
    if (newAmount === 0) {
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
    try {
      setIsLoading(true);

      if (newAmount === '' || typeof newAmount !== 'number') {
        showToast({
          type: 'error',
          message: 'Please enter a valid amount.',
        });
        return;
      }

      if (newAmount <= wallet.Amount) {
        showToast({
          type: 'error',
          message: `The new amount must be greater than the current balance (₱${wallet.Amount.toLocaleString('en-PH')}). Decreases are not allowed.`,
        });
        return;
      }

      const payload: DtoReplenishWallet = {
        walletId: wallet.Id,
        newAmount,
        updatedBy: user?.UserId || '',
      };

      const result = await replenishWallet(payload);

      showToast({
        type: 'success',
        message: 'Wallet replenished successfully.',
      });

      onSuccess(result.Data);
      onClose();
      setNewAmount('');
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

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Replenish Wallet
          </DialogTitle>

          <div className="space-y-6">
            {/* Current Balance Display */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Total Balance</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(wallet.Amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Available Balance</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(currentBalance.Available)}
                </p>
              </div>
            </div>

            {/* New Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-red-500">*</span>New Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600">
                  ₱
                </span>
                <input
                  type="text"
                  value={typeof newAmount === 'number' ? newAmount.toLocaleString('en-PH') : ''}
                  onChange={handleCurrencyChange}
                  onBlur={handleCurrencyBlur}
                  onFocus={handleCurrencyFocus}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be greater than current balance
              </p>
            </div>

            {/* Info Box */}
            {newAmount !== '' && typeof newAmount === 'number' && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Increase:</strong>{' '}
                  {formatCurrency(newAmount - wallet.Amount)}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            <Button color="zinc" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              color="orange"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Replenishing...' : 'Replenish'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ReplenishWalletDialog;
