import React, { useState, useEffect } from "react";
import type { FundingProfile, ProjectFormPayload } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";

interface FundingProfileFormProps {
  initialData?: ProjectFormPayload;
  fundingProfiles: FundingProfile[];
  onAdd: () => void;
  onEdit: (index: number, updatedProfile: FundingProfile) => void;
  onDelete: (index: number) => void;
}

const FundingProfileForm: React.FC<FundingProfileFormProps> = ({ 
  fundingProfiles, 
  onAdd, 
  onEdit, 
  onDelete,
  initialData
}) => {
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const [totalPercentage, setTotalPercentage] = useState(0);

  // Calculate total percentage whenever fundingProfiles change
  useEffect(() => {
    const total = fundingProfiles.reduce((sum, profile) => sum + (profile.Percentage || 0), 0);
    setTotalPercentage(total);
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

  const handlePercentageChange = (index: number, profile: FundingProfile, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    
    // Prevent negative values
    if (numValue < 0) return;
    
    validatePercentage(index, numValue);
    onEdit(index, { ...profile, Percentage: numValue });
  };

  const handlePercentageFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Clear the field if it contains 0
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const getTotalPercentageColor = () => {
    if (totalPercentage === 100) return "text-green-600";
    if (totalPercentage > 100) return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Funding Profile</h2>
        <div className="flex items-center gap-4">
          <div className={`text-sm font-medium ${getTotalPercentageColor()}`}>
            Total: {totalPercentage.toFixed(1)}%
            {totalPercentage !== 100 && (
              <span className="text-xs ml-1">
                ({totalPercentage < 100 ? `${(100 - totalPercentage).toFixed(1)}% remaining` : `${(totalPercentage - 100).toFixed(1)}% over`})
              </span>
            )}
          </div>
          <Button color="blue" onClick={onAdd}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Funding
          </Button>
        </div>
        </div>

        <Table>
        <TableHead>
            <TableRow>
            <TableHeader>Source</TableHeader>
            <TableHeader>Agreement</TableHeader>
            <TableHeader>Percentage</TableHeader>
            <TableHeader>Actions</TableHeader>
            </TableRow>
        </TableHead>
        <TableBody>
            {fundingProfiles.map((profile, index) => (
              
            <TableRow key={profile.Id}>
                <TableCell className="w-1/2">
                  <select
                    name="source"
                    value={profile.Source}
                    onChange={(e) => onEdit(index, { ...profile, Source: Number(e.target.value) })}
                    className=" w-full px-2 py-1 border border-gray-300 rounded"
                    style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                  >
                    <option value="">Select Source</option>
                    {initialData?.Dropdowns?.Sources?.map((source) => (
                      <option key={source.Id} value={source.SourceId}>
                        {source.Name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="w-1/2">
                  <select
                    name="agreement"
                    value={profile.Agreement}
                    onChange={(e) => onEdit(index, { ...profile, Agreement: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded truncate"
                    style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    disabled={!profile.Source} // Disable if no source selected
                  >
                    <option value="">Select Agreement</option>
                    {initialData?.Dropdowns?.Agreements
                      ?.filter((agreement) => agreement.SourceId === profile.Source) // Filter by selected source
                      .map((agreement) => (
                        <option key={agreement.Id} value={agreement.AgreementId}>
                          {agreement.Name}
                        </option>
                      ))}
                  </select>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <input
                      type="number"
                      value={profile.Percentage || ''}
                      onChange={(e) => handlePercentageChange(index, profile, e.target.value)}
                      onFocus={handlePercentageFocus}
                      className={`w-full px-2 py-1 border rounded ${errors[index] ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    {errors[index] && (
                      <span className="text-red-500 text-xs mt-1">{errors[index]}</span>
                    )}
                  </div>
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
        {(totalPercentage !== 100 || Object.keys(errors).length > 0) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Validation Issues:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {totalPercentage !== 100 && (
                <li>• Total percentage must equal 100% (currently {totalPercentage.toFixed(1)}%)</li>
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