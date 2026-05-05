import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost, ComponentCostPerYear, ComponentTypeEnum } from '../../Project/Model';
import type { ProgramList } from '../../Program/Model';
import { XMarkIcon, PlusIcon, TrashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useFieldPermissionState } from '../hooks/useFieldPermissions';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAtomValue } from 'jotai';
import { componentCostsAtom } from '../atoms/componentCosts.atom';
import { MajorItemLocationsAtom } from '../atoms/majorItemLocations.atom';
import '../../../utils/GlobalFunctions';
import { autoFillComponentDescription } from '../../Project/Service';

interface ComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: ComponentCost, costPerYear: ComponentCostPerYear[]) => void;
  editingCost?: ComponentCost;
  editingCostPerYear?: ComponentCostPerYear[];
  mode: 'add' | 'edit';
  componentTypes: ComponentTypeEnum[];
  componentCosts: ComponentCost[];
  ProjectId: string;
  maxAmountCost?: number;
  categoryDesc?: string; // Keep for display purposes
  reasonDesc?: string; // Keep for display purposes
  reasonId?: number; // Keep for reference
  isChangeOfCreditor?: boolean;
  programDetails?: ProgramList;
  // Removed: currentCase, pcmaStatus, packageStatus - now from Jotai
}

const ComponentCostDialog: React.FC<ComponentCostDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCost,
  editingCostPerYear,
  mode,
  componentTypes,
  componentCosts,
  ProjectId,
  maxAmountCost,
  isChangeOfCreditor,
  programDetails
  // categoryDesc, // May be needed for future display/logging
  // reasonDesc, // May be needed for future display/logging
  // reasonId // May be needed for validation logic
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<ComponentCost>({
    Id: 0,
    ProjectId: ProjectId,
    CostId: '',
    ComponentType: '',
    ComponentId: '',
    Description: '',
    Total: 0,
    StageName: '',
    IsDeleted: false,
    CreatedBy: user?.UserId || '',
    CreatedDate: new Date().toISOString(),
    UpdatedBy: user?.UserId || '',
    UpdatedDate: new Date().toISOString(),
  });

  const [componentCostPerYear, setComponentCostPerYear] = useState<ComponentCostPerYear[]>([]);
  const [isAutoFilling, setIsAutoFilling] = useState<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  const handleAutoFillDescription = async () => {
    if (!formData.ComponentId) {
      showToast({ type: 'error', message: 'Please select a Component Type first.' });
      return;
    }
    setIsAutoFilling(true);
    try {
      const response = await autoFillComponentDescription(
        user?.UserId || '',
        formData.ProjectId || ProjectId,
        formData.ComponentId,
        programDetails?.ProgramId || '',
        programDetails?.StageName || ''
      );
      const description = response?.Data?.component_description ?? response?.Data?.description ?? response?.Data?.Description ?? '';
      if (description) {
        handleChange('Description', description);
        showToast({ type: 'success', message: 'Description auto-filled successfully.' });
      } else {
        showToast({ type: 'info', message: 'No description found for this component.' });
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to auto-fill description. Please try again.' });
    } finally {
      setIsAutoFilling(false);
    }
  };

  const majorItemLocations = useAtomValue(MajorItemLocationsAtom);
  const hasMajorLocations = majorItemLocations.some(l => !l.IsDeleted);

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
    if (mode === 'add') {
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

  // Save button is enabled if:
  // - mode is 'add' (always allowed)
  // - OR any field under ComponentCostRules.Fields or ComponentCostPerYearRules.Fields is true
  const canSave = useMemo(() => {
    if (mode === 'add') return true;
    const fieldRules = permissionState.fieldRules;
    if (!fieldRules) return false;

    const componentCostFields = fieldRules.ComponentCostRules?.Fields;
    const perYearFields = fieldRules.ComponentCostYearRules?.Fields;

    const anyComponentCostEditable = componentCostFields
      ? Object.values(componentCostFields).some(v => v === true)
      : false;

    const anyPerYearEditable = perYearFields
      ? Object.values(perYearFields).some(v => v === true)
      : false;

    return anyComponentCostEditable || anyPerYearEditable;
  }, [mode, permissionState.fieldRules]);

  // Calculate remaining budget for validation
  const calculateRemainingBudget = () => {
    if (!maxAmountCost || maxAmountCost <= 0) return null;
    
    let currentTotalCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Total || 0), 0);
    
    // If editing, subtract the original cost from current total
    if (mode === 'edit' && editingCost) {
      currentTotalCost -= (editingCost.Total || 0);
    }
    
    return maxAmountCost - currentTotalCost;
  };

  const remainingBudget = calculateRemainingBudget();

  // Per-year cost management functions
  const handleAddPerYearCost = () => {
    const nonDeletedCosts = componentCostPerYear.filter(cost => !cost.IsDeleted);
    const baseYear = programDetails?.YearStart || new Date().getFullYear();
    const newPerYearCost: ComponentCostPerYear = {
      Id: 0,
      ComponentCostId: formData.CostId,
      Amount: 0,
      Year: baseYear + nonDeletedCosts.length,
      StartDate: null,
      EndDate: null,
      CreatedBy: user?.UserId || '',
      CreatedDate: new Date().toISOString(),
      UpdatedBy: '',
      UpdatedDate: '',
      IsDeleted: false
    };
    setComponentCostPerYear(prev => [...prev, newPerYearCost]);
  };

  // Calculate total amount from per-year costs
  useEffect(() => {
    const total = componentCostPerYear
      .filter(cost => !cost.IsDeleted)
      .reduce((sum, cost) => sum + (cost.Amount || 0), 0);
    
    setFormData(prev => ({ ...prev, Total: total }));
  }, [componentCostPerYear]);

  const handleEditPerYearCost = (index: number, field: keyof ComponentCostPerYear, value: any) => {
    setComponentCostPerYear(prev => 
      prev.map((cost, i) => 
        i === index ? { ...cost, [field]: value } : cost
      )
    );
  };

  const handleDeletePerYearCost = (index: number) => {
    setComponentCostPerYear(prev => 
      prev.map((cost, i) => 
        i === index ? { ...cost, IsDeleted: true } : cost
      )
    );
  };

  // Reset initialization flag when dialog opens/closes or mode changes
  useEffect(() => {
    isInitializedRef.current = false;
  }, [isOpen, mode]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    if (editingCost && mode === 'edit') {
      setFormData({
        Id: editingCost.Id ?? 0,
        ProjectId: editingCost.ProjectId ?? ProjectId,
        CostId: editingCost.CostId ?? editingCost.ComponentId ?? '',
        ComponentType: editingCost.ComponentType ?? '',
        ComponentId: editingCost.ComponentId ?? '',
        Description: editingCost.Description ?? '',
        Total: editingCost.Total ?? 0,
        StageName: editingCost.StageName ?? '',
        IsDeleted: editingCost.IsDeleted ?? false,
        CreatedBy: editingCost.CreatedBy ?? '',
        CreatedDate: editingCost.CreatedDate ?? new Date().toISOString(),
        UpdatedBy: editingCost.UpdatedBy ?? '',
        UpdatedDate: editingCost.UpdatedDate ?? new Date().toISOString(),
      });
      
      // Set per-year costs if editing
      if (editingCostPerYear) {
        setComponentCostPerYear(editingCostPerYear.filter(cost => !cost.IsDeleted));
      }
      isInitializedRef.current = true;
    } else if (mode === 'add') {
      // Reset form for new entry
      const tempComponentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setFormData({
        Id: 0,
        ProjectId: ProjectId,
        CostId: tempComponentId, // Temporary ID for new entries
        ComponentType: '',
        ComponentId: '',
        Description: '',
        Total: 0,
        StageName: '',
        IsDeleted: false,
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
        UpdatedBy: '',
        UpdatedDate: new Date().toISOString(),
      });
      setComponentCostPerYear([]);
      isInitializedRef.current = true;
    }
  }, [editingCost, editingCostPerYear, mode, isOpen, ProjectId, user?.UserId]);

  const handleChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        // Validate component type and ID
        if(formData.ComponentType === '' || formData.ComponentId === '') {
          showToast({ type: 'error', message: 'Please select a Component Type.' });
          return;
        }

        if(componentCostPerYear.filter(cost => !cost.IsDeleted).length === 0) {
          showToast({ type: 'error', message: 'Please add at least one per-year cost.' });
          return;
        }

        // Validate per-year costs
        const validPerYearCosts = componentCostPerYear.filter(cost => !cost.IsDeleted);
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
        }

        if(formData.Total <= 0) {
          const confirmMessage = 'The total cost for this component is zero. Are you sure you want to save?';
          if (!window.confirm(confirmMessage)) {
            return;
          }
        }

        if (maxAmountCost && maxAmountCost > 0) {
          let currentTotalCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Total || 0), 0);
          
          // If editing, subtract the original cost from current total
          if (mode === 'edit' && editingCost) {
            currentTotalCost -= (editingCost.Total || 0);
          }
          
          const newTotalCost = currentTotalCost + (formData.Total || 0);
          
          if (newTotalCost > maxAmountCost) {
            const exceeded = newTotalCost - maxAmountCost;
            const confirmMessage = `This cost will exceed the maximum budget by ₱${exceeded.toLocaleString('en-PH')}.\n\nTotal cost: ₱${newTotalCost.toLocaleString('en-PH')}\nMax allowed: ₱${maxAmountCost.toLocaleString('en-PH')}\n\nDo you want to proceed anyway?`;
            
            if (!window.confirm(confirmMessage)) {
              return;
            }
          }
        }
        
        // Create ComponentCost object
        const componentCostData: ComponentCost = {
          Id: formData.Id,
          ProjectId: formData.ProjectId,
          CostId: formData.CostId,
          ComponentType: formData.ComponentType,
          ComponentId: formData.ComponentId,
          Description: formData.Description,
          Total: formData.Total,
          StageName: formData.StageName,
          CreatedBy: user?.UserId || '',
          CreatedDate: formData.CreatedDate,
          UpdatedBy: user?.UserId,
          UpdatedDate: new Date().toISOString(),
          IsDeleted: formData.IsDeleted
        };

        // Prepare per-year costs with updated metadata
        // Include soft-deleted items (Id > 0) so the parent/backend can handle removal
        const perYearCosts = componentCostPerYear
          .map(cost => ({
            ...cost,
            ComponentCostId: formData.CostId,
            CreatedBy: cost.CreatedBy || user?.UserId || '',
            UpdatedBy: user?.UserId || '',
            UpdatedDate: new Date().toISOString()
          }));

        // Send ComponentCost and ComponentCostPerYear data to parent
        onSave(componentCostData, perYearCosts);
        // console.log('Component cost saved:', componentCostData);
        // console.log('Per-year costs saved:', perYearCosts);
        onClose();
    } catch (error) {
      console.error('Error saving component cost:', error);
    }
  };

    const handleReset = () => {
        const tempCostId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setFormData({
            Id: 0,
            ProjectId: '',
            CostId: tempCostId,
            ComponentType: '',
            ComponentId: '',
            Description: '',
            Total: 0,
            StageName: '',
            IsDeleted: false,
            CreatedBy: '',
            CreatedDate: new Date().toISOString(),
            UpdatedBy: '',
            UpdatedDate: new Date().toISOString()
        });
        setComponentCostPerYear([]);
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
                    onClick={handleClose}
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
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                            Description <span className="text-xs text-gray-500">{isFieldEditable('Description') ? '✓ Editable' : '✗ Not Editable'}</span>
                        </label>
                        {hasMajorLocations && (
                          <button
                              type="button"
                              onClick={handleAutoFillDescription}
                              disabled={isAutoFilling || !formData.ComponentId || !isFieldEditable('Description')}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Auto-fill description from GIS"
                          >
                              <SparklesIcon className="w-3.5 h-3.5" />
                              {isAutoFilling ? 'Filling...' : 'Auto-fill'}
                          </button>
                        )}
                    </div>
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
                    title={`Description field is ${isFieldEditable('Description') ? 'editable' : 'not editable'}`}
                    />
                </div>

                {/* Per-Year Costs Section */}
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
                    
                    {componentCostPerYear.filter(cost => !cost.IsDeleted).length === 0 ? (
                        <div className="text-center text-gray-500 py-4 border border-dashed border-gray-300 rounded-md">
                            No per-year costs added yet. Click "Add Year" to get started.
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
                            {componentCostPerYear.map((cost, index) => {
                                if (cost.IsDeleted) return null;
                                return (
                                    <div key={index} className="grid grid-cols-[120px_1fr_1fr_1fr_auto] gap-3 items-end p-3 bg-gray-50 rounded border">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Year
                                            </label>
                                            <input
                                                type="number"
                                                value={cost.Year || ''}
                                                onChange={(e) => handleEditPerYearCost(index, 'Year', parseInt(e.target.value) || 0)}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder={String(programDetails?.YearStart || new Date().getFullYear())}
                                                min={programDetails?.YearStart?.toString() || '2000'}
                                                max={programDetails?.YearEnd?.toString() || '2100'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Amount
                                            </label>
                                            <input
                                                type="text"
                                                value={cost.Amount ? cost.Amount.toLocaleString('en-PH') : ''}
                                                onChange={(e) => {
                                                    // Remove all non-numeric characters except decimal points
                                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                                    const numericValue = parseFloat(value) || 0;
                                                    handleEditPerYearCost(index, 'Amount', numericValue);
                                                }}
                                                onFocus={(e) => {
                                                    // Show raw number on focus for easier editing
                                                    const rawValue = cost.Amount || 0;
                                                    e.target.value = rawValue > 0 ? rawValue.toString() : '';
                                                }}
                                                onBlur={(e) => {
                                                    // Parse the raw input and format it
                                                    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                                                    const numericValue = parseFloat(rawValue) || 0;
                                                    handleEditPerYearCost(index, 'Amount', numericValue);
                                                    // Update display to formatted value
                                                    e.target.value = numericValue > 0 ? numericValue.toLocaleString('en-PH') : '';
                                                }}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="₱0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Start Date
                                            </label>
                                            <input
                                                type="date"
                                                value={cost.StartDate ? cost.StartDate.split('T')[0] : ''}
                                                onChange={(e) => handleEditPerYearCost(index, 'StartDate', e.target.value || null)}
                                                onKeyDown={(e) => e.preventDefault()}
                                                min={cost.Year ? `${cost.Year}-01-01` : undefined}
                                                max={cost.EndDate ? cost.EndDate.split('T')[0] : (cost.Year ? `${cost.Year}-12-31` : undefined)}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                End Date
                                            </label>
                                            <input
                                                type="date"
                                                value={cost.EndDate ? cost.EndDate.split('T')[0] : ''}
                                                onChange={(e) => handleEditPerYearCost(index, 'EndDate', e.target.value || null)}
                                                onKeyDown={(e) => e.preventDefault()}
                                                min={cost.StartDate ? cost.StartDate.split('T')[0] : (cost.Year ? `${cost.Year}-01-01` : undefined)}
                                                max={cost.Year ? `${cost.Year}-12-31` : undefined}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                        <div className=''>
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePerYearCost(index)}
                                                className="text-red-600 hover:text-red-800 p-1"
                                                title="Delete this year entry"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {/* Total Cost Display */}
                    <div className="mt-3 p-3 bg-blue-50 rounded border">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Total Cost:</span>
                            <span className={`text-lg font-semibold ${
                                remainingBudget !== null && formData.Total > remainingBudget 
                                    ? 'text-red-600' 
                                    : 'text-blue-600'
                            }`}>
                                ₱{formData.Total.toLocaleString('en-PH')}
                            </span>
                        </div>
                        {remainingBudget !== null && (
                            <div className="text-xs text-gray-500 mt-1">
                                Remaining budget: ₱{remainingBudget.toLocaleString('en-PH')}
                                {formData.Total > remainingBudget && (
                                    <span className="text-red-500 block">
                                        Exceeds by ₱{(formData.Total - remainingBudget).toLocaleString('en-PH')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <Button type="button" color="zinc" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button type="submit" color="orange" disabled={!canSave}>
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
