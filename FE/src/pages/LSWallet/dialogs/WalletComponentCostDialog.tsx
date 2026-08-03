// =============================================================================
// WalletComponentCostDialog.tsx — Add/Edit component cost for an LSWallet.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/dialogs/ComponentCostDialog.tsx
//
// TECH DEBT: Changes to ComponentCostDialog must be manually reviewed for
// propagation here. This divergence is intentional and documented.
//
// KEY DIFFERENCES from ComponentCostDialog:
//   1. The WALLET_EXCLUSIVE_COMPONENT_TYPES filter is NOT applied here — wallets
//      MUST be able to select 'LS' (Lump Sum) as their component type. The
//      Project dialog explicitly excludes 'LS' for regular AIP projects.
//   2. No hasMajorLocations prop — wallets have no Major Item of Works.
//   3. No autoFillComponentDescription / SparklesIcon — no GIS auto-fill.
//   4. Typed to WalletComponentCost / WalletComponentCostPerYear.
//   5. programDetails is optional (wallets don't call getProjectDetails()).
//      Year range falls back to 2000-2100 when programDetails is not provided.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { DateInput } from '../../../components/tailwindui/date-input';
import type { WalletComponentCost, WalletComponentCostPerYear } from '../Model.d';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/toaster/ToasterContext';
import { getDisabledClass } from '../../../utils/GlobalFunctions';
import type { ComponentTypeEnum } from '../../Project/Model.d';

interface ProgramYearRange {
  YearStart?: number;
  YearEnd?: number;
}

interface WalletComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: WalletComponentCost, costPerYear: WalletComponentCostPerYear[]) => void;
  editingCost?: WalletComponentCost;
  editingCostPerYear?: WalletComponentCostPerYear[];
  mode: 'add' | 'edit';
  componentTypes: ComponentTypeEnum[];
  componentCosts: WalletComponentCost[];
  walletId?: number;
  maxAmountCost?: number;
  disabled?: boolean;
  /** Optional program year range — falls back to 2000/2100 if not provided. */
  programDetails?: ProgramYearRange;
}

