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
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Create Itemized Project
          </DialogTitle>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Wallet Context Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Linked Wallet
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Program Name</span>
                  <p className="font-medium text-gray-900">{wallet.ProgramName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Wallet ID</span>
                  <p className="font-medium text-gray-900">{wallet.Id}</p>
                </div>
                <div>
                  <span className="text-gray-600">Available Balance</span>
                  <p className="font-medium text-gray-900">
                    ₱{balance.Available.toLocaleString('en-PH')}
                  </p>
                </div>
              </div>
            </div>

            {/* Project Details Section (Read-only, populated from wallet) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Project Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                    {wallet.CategoryName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub-category (Thrust)
                  </label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                    {wallet.SubCategoryName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operating Unit
                  </label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                    {wallet.OperatingUnit}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program
                  </label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                    {wallet.ProgramId}
                  </div>
                </div>
              </div>
            </div>

            {/* Draw Amount Input Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Wallet Draw
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    errors ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors && <p className="mt-1 text-sm text-red-600">{errors}</p>}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 border-t pt-6">
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
