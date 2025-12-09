import React, { useState, useEffect } from "react";
import type { FundingProfile, ProjectFormPayload } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import { getDisabledClass, handleCurrencyBlur, handleCurrencyChange, handleCurrencyFocus, handleNumberFocus } from "../../../utils/GlobalFunctions";

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

  // Calculate total percentage and amount, then auto-update percentages
  useEffect(() => {
    const totalAmt = fundingProfiles.reduce((sum, profile) => sum + (profile.Amount || 0), 0);
    setTotalAmount(totalAmt);

    // Create updated profiles with recalculated percentages
    fundingProfiles.forEach((profile, index) => {
      if (totalAmt > 0) {
        const calculatedPercentage = ((profile.Amount || 0) / totalAmt) * 100;
        const roundedPercentage = Math.round(calculatedPercentage * 100) / 100; // Round to 2 decimal places
        
        // Only update if the percentage has changed to avoid infinite loops
        if (profile.Percentage !== roundedPercentage) {
          // Update the profile with new percentage
          onEdit(index, { ...profile, Percentage: roundedPercentage });
        }
      } else {
        // If total amount is 0, set percentage to 0
        if (profile.Percentage !== 0) {
          onEdit(index, { ...profile, Percentage: 0 });
        }
      }
    });

    // Calculate total percentage for display using the current state
    // We need to use a setTimeout to ensure state updates are processed first
    setTimeout(() => {
      const total = fundingProfiles.reduce((sum, profile) => sum + (profile.Percentage || 0), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      setTotalPercentage(roundedTotal);
    }, 0);

    if (onTotalAmountChange) {
      onTotalAmountChange(totalAmt);
    }
  }, [fundingProfiles]); // Trigger when array length or amounts change

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
    // Use Math.abs to check if the difference is within a small tolerance (0.01)
    if (Math.abs(totalPercentage - 100) < 0.01) return "text-green-600";
    if (totalPercentage > 100) return "text-red-600";
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
            {fundingProfiles.map((profile, index) => (
              
            <TableRow key={profile.Id === 0 ? `new-${index}` : profile.Id}>
                <TableCell className="w-1/3">
                  <select
                    name="source"
                    value={profile.Source}
                    onChange={(e) => onEdit(index, { ...profile, Source: String(e.target.value) })}
                    className={`${getDisabledClass(disabled)} w-full px-2 py-1 border border-gray-300 rounded truncate`}
                    disabled={disabled}
                    // style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                  >
                    <option value="">Select Source</option>
                    {initialData?.Dropdowns?.Sources?.map((source) => (
                      <option key={source.Id} value={source.Organization}>
                        {source.Name} 
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="w-1/3">
                  <select
                    name="agreement"
                    value={profile.Agreement}
                    onChange={(e) => onEdit(index, { ...profile, Agreement: String(e.target.value) })}
                    className={`${getDisabledClass(disabled)} w-full px-2 py-1 border border-gray-300 rounded truncate`}
                    // style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    disabled={!profile.Source || disabled} // Disable if no source selected
                  >
                    <option value="">Select Agreement</option>
                    {initialData?.Dropdowns?.Agreements
                      ?.filter((agreement) => agreement.SourceOrg === profile.Source) // Filter by selected source
                      .map((agreement) => (
                        <option key={agreement.Id} value={agreement.Code}>
                          {agreement.Name}
                        </option>
                      ))}
                  </select>
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
                    className="text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
            </TableRow>
            ))}
        </TableBody>
        </Table>
        
        {/* Validation Summary */}
        {(Math.abs(totalPercentage - 100) >= 0.01 || Object.keys(errors).length > 0) && (
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