// =============================================================================
// CreateItemizedProjectDialog.tsx — WF-4 Option B: Create Itemized Project
//
// Wallet pre-linked flow: shows wallet context (Program, Wallet ID, Available
// balance) and auto-populates project details from wallet. User enters draw
// amount, validated client-side. On success, calls Service.createItemizedProject()
// and triggers onSuccess callback with the created project.
//
// FUTURE: Component cost entry (full AIP multi-line per-year form) is a
// follow-up task pending real Project component-cost form integration.
// This dialog only covers the wallet-draw creation step.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { handleCurrencyFocus, handleCurrencyBlur } from '../../../utils/GlobalFunctions';
import * as Service from '../Service';
import type { ItemizedProject, LSWallet, LSWalletBalance, DtoCreateItemizedProject } from '../Model.d';

interface CreateItemizedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: ItemizedProject) => void;
  wallet: LSWallet;
  balance: LSWalletBalance;
}

const CreateItemizedProjectDialog: React.FC<CreateItemizedProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
  wallet,
  balance,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [drawAmount, setDrawAmount] = useState<string>('');
  const [errors, setErrors] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setDrawAmount('');
      setErrors('');
    }
  }, [open]);

  const validateDrawAmount = (amount: string): string => {
    const numericAmount = parseFloat(amount.replace(/[₱,\s]/g, '')) || 0;

    if (!numericAmount || numericAmount === 0) {
      return 'Draw amount is required and must be greater than 0.';
    }

    if (numericAmount > balance.Available) {
      return `Draw amount cannot exceed the wallet's Available balance (₱${balance.Available.toLocaleString('en-PH')}).`;
    }

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateDrawAmount(drawAmount);
    if (error) {
      setErrors(error);
      return;
    }

    setIsSubmitting(true);
    try {
      const numericAmount = parseFloat(drawAmount.replace(/[₱,\s]/g, '')) || 0;

      const payload: DtoCreateItemizedProject = {
        parentWalletId: wallet.Id,
        categoryId: wallet.CategoryId,
        subCategoryId: wallet.SubCategoryId,
        operatingUnit: wallet.OperatingUnit,
        programId: wallet.ProgramId,
        drawAmount: numericAmount,
        createdBy: user?.UserId || '',
      };

      const result = await Service.createItemizedProject(payload);
      onSuccess(result.Data);
      showToast({
        type: 'success',
        message: `Itemized project ${result.Data.ProjectId} created.`,
      });
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrors(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Itemized Project
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Wallet Context Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Linked Wallet
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Program Name</span>
                  <p className="font-medium text-gray-900 dark:text-white">{wallet.ProgramName}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Wallet ID</span>
                  <p className="font-medium text-gray-900 dark:text-white">{wallet.Id}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Available Balance</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    ₱{balance.Available.toLocaleString('en-PH')}
                  </p>
                </div>
              </div>
            </div>

            {/* Project Details Section (Read-only, populated from wallet) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Project Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {wallet.CategoryName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sub-category (Thrust)
                  </label>
                  <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {wallet.SubCategoryName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Operating Unit
                  </label>
                  <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {wallet.OperatingUnit}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Program
                  </label>
                  <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {wallet.ProgramId}
                  </div>
                </div>
              </div>
            </div>

            {/* Draw Amount Input Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Wallet Draw
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Draw Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={drawAmount}
                  onChange={(e) => {
                    setDrawAmount(e.target.value);
                    setErrors('');
                  }}
                  onFocus={handleCurrencyFocus}
                  onBlur={(e) => {
                    handleCurrencyBlur(e, (value) => setDrawAmount(value.toString()));
                  }}
                  placeholder="Enter draw amount"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors && <p className="mt-1 text-sm text-red-600">{errors}</p>}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                onClick={onClose}
                color="zinc"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="blue"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default CreateItemizedProjectDialog;
