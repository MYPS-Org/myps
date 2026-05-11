import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost, ComponentCostPerYear, ComponentTypeEnum } from '../Model';
import { XMarkIcon, PlusIcon, TrashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/toaster/ToasterContext';
import '../../../utils/GlobalFunctions';
import { getDisabledClass } from '../../../utils/GlobalFunctions';
import type { ProgramList } from '../../Program/Model';
import { autoFillComponentDescription } from '../Service';


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
  ReferenceId?: string;
  maxAmountCost?: number;
  disabled?: boolean;
  programDetails: ProgramList;
  hasMajorLocations?: boolean;
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
  ReferenceId,
  maxAmountCost,
  disabled = false,
  programDetails,
  hasMajorLocations = false
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
    RevisedNumber: 0,
    CreatedBy: user?.UserId || '',
    CreatedDate: new Date().toISOString(),
    UpdatedBy: user?.UserId || '',
    UpdatedDate: new Date().toISOString(),
    IsDeleted: false
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
        ReferenceId || '',
        formData.ComponentId,
        programDetails.ProgramId,
        programDetails.StageName
      );
      const description = response?.Data?.component_description ?? response?.Data?.description ?? response?.Data?.Description ?? '';
      if (description) {
        handleChange('Description', description);
        console.log('Auto-filled description:', description);
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
    const newPerYearCost: ComponentCostPerYear = {
      Id: 0,
      ComponentCostId: formData.CostId,
      Amount: 0,
      Year: programDetails?.YearStart + nonDeletedCosts.length,
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

  const handleEditPerYearCost = (index: number, field: keyof ComponentCostPerYear, value: any) => {
    setComponentCostPerYear(prev => 
      prev.map((cost, i) => 
        i === index ? { ...cost, [field]: value } : cost
      )
    );
  };

  const handleDeletePerYearCost = (index: number) => {
    setComponentCostPerYear(prev => {
      const cost = prev[index];
      if (cost.Id === 0) {
        // Hard delete: unsaved item, remove from array
        return prev.filter((_, i) => i !== index);
      }
      // Soft delete: saved in DB, mark as deleted for backend
      return prev.map((c, i) => i === index ? { ...c, IsDeleted: true } : c);
    });
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
        CostId: editingCost.CostId ?? '',
        ComponentType: editingCost.ComponentType ?? '',
        ComponentId: editingCost.ComponentId ?? '',
        Description: editingCost.Description ?? '',
        Total: editingCost.Total ?? 0,
        StageName: editingCost.StageName || '',
        RevisedNumber: editingCost.RevisedNumber ?? 0,
        CreatedBy: editingCost.CreatedBy ?? '',
        CreatedDate: editingCost.CreatedDate ?? new Date().toISOString(),
        UpdatedBy: editingCost.UpdatedBy ?? '',
        UpdatedDate: editingCost.UpdatedDate ?? new Date().toISOString(),
        IsDeleted: editingCost.IsDeleted ?? false
      });
      
      // Set per-year costs if editing
      if (editingCostPerYear) {
        setComponentCostPerYear(editingCostPerYear.filter(cost => !cost.IsDeleted));
      }
      isInitializedRef.current = true;
    } else if (mode === 'add') {
      // Reset form for new entry
      const tempCostId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setFormData({
        Id: 0,
        ProjectId: ProjectId,
        CostId: tempCostId,
        ComponentType: '',
        ComponentId: '',
        Description: '',
        Total: 0,
        StageName: '',
        RevisedNumber: 0,
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
        UpdatedBy: '',
        UpdatedDate: new Date().toISOString(),
        IsDeleted: false
      });
      setComponentCostPerYear([]);
      isInitializedRef.current = true;
    }
  }, [editingCost, editingCostPerYear, mode, isOpen]);

  // Calculate total amount from per-year costs
  useEffect(() => {
    const total = componentCostPerYear
      .filter(cost => !cost.IsDeleted)
      .reduce((sum, cost) => sum + (cost.Amount || 0), 0);
    
    setFormData(prev => ({ ...prev, Total: total }));
  }, [componentCostPerYear]);

  // useEffect(() => {
  //   if (formData.Total > 0) {
  //     setDisplayValue(formData.Total.FormatToCurrency());
  //   } else {
  //     setDisplayValue('');
  //   }
  // }, [formData.Total]);

  const handleChange = (field: string, value: string | number) => {
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
      
      // Create the new ID: "DR-1", "DR-2", etc.
      generatedId = `${selectedComponent.ComponentId}${matchingCount + 1}`;
    }
    // ✅ Save into formData so it's actually submitted
    handleChange('ComponentId', generatedId);
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if(formData.ComponentType === '' || formData.ComponentId === '') {
      showToast({
        type: 'error',
        message: 'Please select a Component Type.'
      });
      return;
    }

    if(componentCostPerYear.filter(cost => !cost.IsDeleted).length === 0) {
      showToast({
        type: 'error',
        message: 'Please add at least one per-year cost.'
      });
      return;
    }

    // Validate per-year costs
    const validPerYearCosts = componentCostPerYear.filter(cost => !cost.IsDeleted);
    for (let i = 0; i < validPerYearCosts.length; i++) {
      const cost = validPerYearCosts[i];
      if (!cost.Year || cost.Year <= 0) {
        showToast({
          type: 'error',
          message: `Please enter a valid year for cost entry ${i + 1}.`
        });
        return;
      }
      if (!cost.Amount || cost.Amount <= 0) {
        showToast({
          type: 'error',
          message: `Please enter a valid amount for cost entry ${i + 1}.`
        });
        return;
      }
      if (!cost.StartDate) {
        showToast({
          type: 'error',
          message: `Please select a Start Date for cost entry ${i + 1}.`
        });
        return;
      }
      if (!cost.EndDate) {
        showToast({
          type: 'error',
          message: `Please select an End Date for cost entry ${i + 1}.`
        });
        return;
      }
      // Validate date range
      const startStr = cost.StartDate.split('T')[0];
      const endStr   = cost.EndDate.split('T')[0];
      const yearMin  = `${cost.Year}-01-01`;
      const yearMax  = `${cost.Year}-12-31`;
      if (startStr < yearMin || startStr > yearMax || (endStr && startStr > endStr)) {
        showToast({ type: 'error', message: `Start Date for entry ${i + 1} is out of range.` });
        return;
      }
      if (endStr < yearMin || endStr > yearMax || (startStr && endStr < startStr)) {
        showToast({ type: 'error', message: `End Date for entry ${i + 1} is out of range.` });
        return;
      }
    }

    if(formData.Total <= 0) {
      showToast({
        type: 'error',
        message: 'Total amount must be greater than zero.'
      });
      return;
    }
    
    try {
        // Validate if the total would exceed max amount cost
        if (maxAmountCost && maxAmountCost > 0) {
          let currentTotalCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Total || 0), 0);
          console.log('Current total cost:', currentTotalCost);
          
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
          RevisedNumber: formData.RevisedNumber,
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
        console.log('Component cost saved:', componentCostData);
        console.log('Per-year costs saved:', perYearCosts);
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
            RevisedNumber: 0,
            CreatedBy: '',
            CreatedDate: new Date().toISOString(),
            UpdatedBy: '',
            UpdatedDate: new Date().toISOString(),
            IsDeleted: false
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
                        Component Type
                    </label>
                    <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.ComponentType}
                        onChange={(e) => { 
                            const value = e.target.value; 
                            handleChange('ComponentType', value);
                            handleChangeComponentId(value);
                        }}
                        required
                    >   
                    <option value="">Select Component Type</option>
                        {componentTypes?.map((type: ComponentTypeEnum) => (
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
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                            type="text" 
                            value={formData.ComponentId}
                            readOnly
                        />
                    {/* <select 
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    value={formData.ComponentId}
                    onChange={(e) => handleChange('ComponentId', e.target.value)}
                    >
                        {componentTypes.map((type: any) => (
                            <option key={type.Id} value={type.Id}>
                                {type.Name}
                            </option>
                        ))}
                    </select> */}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                            Description
                        </label>
                        {hasMajorLocations && (
                          <button
                              type="button"
                              onClick={handleAutoFillDescription}
                              disabled={isAutoFilling || !formData.ComponentId}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter description..."
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

                                const startDateStr = cost.StartDate ? cost.StartDate.split('T')[0] : '';
                                const endDateStr   = cost.EndDate   ? cost.EndDate.split('T')[0]   : '';
                                const yearMin = cost.Year ? `${cost.Year}-01-01` : '';
                                const yearMax = cost.Year ? `${cost.Year}-12-31` : '';

                                const isStartDateInvalid = startDateStr !== '' && (
                                    (yearMin && startDateStr < yearMin) ||
                                    (yearMax && startDateStr > yearMax) ||
                                    (endDateStr && startDateStr > endDateStr)
                                );
                                const isEndDateInvalid = endDateStr !== '' && (
                                    (yearMin && endDateStr < yearMin) ||
                                    (yearMax && endDateStr > yearMax) ||
                                    (startDateStr && endDateStr < startDateStr)
                                );

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
                                            <label className={`block text-xs font-medium mb-1 ${isStartDateInvalid ? 'text-red-600' : 'text-gray-700'}`}>
                                                Start Date
                                                {isStartDateInvalid && <span className="ml-1 text-red-500">(out of range)</span>}
                                            </label>
                                            <input
                                                type="date"
                                                value={startDateStr}
                                                onChange={(e) => handleEditPerYearCost(index, 'StartDate', e.target.value || null)}
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
                                            <label className={`block text-xs font-medium mb-1 ${isEndDateInvalid ? 'text-red-600' : 'text-gray-700'}`}>
                                                End Date
                                                {isEndDateInvalid && <span className="ml-1 text-red-500">(out of range)</span>}
                                            </label>
                                            <input
                                                type="date"
                                                value={endDateStr}
                                                onChange={(e) => handleEditPerYearCost(index, 'EndDate', e.target.value || null)}
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
                                        <div className=''>
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
                        {/* {remainingBudget !== null && (
                            <div className="text-xs text-gray-500 mt-1">
                                Remaining budget: ₱{remainingBudget.toLocaleString('en-PH')}
                                {formData.Total > remainingBudget && (
                                    <span className="text-red-500 block">
                                        Exceeds by ₱{(formData.Total - remainingBudget).toLocaleString('en-PH')}
                                    </span>
                                )}
                            </div>
                        )} */}
                    </div>
                </div>

                {/* Original Cost Fields (for reference/backward compatibility) */}
                <div className="grid grid-cols-3 gap-4">
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Total Cost (Auto-calculated)
                        </label>
                        <input
                            type="text"
                            value={displayValue}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-right bg-gray-50 focus:outline-none"
                            placeholder="₱0.00"
                        />
                    </div> */}
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

export default ComponentCostDialog;
