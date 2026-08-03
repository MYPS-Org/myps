// =============================================================================
// WalletFundingProfileForm.tsx — multi-line funding table for an LSWallet.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/components/FundingProfileForm.tsx
//
// DIFFERENCES from FundingProfileForm:
//   - Typed to WalletFundingProfile (not FundingProfile).
//   - Source and Agreement use plain text inputs instead of SearchableDropdowns
//     because Sources/Agreements come from getProjectDetails().Dropdowns which
//     requires an existing project ID. This is a pre-existing, already-documented
//     Project-module limitation (LSWallet.md notes the same gap). When the
//     backend provides these lookups directly, swap to SearchableDropdowns.
//   - No initialData prop (no dependency on ProjectFormPayload).
//   - Replaces FundingProfileSection.tsx.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import type { WalletFundingProfile } from '../Model.d';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
} from '../../../components/tailwindui/table';
import {
  getDisabledClass,
  handleCurrencyBlur,
  handleCurrencyChange,
  handleCurrencyFocus,
} from '../../../utils/GlobalFunctions';

interface WalletFundingProfileFormProps {
  fundingProfiles: WalletFundingProfile[];
  onAdd: () => void;
  onEdit: (index: number, updatedProfile: WalletFundingProfile) => void;
  onDelete: (index: number) => void;
  onTotalAmountChange?: (totalAmount: number) => void;
  disabled?: boolean;
}

