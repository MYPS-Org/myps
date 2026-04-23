import React, { useState, useEffect, useRef } from "react";
import type { FundingProfile, ProjectFormPayload } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import { getDisabledClass, handleCurrencyBlur, handleCurrencyChange, handleCurrencyFocus, handleNumberFocus, formatDropdownOptions } from "../../../utils/GlobalFunctions";
import SearchableDropdown from "../../../components/ui/SearchableDropdown";

interface FundingProfileFormProps {
  initialData?: ProjectFormPayload;
  fundingProfiles: FundingProfile[];
  onAdd: () => void;
  onEdit: (index: number, updatedProfile: FundingProfile) => void;
  onDelete: (index: number) => void;
  onTotalAmountChange?: (totalAmount: number) => void; // Optional callback for total amount change
  disabled?: boolean;
}

const FundingProfileForm: React.FC<FundingProfileFormProps> = ({ 
  fundingProfiles,
  onAdd, 
  onEdit, 
  onDelete,
  initialData,
  onTotalAmountChange = () => {}, // Default to no-op if not provided
  disabled = false
}) => {
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const [totalPercentage, setTotalPercentage] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [displayValues, setDisplayValues] = useState<{ [key: number]: string }>({});
  const [percentageBalancer, setPercentageBalancer] = useState(0);
  
  // Use refs to avoid dependency issues
  const onEditRef = useRef(onEdit);
  const onTotalAmountChangeRef = useRef(onTotalAmountChange);
  const previousAmountsRef = useRef<string>('');
  
  useEffect(() => {
    onEditRef.current = onEdit;
    onTotalAmountChangeRef.current = onTotalAmountChange;
  }, [onEdit, onTotalAmountChange]);

  // Calculate total percentage and amount, then auto-update percentages
  useEffect(() => {
    // Create a snapshot of current amounts to check if they've changed
    const currentAmounts = fundingProfiles
      .map(p => `${p.Id}-${p.Amount}-${p.IsDeleted}`)
      .join('|');
    
    // Skip if amounts haven't changed
    if (previousAmountsRef.current === currentAmounts) {
      return;
    }
    previousAmountsRef.current = currentAmounts;

    const totalAmt = fundingProfiles
      .filter(p => !p.IsDeleted)
      .reduce((sum, p) => sum + (p.Amount || 0), 0);
    setTotalAmount(totalAmt);

    // Create updated profiles with recalculated percentages
    let hasChanges = false;

    const updatedProfiles = fundingProfiles.map((profile) => {
      if (totalAmt === 0) {
        if(profile.Percentage !== 0) {
          hasChanges = true;
          return { ...profile, Percentage: 0 };
        }
        return profile;
      }

      const calculated = ((profile.Amount || 0) / totalAmt) * 100;
      const rounded = Math.round(calculated * 100) / 100; // Round to 2 decimal places

      if (profile.Percentage !== rounded) {
        hasChanges = true;
        return { ...profile, Percentage: rounded };
      }
      return profile;
    });

    if (hasChanges) {
      // Use requestAnimationFrame to batch updates and avoid blocking
      requestAnimationFrame(() => {
        updatedProfiles.forEach((profile, index) => {
          onEditRef.current(index, profile);
        });
      });
    }

    // Calculate total percentage and balancer to fix floating-point errors
    const totalPct = updatedProfiles.reduce((sum, p) => p.IsDeleted ? sum : sum + (p.Percentage || 0), 0);
    setTotalPercentage(totalPct);

    // Balancer compensates for rounding errors (e.g., 3 items at 33.33% = 99.99%, balancer = 0.01%)
    const balancer = totalAmt > 0 ? Math.round((100 - totalPct) * 100) / 100 : 0;
    setPercentageBalancer(balancer);

    if (onTotalAmountChangeRef.current) {
      onTotalAmountChangeRef.current(totalAmt);
    }
  }, [fundingProfiles]);

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

  // Validate percentage and update errors
  const validatePercentage = (index: number, value: number) => {
    const newErrors = { ...errors };
    
    if (value < 0) {
      newErrors[index] = "Percentage cannot be negative";
    } else if (value > 100) {
      newErrors[index] = "Percentage cannot exceed 100%";
    } else {
      delete newErrors[index];
    }
    setErrors(newErrors);
  };

  // Handle amount Changing in UI
  const handleAmountChange = (index: number, profile: FundingProfile, value: string) => {
    if (disabled) return;
    const updateAmount = (field: string, numValue: number) => {
      onEdit(index, { ...profile, [field]: numValue });
    };

    // Create a setter for display values
    const setDisplayValue = (displayValue: string) => {
      setDisplayValues(prev => ({ ...prev, [index]: displayValue }));
    };

    // Use the global function to handle formatting and updating
    handleCurrencyChange(value, setDisplayValue, updateAmount, "Amount");
  };

  const handlePercentageChange = (index: number, profile: FundingProfile, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    
    // Prevent negative values
    if (numValue < 0) return;
    
    validatePercentage(index, numValue);
    onEdit(index, { ...profile, Percentage: numValue });
  };

  const getTotalPercentageColor = () => {
    const adjustedTotal = totalPercentage + percentageBalancer;
    // Use Math.abs to check if the difference is within a small tolerance (0.01)
    if (Math.abs(adjustedTotal - 100) < 0.01) return "text-green-600";
    if (adjustedTotal > 100) return "text-red-600";
    return "text-yellow-600";
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
                ({totalPercentage < 100 ? `${(100 - totalPercentage).toFixed(1)}% remaining` : `${(totalPercentage - 100).toFixed(1)}% over`})
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
            <TableHeader className="w-1/6">Actions</TableHeader>
            </TableRow>
        </TableHead>
        <TableBody>
            {fundingProfiles.map((profile, index) => {
              if (profile.IsDeleted) return null;
              return (
              
            <TableRow key={profile.Id === 0 ? `new-${index}` : profile.Id}>
                <TableCell className="w-1/3">
                  <SearchableDropdown
                    options={formatDropdownOptions(initialData?.Dropdowns?.Sources || [], 'Organization', 'Name', 'Id')}
                    value={profile.Source || ''}
                    onChange={(value) => onEdit(index, { ...profile, Source: String(value), Agreement: '' })}
                    placeholder="Select Source"
                    disabled={disabled}
                    allowClear={true}
                    searchPlaceholder="Search sources..."
                  />
                </TableCell>
                <TableCell className="w-1/3">
                  <SearchableDropdown
                    options={formatDropdownOptions(
                      initialData?.Dropdowns?.Agreements?.filter((a) => a.SourceOrg === profile.Source) || [],
                      'Code',
                      'Name',
                      'Id'
                    )}
                    value={profile.Agreement || ''}
                    onChange={(value) => onEdit(index, { ...profile, Agreement: String(value) })}
                    placeholder="Select Agreement"
                    disabled={!profile.Source || disabled}
                    allowClear={true}
                    searchPlaceholder="Search agreements..."
                  />
                </TableCell>
                <TableCell className="w-1/6">
                  <input 
                    type="text"
                    value={displayValues[index] || ''}
                    onChange={(e) => handleAmountChange(index, profile, e.target.value)}
                    onFocus={handleCurrencyFocus}
                    onBlur={(e) => handleCurrencyBlur(e, (value) => onEdit(index, { ...profile, Amount: value }))}
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-right ${getDisabledClass(disabled)}`}
                    placeholder="₱0.00"
                    disabled={disabled}
                   />
                </TableCell>
                <TableCell className="w-1/6">
                    <input
                      type="number"
                      value={profile.Percentage?.toFixed(2) || ''}
                      onChange={(e) => handlePercentageChange(index, profile, e.target.value)}
                      onFocus={handleNumberFocus}
                      className={`w-full px-2 py-1 border rounded text-right bg-gray-100 ${errors[index] ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                      readOnly
                      title="Percentage is automatically calculated based on amount"
                    />
                    {/* {errors[index] && (
                      <span className="text-red-500 text-xs mt-1">{errors[index]}</span>
                    )} */}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onDelete(index)}
                    className={`text-red-600 hover:text-red-800 ${getDisabledClass(disabled)}`}
                    disabled={disabled}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
            </TableRow>
            );
            })}
        </TableBody>
        </Table>
        {/* Validation Summary */}
        {(/*Math.abs(totalPercentage - 100) >= 0.01 || */Object.keys(errors).length > 0) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Validation Issues:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {Math.abs(totalPercentage - 100) >= 0.01 && (
                <li>• Total percentage must equal 100% (currently {totalPercentage.toFixed(2)}%)</li>
              )}
              {Object.keys(errors).length > 0 && (
                <li>• Fix individual field errors shown above</li>
              )}
            </ul>
          </div>
        )}
    </div>
  );
};

export default FundingProfileForm;