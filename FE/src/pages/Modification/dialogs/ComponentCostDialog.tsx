import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost, ComponentTypeEnum } from '../../Project/Model';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { handleCurrencyBlur, handleCurrencyChange } from '../../../utils/GlobalFunctions';
import { useFieldPermissionState } from '../hooks/useFieldPermissions';
import { useAuth } from '../../../contexts/AuthContext';
import { useAtomValue } from 'jotai';
import { componentCostsAtom } from '../atoms/componentCosts.atom';

interface ComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: ComponentCost) => void;
  editingCost?: ComponentCost;
  mode: 'add' | 'edit';
  componentTypes: ComponentTypeEnum[];
  componentCosts: ComponentCost[];
  ProjectId: string;
  maxAmountCost?: number;
  categoryDesc?: string; // Keep for display purposes
  reasonDesc?: string; // Keep for display purposes
  reasonId?: number; // Keep for reference
  isChangeOfCreditor?: boolean;
  // Removed: currentCase, pcmaStatus, packageStatus - now from Jotai
}

const ComponentCostDialog: React.FC<ComponentCostDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCost,
  mode,
  componentTypes,
  componentCosts,
  ProjectId,
  maxAmountCost,
  isChangeOfCreditor
  // categoryDesc, // May be needed for future display/logging
  // reasonDesc, // May be needed for future display/logging
  // reasonId // May be needed for validation logic
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<{
    Id: number;
    ProjectId: string;
    ComponentType: string;
    ComponentId: string;
    Description: string;
    Amount: number;
    StageName: string;
    StartDate: string | null;
    EndDate: string | null;
    IsDeleted: boolean;
    CreatedBy: string;
    CreatedDate: string;
    UpdatedBy: string;
    UpdatedDate: string;
  }>({
    Id: 0,
    ProjectId: ProjectId,
    ComponentType: '',
    ComponentId: '',
    Description: '',
    Amount: 0,
    StageName: '',
    StartDate: null,
    EndDate: null,
    IsDeleted: false,
    CreatedBy: user?.UserId,
    CreatedDate: new Date().toISOString(),
    UpdatedBy: '',
    UpdatedDate: new Date().toISOString(),
  });

  const [displayValue, setDisplayValue] = useState('');

  // Get all component costs from Jotai atom (seeded from API)
  const allComponentCosts = useAtomValue(componentCostsAtom);

  // Get terminated Civil Works components for Change of Creditor dropdown
  const getTerminatedCivilWorksOptions = useMemo(() => {
    if (!isChangeOfCreditor || !allComponentCosts || allComponentCosts.length === 0) return [];
    
    // Filter for terminated Civil Works components
    const terminatedCWComponents = allComponentCosts
      .filter((cost: ComponentCost) => {
        const isTerminated = cost.ConstructionStatusName?.toLowerCase() === 'terminated';
        const isCivilWorks = cost.ComponentType?.toLowerCase() === 'civil works';
        return isTerminated && isCivilWorks && !cost.IsDeleted;
      })
      .map((cost: ComponentCost) => cost.ComponentId)
      .filter(Boolean);

    // Generate options with alphabet suffix (e.g., CW1A, CW2A, CW3A)
    const allOptions: string[] = [];
    
    terminatedCWComponents.forEach((componentId: string) => {
      const baseId = componentId; // e.g., "CW1"
      
      // Find existing components with this base ID (excluding the one being edited)
      const existingWithSuffix = componentCosts.filter(c => {
        const matchesBase = c.ComponentId?.startsWith(baseId) && c.ComponentId !== baseId && !c.IsDeleted;
        // When editing, exclude the current component from the count
        const isCurrentlyEditing = mode === 'edit' && editingCost && c.ComponentId === editingCost.ComponentId;
        return matchesBase && !isCurrentlyEditing;
      });
      
      // If in edit mode and current component starts with this base, include it
      if (mode === 'edit' && editingCost?.ComponentId?.startsWith(baseId) && editingCost.ComponentId !== baseId) {
        allOptions.push(editingCost.ComponentId);
      }
      
      // Generate next available alphabet (A, B, C, etc.)
      const nextLetter = String.fromCharCode(65 + existingWithSuffix.length); // 65 = 'A'
      const nextOption = `${baseId}${nextLetter}`;
      
      // Only add if not already in options (avoid duplicates)
      if (!allOptions.includes(nextOption)) {
        allOptions.push(nextOption);
      }
    });

    // Remove duplicates and sort
    return [...new Set(allOptions)].sort();
  }, [isChangeOfCreditor, allComponentCosts, componentCosts, mode, editingCost]);

  // Get field permissions state
  const permissionState = useFieldPermissionState();

  // Helper function to check if a field is editable based on fieldRules from API
  const fieldPermissionsMap = useMemo(() => {
    // EXCEPTION: When adding new component (mode === 'add'), all fields should be editable
    if (mode === 'add' || mode === 'edit') {
      return {
        StartDate: true,
        EndDate: true,
        Amount: true,
        Description: true,
        ComponentType: true,
      };
    }

    if (!permissionState.fieldRules) return {};

    const permissions: Record<string, boolean> = {};

    // Get ComponentCostRules fields
    const componentCostFields = permissionState.fieldRules.ComponentCostRules?.Fields;
    if (componentCostFields) {
      Object.assign(permissions, componentCostFields);
    }

    return permissions;
  }, [permissionState.fieldRules, mode]);

  // Function to check if a specific field is editable
  const isFieldEditable = useCallback((field: string) => {
    return fieldPermissionsMap[field] === true;
  }, [fieldPermissionsMap]);

  // Calculate remaining budget for validation
  const calculateRemainingBudget = () => {
    if (!maxAmountCost || maxAmountCost <= 0) return null;
    
    let currentTotalCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Amount || 0), 0);
    
    // If editing, subtract the original cost from current total
    if (mode === 'edit' && editingCost) {
      currentTotalCost -= (editingCost.Amount || 0);
    }
    
    return maxAmountCost - currentTotalCost;
  };

  const remainingBudget = calculateRemainingBudget();

  useEffect(() => {
    if (editingCost && mode === 'edit') {
      setFormData({
        Id: editingCost.Id ?? 0,
        ProjectId: editingCost.ProjectId ?? ProjectId,
        ComponentType: editingCost.ComponentType ?? '',
        ComponentId: editingCost.ComponentId ?? '',
        Description: editingCost.Description ?? '',
        Amount: editingCost.Amount ?? 0,
        StageName: editingCost.StageName ?? '',
        StartDate: editingCost.StartDate ?? null,
        EndDate: editingCost.EndDate ?? null,
        IsDeleted: editingCost.IsDeleted ?? false,
        CreatedBy: editingCost.CreatedBy ?? '',
        CreatedDate: editingCost.CreatedDate ?? new Date().toISOString(),
        UpdatedBy: editingCost.UpdatedBy ?? '',
        UpdatedDate: editingCost.UpdatedDate ?? new Date().toISOString(),
      });
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        Id: 0,
        ProjectId: ProjectId,
        ComponentType: '',
        ComponentId: '',
        Description: '',
        Amount: 0,
        StageName: '',
        StartDate: null,
        EndDate: null,
        IsDeleted: false,
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
        UpdatedBy: '',
        UpdatedDate: new Date().toISOString(),
      });
    }
  }, [editingCost, mode, isOpen, ProjectId]);

  useEffect(() => {
    if (formData.Amount > 0) {
      setDisplayValue(formData.Amount.FormatToCurrency());
    } else {
      setDisplayValue('');
    }
  }, [formData.Amount]);

  const handleChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleCurrencyFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Show raw number on focus for easier editing
    if (formData.Amount > 0) {
      e.target.value = formData.Amount.toString();
    } else {
      e.target.value = '';
    }
  };

  const handleChangeComponentId = (value: string) => {
    const selectedComponent = componentTypes.find(type => type.ComponentName === value);
    
    if (!selectedComponent) {
      return;
    }

    let generatedId = selectedComponent.ComponentId || '';
    
    // Only add number increment if the component type is "Civil Works"
    if (value.toLowerCase() === 'civil works') {
      // Count how many existing componentCosts have the same ComponentType
      console.log('Selected component:', componentCosts);
      const matchingCount = componentCosts.filter(item => item.ComponentType === value && !item.IsDeleted).length;
      
      // Create the new ID: "CW1", "CW2", etc.
      generatedId = `${selectedComponent.ComponentId}${matchingCount + 1}`;
    }
    // Save into formData so it's actually submitted
    handleChange('ComponentId', generatedId);
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
        // Validate if the amount would exceed max amount cost
        if (mode === 'add' && formData.Amount <= 0) {
          alert('Amount must be greater than zero when adding a new component.');
          return;
        }

        if (maxAmountCost && maxAmountCost > 0) {
          let currentTotalCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Amount || 0), 0);
          
          // If editing, subtract the original cost from current total
          if (mode === 'edit' && editingCost) {
            currentTotalCost -= (editingCost.Amount || 0);
          }
          
          const newTotalCost = currentTotalCost + (formData.Amount || 0);
          
          if (newTotalCost > maxAmountCost) {
            const exceeded = newTotalCost - maxAmountCost;
            const confirmMessage = `This cost will exceed the maximum budget by ₱${exceeded.toLocaleString('en-PH')}.\n\nTotal cost: ₱${newTotalCost.toLocaleString('en-PH')}\nMax allowed: ₱${maxAmountCost.toLocaleString('en-PH')}\n\nDo you want to proceed anyway?`;
            
            if (!window.confirm(confirmMessage)) {
              return;
            }
          }
        }
        
        // Send ComponentCost data to parent
        onSave(formData as ComponentCost);
        
        console.log('Component cost saved:', formData);
        onClose();
    } catch (error) {
      console.error('Error saving component cost:', error);
    }
  };

    const handleReset = () => {
      setFormData({
          Id: 0,
          ProjectId: '',
          ComponentType: '',
          ComponentId: '',
          Description: '',
          Amount: 0,
          StageName: '',
          StartDate: null,
          EndDate: null,
          IsDeleted: false,
          CreatedBy: '',
          CreatedDate: new Date().toISOString(),
          UpdatedBy: '',
          UpdatedDate: new Date().toISOString(),
      });
    };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        {/* Full-screen container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                    {mode === 'add' ? 'Add Project Component Cost' : 'Edit Project Component Cost'}
                </DialogTitle>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 "
                    >
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Component Type and ID Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Component Type <span className="text-xs text-gray-500">{isFieldEditable('ComponentType') ? '✓ Editable' : '✗ Not Editable'}</span>
                    </label>
                    <select 
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500${
                          !isFieldEditable('ComponentType')
                            ? ' bg-gray-100 cursor-not-allowed' 
                            : ''
                          }`}
                        value={formData.ComponentType}
                        disabled={!isFieldEditable('ComponentType')}
                        onChange={(e) => { 
                            const value = e.target.value; 
                            handleChange('ComponentType', value);
                            if (!isChangeOfCreditor) {
                                handleChangeComponentId(value);
                            }
                        }}
                    >   
                    <option value="">Select Component Type</option>
                        {componentTypes
                            ?.filter((c) => ['CW', 'CWD', 'ROW', 'DR', 'EAO', 'EXC', 'SAV'].includes(c.ComponentId || ''))
                            .map((type: any) => (
                                <option key={type.Id} value={type.ComponentName}>
                                    {type.ComponentName}
                                </option>
                            ))
                        }
                    </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Component ID 
                            {isChangeOfCreditor && formData.ComponentType?.toLowerCase() === 'civil works' && (
                              <span className="text-xs text-gray-500"> (Select from terminated components)</span>
                            )}
                        </label>
                        {isChangeOfCreditor && formData.ComponentType?.toLowerCase() === 'civil works' ? (
                          // Dropdown for terminated Civil Works components
                          getTerminatedCivilWorksOptions.length > 0 ? (
                            <select
                              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                              value={formData.ComponentId}
                              onChange={(e) => handleChange('ComponentId', e.target.value)}
                            >
                              <option value="">Select Component ID</option>
                              {getTerminatedCivilWorksOptions.map((option: any) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                              No terminated Civil Works components available
                            </div>
                          )
                        ) : isChangeOfCreditor ? (
                          // Manual input for other component types when Change of Creditor
                          <input 
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                            type="text" 
                            value={formData.ComponentId}
                            onChange={(e) => handleChange('ComponentId', e.target.value)}
                            placeholder="Enter Component ID"
                          />
                        ) : (
                          // Auto-generated for normal flow
                          <input 
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50'
                            type="text" 
                            value={formData.ComponentId}
                            readOnly
                          />
                        )}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-xs text-gray-500">{isFieldEditable('Description') ? '✓ Editable' : '✗ Not Editable'}</span>
                    </label>
                    <textarea
                    value={formData.Description}
                    onChange={(e) => handleChange('Description', e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      !isFieldEditable('Description')
                        ? 'bg-gray-100 cursor-not-allowed' 
                        : ''
                    }`}
                    disabled={!isFieldEditable('Description')}
                    placeholder="Enter description..."
                    required
                    title={`Description field is ${isFieldEditable('Description') ? 'editable' : 'not editable'}`}
                    />
                </div>

                {/* Cost Years Row */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount <span className="text-xs text-gray-500">{isFieldEditable('Amount') ? '✓ Editable' : '✗ Not Editable'}</span>
                        </label>
                        <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => handleCurrencyChange(e.target.value, setDisplayValue, handleChange, 'Amount')}
                            onFocus={handleCurrencyFocus}
                            onBlur={(e) => handleCurrencyBlur(e, (value) => handleChange('Amount', value))}
                            className={`w-full px-3 py-2 border rounded-md text-right focus:outline-none focus:ring-2 ${
                              remainingBudget !== null && formData.Amount > remainingBudget 
                                ? 'border-red-300 focus:ring-red-500' 
                                : 'border-gray-300 focus:ring-blue-500'
                            } ${!isFieldEditable('Amount')
                                    ? 'bg-gray-100 cursor-not-allowed' 
                                    : ''}
                            `}
                            placeholder="₱0.00"
                            min="0"
                            disabled={!isFieldEditable('Amount')}
                        />
                        {remainingBudget !== null && (
                          <div className="mt-1">
                            <p className="text-xs text-gray-500">
                              Remaining budget: ₱{remainingBudget.toLocaleString('en-PH')}
                            </p>
                            {formData.Amount > remainingBudget && (
                              <p className="text-xs text-red-500">
                                Exceeds remaining budget by ₱{(formData.Amount - remainingBudget).toLocaleString('en-PH')}
                              </p>
                            )}
                          </div>
                        )}
                    </div>
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date of Approval
                        </label>
                        <input
                            type="date"
                            value={formData.ApprovalDate}
                            onChange={(e) => handleChange('ApprovalDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div> */}
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            UACS PAP Code
                        </label>
                        <input
                            type="text"
                            value={formData.PAPCode}
                            onChange={(e) => handleChange('PAPCode', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div> */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Planned Start Date <span className="text-xs text-gray-500">{isFieldEditable('StartDate') ? '✓ Editable' : '✗ Not Editable'}</span>
                        </label>
                        <input
                            type="date"
                            value={formData.StartDate ? formData.StartDate.split('T')[0] : ''}
                            onChange={(e) => handleChange('StartDate', e.target.value || null)}
                            disabled={!isFieldEditable('StartDate')}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                !isFieldEditable('StartDate')
                                    ? 'bg-gray-100 cursor-not-allowed' 
                                    : ''
                            }`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Planned End Date <span className="text-xs text-gray-500">{isFieldEditable('EndDate') ? '✓ Editable' : '✗ Not Editable'}</span>
                        </label>
                        <input
                            type="date"
                            value={formData.EndDate ? formData.EndDate.split('T')[0] : ''}
                            onChange={(e) => handleChange('EndDate', e.target.value || null)}
                            disabled={!isFieldEditable('EndDate')}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                !isFieldEditable('EndDate')
                                    ? 'bg-gray-100 cursor-not-allowed' 
                                    : ''
                            }`}
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <Button type="button" color="zinc" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button type="submit" color="orange" onClick={handleSubmit}>
                        {mode === 'add' ? 'Add' : 'Save'}
                    </Button>
                </div>
            </form>
        </DialogPanel>
        </div>
    </Dialog>
  );
};

export default ComponentCostDialog;