const WalletFundingProfileForm: React.FC<WalletFundingProfileFormProps> = ({
  fundingProfiles,
  onAdd,
  onEdit,
  onDelete,
  onTotalAmountChange = () => {},
  disabled = false,
}) => {
  const [totalPercentage, setTotalPercentage] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [displayValues, setDisplayValues] = useState<{ [key: number]: string }>({});
  const [percentageBalancer, setPercentageBalancer] = useState(0);

  // Stable refs to avoid stale-closure dependency issues
  const onEditRef = useRef(onEdit);
  const onTotalAmountChangeRef = useRef(onTotalAmountChange);
  const previousAmountsRef = useRef<string>('');

  useEffect(() => {
    onEditRef.current = onEdit;
    onTotalAmountChangeRef.current = onTotalAmountChange;
  }, [onEdit, onTotalAmountChange]);

  // Recompute totals and auto-update percentages whenever amounts change
  useEffect(() => {
    const currentAmounts = fundingProfiles
      .map(p => `${p.Id}-${p.Amount}-${p.IsDeleted}`)
      .join('|');

    if (previousAmountsRef.current === currentAmounts) return;
    previousAmountsRef.current = currentAmounts;

    const totalAmt = fundingProfiles
      .filter(p => !p.IsDeleted)
      .reduce((sum, p) => sum + (p.Amount || 0), 0);
    setTotalAmount(totalAmt);

    let hasChanges = false;
    const updatedProfiles = fundingProfiles.map((profile) => {
      if (totalAmt === 0) {
        if (profile.Percentage !== 0) {
          hasChanges = true;
          return { ...profile, Percentage: 0 };
        }
        return profile;
      }
      const calculated = ((profile.Amount || 0) / totalAmt) * 100;
      const rounded = Math.round(calculated * 100) / 100;
      if (profile.Percentage !== rounded) {
        hasChanges = true;
        return { ...profile, Percentage: rounded };
      }
      return profile;
    });

    if (hasChanges) {
      requestAnimationFrame(() => {
        updatedProfiles.forEach((profile, index) => {
          onEditRef.current(index, profile);
        });
      });
    }

    const totalPct = updatedProfiles.reduce(
      (sum, p) => (p.IsDeleted ? sum : sum + (p.Percentage || 0)),
      0
    );
    setTotalPercentage(totalPct);

    const balancer = totalAmt > 0 ? Math.round((100 - totalPct) * 100) / 100 : 0;
    setPercentageBalancer(balancer);

    onTotalAmountChangeRef.current(totalAmt);
  }, [fundingProfiles]);

  // Sync currency display values
  useEffect(() => {
    const newDisplayValues: { [key: number]: string } = {};
    fundingProfiles.forEach((profile, index) => {
      if (profile.Amount != null && profile.Amount > 0) {
        newDisplayValues[index] = profile.Amount.FormatToCurrency();
      } else {
        newDisplayValues[index] = '';
      }
    });
    setDisplayValues(newDisplayValues);
  }, [fundingProfiles]);

  const getTotalPercentageColor = () => {
    const adjusted = totalPercentage + percentageBalancer;
    if (Math.abs(adjusted - 100) < 0.01) return 'text-green-600';
    if (adjusted > 100) return 'text-red-600';
    return 'text-yellow-600';
  };

  const handleAmountChange = (index: number, profile: WalletFundingProfile, value: string) => {
    if (disabled) return;
    const updateAmount = (field: string, numValue: number) => {
      onEdit(index, { ...profile, [field]: numValue });
    };
    const setDisplayValue = (displayValue: string) => {
      setDisplayValues(prev => ({ ...prev, [index]: displayValue }));
    };
    handleCurrencyChange(value, setDisplayValue, updateAmount, 'Amount');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900"></h2>
        <div className="flex items-center gap-4">
          <div className={`text-sm font-medium ${getTotalPercentageColor()}`}>
            Total: {totalPercentage.toFixed(1)}%
            {totalPercentage !== 100 && (
              <span className="text-xs ml-1">
                ({totalPercentage < 100
                  ? `${(100 - totalPercentage).toFixed(1)}% remaining`
                  : `${(totalPercentage - 100).toFixed(1)}% over`})
              </span>
            )}
          </div>
          <div className={`text-sm font-medium ${getTotalPercentageColor()}`}>
            Total Amount: {totalAmount.FormatToCurrency()}
          </div>
          <Button color="blue" onClick={onAdd} disabled={disabled}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Funding
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader className="w-1/3">Source</TableHeader>
            <TableHeader className="w-1/3">Agreement</TableHeader>
            <TableHeader className="w-1/6">Amount</TableHeader>
            <TableHeader className="w-1/6">Percentage</TableHeader>
            <TableHeader className="w-auto">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {fundingProfiles.map((profile, index) => {
            if (profile.IsDeleted) return null;
            return (
              <TableRow key={profile.Id === 0 ? `new-${index}` : profile.Id}>
                <TableCell className="w-1/3">
                  {/* Plain text input: Sources dropdown not available on create
                      (same limitation as Project add mode). */}
                  <input
                    type="text"
                    value={profile.Source || ''}
                    onChange={(e) => onEdit(index, { ...profile, Source: e.target.value })}
                    className={`w-full px-2 py-1 border border-gray-300 rounded ${getDisabledClass(disabled)}`}
                    placeholder="Enter funding source"
                    disabled={disabled}
                    maxLength={200}
                  />
                </TableCell>
                <TableCell className="w-1/3">
                  {/* Plain text input: Agreements dropdown not available on create. */}
                  <input
                    type="text"
                    value={profile.Agreement || ''}
                    onChange={(e) => onEdit(index, { ...profile, Agreement: e.target.value })}
                    className={`w-full px-2 py-1 border border-gray-300 rounded ${getDisabledClass(disabled)}`}
                    placeholder="Enter agreement"
                    disabled={disabled}
                    maxLength={200}
                  />
                </TableCell>
                <TableCell className="w-1/6">
                  <input
                    type="text"
                    value={displayValues[index] || ''}
                    onChange={(e) => handleAmountChange(index, profile, e.target.value)}
                    onFocus={handleCurrencyFocus}
                    onBlur={(e) =>
                      handleCurrencyBlur(e, (value) => onEdit(index, { ...profile, Amount: value }))
                    }
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-right ${getDisabledClass(disabled)}`}
                    placeholder="₱0.00"
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell className="w-1/6">
                  <input
                    type="number"
                    value={profile.Percentage?.toFixed(2) || ''}
                    className="w-full px-2 py-1 border rounded text-right bg-gray-100 border-gray-300"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.01"
                    readOnly
                    title="Percentage is automatically calculated based on amount"
                  />
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onDelete(index)}
                    className={`text-red-600 hover:text-red-800 ${getDisabledClass(disabled)}`}
                    disabled={disabled}
                    title="Remove this funding line"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
          {fundingProfiles.filter(p => !p.IsDeleted).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                No funding lines added yet. Click "Add Funding" to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Percentage validation indicator */}
      {totalPercentage > 0 && Math.abs(totalPercentage - 100) >= 0.01 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            Total percentage must equal 100% (currently {totalPercentage.toFixed(2)}%).
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletFundingProfileForm;