const WalletComponentCostDialog: React.FC<WalletComponentCostDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCost,
  editingCostPerYear,
  mode,
  componentTypes,
  componentCosts,
  walletId,
  maxAmountCost,
  disabled = false,
  programDetails,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<WalletComponentCost>({
    Id: 0,
    WalletId: walletId || 0,
    CostId: '',
    ComponentType: '',
    ComponentId: '',
    Description: '',
    Total: 0,
    IsDeleted: false,
    CreatedBy: user?.UserId || '',
    CreatedDate: new Date().toISOString(),
    UpdatedBy: user?.UserId || '',
    UpdatedDate: new Date().toISOString(),
  });

  const [componentCostPerYear, setComponentCostPerYear] = useState<WalletComponentCostPerYear[]>([]);
  const isInitializedRef = useRef<boolean>(false);

  const yearStart = programDetails?.YearStart || new Date().getFullYear();
  const yearEnd = programDetails?.YearEnd || 2100;

  // Calculate remaining budget
  const calculateRemainingBudget = () => {
    if (!maxAmountCost || maxAmountCost <= 0) return null;
    let currentTotalCost = componentCosts.reduce(
      (sum, cost) => (cost.IsDeleted ? sum : sum + (cost.Total || 0)),
      0
    );
    if (mode === 'edit' && editingCost) {
      currentTotalCost -= editingCost.Total || 0;
    }
    return maxAmountCost - currentTotalCost;
  };
  const remainingBudget = calculateRemainingBudget();

  // Per-year cost handlers
  const handleAddPerYearCost = () => {
    const nonDeletedCount = componentCostPerYear.filter(c => !c.IsDeleted).length;
    const newCost: WalletComponentCostPerYear = {
      Id: 0,
      ComponentCostId: formData.CostId,
      Amount: 0,
      Year: yearStart + nonDeletedCount,
      StartDate: null,
      EndDate: null,
      CreatedBy: user?.UserId || '',
      CreatedDate: new Date().toISOString(),
      UpdatedBy: '',
      UpdatedDate: '',
      IsDeleted: false,
    };
    setComponentCostPerYear(prev => [...prev, newCost]);
  };

  const handleEditPerYearCost = (index: number, field: keyof WalletComponentCostPerYear, value: unknown) => {
    setComponentCostPerYear(prev =>
      prev.map((cost, i) => (i === index ? { ...cost, [field]: value } : cost))
    );
  };

  const handleDeletePerYearCost = (index: number) => {
    setComponentCostPerYear(prev => {
      const cost = prev[index];
      if (cost.Id === 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((c, i) => (i === index ? { ...c, IsDeleted: true } : c));
    });
  };

  // Reset init flag when dialog opens/closes or mode changes
  useEffect(() => {
    isInitializedRef.current = false;
  }, [isOpen, mode]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    if (editingCost && mode === 'edit') {
      setFormData({
        Id: editingCost.Id ?? 0,
        WalletId: editingCost.WalletId ?? walletId ?? 0,
        CostId: editingCost.CostId ?? '',
        ComponentType: editingCost.ComponentType ?? '',
        ComponentId: editingCost.ComponentId ?? '',
        Description: editingCost.Description ?? '',
        Total: editingCost.Total ?? 0,
        StageName: editingCost.StageName || '',
        RevisedNumber: editingCost.RevisedNumber ?? 0,
        IsDeleted: editingCost.IsDeleted ?? false,
        CreatedBy: editingCost.CreatedBy ?? '',
        CreatedDate: editingCost.CreatedDate ?? new Date().toISOString(),
        UpdatedBy: editingCost.UpdatedBy ?? '',
        UpdatedDate: editingCost.UpdatedDate ?? new Date().toISOString(),
      });
      if (editingCostPerYear) {
        setComponentCostPerYear(editingCostPerYear.filter(c => !c.IsDeleted));
      }
      isInitializedRef.current = true;
    } else if (mode === 'add') {
      const tempCostId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setFormData({
        Id: 0,
        WalletId: walletId || 0,
        CostId: tempCostId,
        ComponentType: '',
        ComponentId: '',
        Description: '',
        Total: 0,
        IsDeleted: false,
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
        UpdatedBy: '',
        UpdatedDate: new Date().toISOString(),
      });
      setComponentCostPerYear([]);
      isInitializedRef.current = true;
    }
  }, [editingCost, editingCostPerYear, mode, isOpen, walletId]);

  // Auto-compute Total from per-year costs
  useEffect(() => {
    const total = componentCostPerYear
      .filter(c => !c.IsDeleted)
      .reduce((sum, c) => sum + (c.Amount || 0), 0);
    setFormData(prev => ({ ...prev, Total: total }));
  }, [componentCostPerYear]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChangeComponentType = (value: string) => {
    handleChange('ComponentType', value);
    const selectedComponent = componentTypes.find(t => t.ComponentName === value);
    if (!selectedComponent) return;

    let generatedId = selectedComponent.ComponentId || '';
    // Civil Works gets an incrementing suffix (same logic as ComponentCostDialog)
    if (value.toLowerCase() === 'civil works') {
      const matchingCount = componentCosts.filter(
        item => item.ComponentType === value && !item.IsDeleted
      ).length;
      generatedId = `${selectedComponent.ComponentId}${matchingCount + 1}`;
    }
    handleChange('ComponentId', generatedId);
  };

  const handleReset = () => {
    const tempCostId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setFormData({
      Id: 0,
      WalletId: walletId || 0,
      CostId: tempCostId,
      ComponentType: '',
      ComponentId: '',
      Description: '',
      Total: 0,
      IsDeleted: false,
      CreatedBy: '',
      CreatedDate: new Date().toISOString(),
      UpdatedBy: '',
      UpdatedDate: new Date().toISOString(),
    });
    setComponentCostPerYear([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ComponentType || !formData.ComponentId) {
      showToast({ type: 'error', message: 'Please select a Component Type.' });
      return;
    }

    const validPerYearCosts = componentCostPerYear.filter(c => !c.IsDeleted);

    if (validPerYearCosts.length === 0) {
      showToast({ type: 'error', message: 'Please add at least one per-year cost.' });
      return;
    }

    for (let i = 0; i < validPerYearCosts.length; i++) {
      const cost = validPerYearCosts[i];
      if (!cost.Year || cost.Year <= 0) {
        showToast({ type: 'error', message: `Please enter a valid year for cost entry ${i + 1}.` });
        return;
      }
      if (!cost.Amount || cost.Amount <= 0) {
        showToast({ type: 'error', message: `Please enter a valid amount for cost entry ${i + 1}.` });
        return;
      }
      if (!cost.StartDate) {
        showToast({ type: 'error', message: `Please select a Start Date for cost entry ${i + 1}.` });
        return;
      }
      if (!cost.EndDate) {
        showToast({ type: 'error', message: `Please select an End Date for cost entry ${i + 1}.` });
        return;
      }
      const startStr = cost.StartDate.split('T')[0];
      const endStr = cost.EndDate.split('T')[0];
      const yearMin = `${cost.Year}-01-01`;
      const yearMax = `${cost.Year}-12-31`;
      if (startStr < yearMin || startStr > yearMax || (endStr && startStr > endStr)) {
        showToast({ type: 'error', message: `Start Date for entry ${i + 1} is out of range.` });
        return;
      }
      if (endStr < yearMin || endStr > yearMax || (startStr && endStr < startStr)) {
        showToast({ type: 'error', message: `End Date for entry ${i + 1} is out of range.` });
        return;
      }
    }

    if (formData.Total <= 0) {
      showToast({ type: 'error', message: 'Total amount must be greater than zero.' });
      return;
    }

    // Budget cap warning
    if (maxAmountCost && maxAmountCost > 0) {
      let currentTotalCost = componentCosts.reduce(
        (sum, c) => (c.IsDeleted ? sum : sum + (c.Total || 0)),
        0
      );
      if (mode === 'edit' && editingCost) {
        currentTotalCost -= editingCost.Total || 0;
      }
      const newTotalCost = currentTotalCost + (formData.Total || 0);
      if (newTotalCost > maxAmountCost) {
        const exceeded = newTotalCost - maxAmountCost;
        const confirmMessage =
          `This cost will exceed the maximum budget by ₱${exceeded.toLocaleString('en-PH')}.\n\n` +
          `Total cost: ₱${newTotalCost.toLocaleString('en-PH')}\n` +
          `Max allowed: ₱${maxAmountCost.toLocaleString('en-PH')}\n\n` +
          `Do you want to proceed anyway?`;
        if (!window.confirm(confirmMessage)) return;
      }
    }

    const costData: WalletComponentCost = {
      ...formData,
      CreatedBy: user?.UserId || '',
      UpdatedBy: user?.UserId,
      UpdatedDate: new Date().toISOString(),
    };

    const perYearCosts = componentCostPerYear.map(c => ({
      ...c,
      ComponentCostId: formData.CostId,
      CreatedBy: c.CreatedBy || user?.UserId || '',
      UpdatedBy: user?.UserId || '',
      UpdatedDate: new Date().toISOString(),
      StartDate: c.StartDate || null,
      EndDate: c.EndDate || null,
    }));

    onSave(costData, perYearCosts);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {mode === 'add' ? 'Add Wallet Component Cost' : 'Edit Wallet Component Cost'}
            </DialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Component Type and ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Component Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.ComponentType}
                  onChange={(e) => handleChangeComponentType(e.target.value)}
                  required
                >
                  <option value="">Select Component Type</option>
                  {/* NOTE: Unlike ComponentCostDialog, 'LS' is NOT filtered out here.
                      Wallets must be able to select the Lump Sum component type. */}
                  {componentTypes?.map((type) => (
                    <option key={type.Id} value={type.ComponentName}>
                      {type.ComponentName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Component ID
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none"
                  type="text"
                  value={formData.ComponentId}
                  readOnly
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              {/* No auto-fill button: wallets have no Major Item of Works / GIS linkage */}
              <textarea
                value={formData.Description || ''}
                onChange={(e) => handleChange('Description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter description..."
                maxLength={500}
              />
            </div>

            {/* Per-Year Costs */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Cost Breakdown by Year
                </label>
                <Button type="button" color="blue" onClick={handleAddPerYearCost}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Year
                </Button>
              </div>

              {componentCostPerYear.filter(c => !c.IsDeleted).length === 0 ? (
                <div className="text-center text-gray-500 py-4 border border-dashed border-gray-300 rounded-md">
                  No per-year costs added yet. Click "Add Year" to get started.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {componentCostPerYear.map((cost, index) => {
                    if (cost.IsDeleted) return null;

                    const startDateStr = cost.StartDate ? cost.StartDate.split('T')[0] : '';
                    const endDateStr = cost.EndDate ? cost.EndDate.split('T')[0] : '';
                    const yearMin = cost.Year ? `${cost.Year}-01-01` : '';
                    const yearMax = cost.Year ? `${cost.Year}-12-31` : '';

                    const isStartDateInvalid =
                      startDateStr !== '' &&
                      ((yearMin && startDateStr < yearMin) ||
                        (yearMax && startDateStr > yearMax) ||
                        (endDateStr && startDateStr > endDateStr));
                    const isEndDateInvalid =
                      endDateStr !== '' &&
                      ((yearMin && endDateStr < yearMin) ||
                        (yearMax && endDateStr > yearMax) ||
                        (startDateStr && endDateStr < startDateStr));

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-[120px_1fr_1fr_1fr_auto] gap-3 items-end p-3 bg-gray-50 rounded border"
                      >
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                          <input
                            type="number"
                            value={cost.Year || ''}
                            onChange={(e) =>
                              handleEditPerYearCost(index, 'Year', parseInt(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder={String(yearStart)}
                            min={yearStart.toString()}
                            max={yearEnd.toString()}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                          <input
                            type="text"
                            value={cost.Amount ? cost.Amount.toLocaleString('en-PH') : ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              handleEditPerYearCost(index, 'Amount', parseFloat(value) || 0);
                            }}
                            onFocus={(e) => {
                              const rawValue = cost.Amount || 0;
                              e.target.value = rawValue > 0 ? rawValue.toString() : '';
                            }}
                            onBlur={(e) => {
                              const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                              const numericValue = parseFloat(rawValue) || 0;
                              handleEditPerYearCost(index, 'Amount', numericValue);
                              e.target.value =
                                numericValue > 0 ? numericValue.toLocaleString('en-PH') : '';
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="₱0.00"
                          />
                        </div>
                        <div>
                          <label
                            className={`block text-xs font-medium mb-1 ${isStartDateInvalid ? 'text-red-600' : 'text-gray-700'}`}
                          >
                            Start Date
                            {isStartDateInvalid && (
                              <span className="ml-1 text-red-500">(out of range)</span>
                            )}
                          </label>
                          <DateInput
                            value={startDateStr}
                            onChange={(e) =>
                              handleEditPerYearCost(index, 'StartDate', e.target.value || null)
                            }
                            min={yearMin || undefined}
                            max={endDateStr || yearMax || undefined}
                            className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 ${
                              isStartDateInvalid
                                ? 'border-red-500 focus:ring-red-500 bg-red-50 text-red-900'
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                            required
                          />
                        </div>
                        <div>
                          <label
                            className={`block text-xs font-medium mb-1 ${isEndDateInvalid ? 'text-red-600' : 'text-gray-700'}`}
                          >
                            End Date
                            {isEndDateInvalid && (
                              <span className="ml-1 text-red-500">(out of range)</span>
                            )}
                          </label>
                          <DateInput
                            value={endDateStr}
                            onChange={(e) =>
                              handleEditPerYearCost(index, 'EndDate', e.target.value || null)
                            }
                            min={startDateStr || yearMin || undefined}
                            max={yearMax || undefined}
                            className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 ${
                              isEndDateInvalid
                                ? 'border-red-500 focus:ring-red-500 bg-red-50 text-red-900'
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                            required
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleDeletePerYearCost(index)}
                            className={`text-red-600 hover:text-red-800 p-1 ${getDisabledClass(disabled)}`}
                            title="Delete this year entry"
                            disabled={disabled}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Cost display */}
              <div className="mt-3 p-3 bg-blue-50 rounded border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Cost:</span>
                  <span
                    className={`text-lg font-semibold ${
                      remainingBudget !== null && formData.Total > remainingBudget
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`}
                  >
                    ₱{formData.Total.toLocaleString('en-PH')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" color="zinc" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" color="orange">
                {mode === 'add' ? 'Add' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default WalletComponentCostDialog;
