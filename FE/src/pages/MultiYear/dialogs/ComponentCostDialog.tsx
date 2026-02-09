import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost, ComponentCostYear, ComponentCostWithYears } from '../Model.d';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { handleCurrencyBlur, handleCurrencyChange } from '../../../utils/GlobalFunctions';
import type { ComponentTypeEnum } from '../../Project/Model';


interface ComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: ComponentCost, costYears?: ComponentCostYear[]) => void; // Changed to accept multiple costYears
  editingCost?: ComponentCostWithYears;
  mode: 'add' | 'edit';
  componentTypes: any[];
  componentCosts: ComponentCost[];
  ProjectId: string;
  maxAmountCost?: number;
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
  maxAmountCost
}) => {
  const [formData, setFormData] = useState({
    Id: 0,
    ProjectId: ProjectId,
    ReferenceId: '',
    ComponentType: '',
    ComponentId: '',
    Description: '',
    Total: 0,
    CreatedBy: '',
    CreatedDate: new Date().toISOString(),
    UpdatedBy: '',
    UpdatedDate: new Date().toISOString(),
  });

  // Separate state for managing cost per year entries
  const [costPerYearEntries, setCostPerYearEntries] = useState<ComponentCostYear[]>([]);
  
  // Display values for currency formatting in cost per year entries
  const [costDisplayValues, setCostDisplayValues] = useState<{ [key: number]: string }>({});

  // Calculate remaining budget for validation
  const calculateRemainingBudget = () => {
    if (!maxAmountCost || maxAmountCost <= 0) return null;
    
    let currentTotalCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);
    
    // If editing, subtract the original cost from current total
    if (mode === 'edit' && editingCost) {
      currentTotalCost -= (editingCost.Total || 0);
    }
    
    return maxAmountCost - currentTotalCost;
  };

  const remainingBudget = calculateRemainingBudget();

  useEffect(() => {
    if (editingCost && mode === 'edit') {
      setFormData({
        Id: editingCost.Id ?? 0,
        ProjectId: editingCost.ProjectId ?? ProjectId,
        ReferenceId: editingCost.ReferenceId ?? '',
        ComponentType: editingCost.ComponentType ?? '',
        ComponentId: editingCost.ComponentId ?? '',
        Description: editingCost.Description ?? '',
        Total: editingCost.Total ?? 0,
        CreatedBy: editingCost.CreatedBy ?? '',
        CreatedDate: editingCost.CreatedDate ?? new Date().toISOString(),
        UpdatedBy: editingCost.UpdatedBy ?? '',
        UpdatedDate: editingCost.UpdatedDate ?? new Date().toISOString(),
      });
      
      // Set cost per year entries from editing data
      const entries = editingCost.CostPerYear || [];
      setCostPerYearEntries(entries);
      
      // Initialize display values for existing entries
      const displayValues: { [key: number]: string } = {};
      entries.forEach((entry, index) => {
        displayValues[index] = entry.Cost > 0 ? entry.Cost.FormatToCurrency() : '';
      });
      setCostDisplayValues(displayValues);
      
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        Id: 0,
        ProjectId: ProjectId,
        ReferenceId: '',
        ComponentType: '',
        ComponentId: '',
        Description: '',
        Total: 0,
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
        UpdatedBy: '',
        UpdatedDate: new Date().toISOString(),
      });
      
      // Reset cost per year entries - add default current year entry for new components
      const currentYear = new Date().getFullYear();
      setCostPerYearEntries([{
          Id: 0,
          ParentId: '',
          CostYear: currentYear,
          Cost: 0,
          PlannedStartDate: new Date().toISOString(),
          PlannedEndDate: new Date().toISOString()
      }]);
      
      // Reset display values
      setCostDisplayValues({ 0: '' });
      console.log('Reset for add mode - costPerYearEntries:', [{
          Id: 0,
          ParentId: '',
          CostYear: currentYear,
          Cost: 0,
          StartDate: new Date().toISOString(),
          EndDate: new Date().toISOString()
      }]);
    }
  }, [editingCost, mode, isOpen]);



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
      const matchingCount = componentCosts.filter(item => item.ComponentType === value).length;
      
      // Create the new ID: "DR-1", "DR-2", etc.
      generatedId = `${selectedComponent.ComponentId}${matchingCount + 1}`;
    }
    // ✅ Save into formData so it's actually submitted
    handleChange('ComponentId', generatedId);
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== ComponentCostDialog handleSubmit triggered ===');
    console.log('Form data:', formData);
    console.log('Cost per year entries:', costPerYearEntries);
    
    try {
        // Calculate total cost from cost per year entries
        const totalFromYears = costPerYearEntries.reduce((sum, entry) => sum + (entry.Cost || 0), 0);
        
        // Validate if the total would exceed max amount cost
        if (maxAmountCost && maxAmountCost > 0) {
          let currentTotalCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);
          
          // If editing, subtract the original cost from current total
          if (mode === 'edit' && editingCost) {
            currentTotalCost -= (editingCost.Total || 0);
          }
          
          const newTotalCost = currentTotalCost + totalFromYears;
          
          if (newTotalCost > maxAmountCost) {
            const exceeded = newTotalCost - maxAmountCost;
            const confirmMessage = `This cost will exceed the maximum budget by ₱${exceeded.toLocaleString('en-PH')}.\n\nTotal cost: ₱${newTotalCost.toLocaleString('en-PH')}\nMax allowed: ₱${maxAmountCost.toLocaleString('en-PH')}\n\nDo you want to proceed anyway?`;
            
            if (!window.confirm(confirmMessage)) {
              return;
            }
          }
        }
        
        // Validate that we have at least one cost per year entry with a cost > 0
        if (costPerYearEntries.length === 0) {
          alert('Please add at least one cost per year entry.');
          return;
        }
        
        const hasValidCosts = costPerYearEntries.some(entry => entry.Cost > 0);
        if (!hasValidCosts) {
          alert('Please enter a cost amount greater than 0 for at least one year.');
          return;
        }
        
        // Validate required fields
        if (!formData.ComponentType) {
          alert('Please select a component type.');
          return;
        }
        
        if (!formData.Description?.trim()) {
          alert('Please enter a description.');
          return;
        }
        
        // Prepare component cost data with total from yearly breakdown
        const componentCostData = {
          ...formData,
          Total: totalFromYears, // Use calculated total from yearly entries
          ReferenceId: mode === 'add' ? '' : formData.ReferenceId // Let ProjectForm generate ReferenceId for new items
        };

        // Send both ComponentCost and ComponentCostYear data to parent
        onSave(componentCostData as ComponentCost, costPerYearEntries);
        
        console.log('Component cost saved:', componentCostData);
        console.log('Component cost years saved:', costPerYearEntries);
        onClose();
    } catch (error) {
      console.error('Error saving component cost:', error);
    }
  };

    const handleReset = () => {
        setFormData({
            Id: 0,
            ProjectId: '',
            ReferenceId: '',
            ComponentType: '',
            ComponentId: '',
            Description: '',
            Total: 0,
            CreatedBy: '',
            CreatedDate: new Date().toISOString(),
            UpdatedBy: '',
            UpdatedDate: new Date().toISOString(),
        });
        const currentYear = new Date().getFullYear();
        setCostPerYearEntries([{
            Id: 0,
            ParentId: '',
            CostYear: currentYear,
            Cost: 0,
            PlannedStartDate: new Date().toISOString(),
            PlannedEndDate: new Date().toISOString()
        }]);
        setCostDisplayValues({ 0: '' });
    };

    // Functions to manage cost per year entries
    const handleAddCostPerYear = () => {
        const currentYear = new Date().getFullYear();
        const newEntry: ComponentCostYear = {
            Id: 0,
            ParentId: '', // Will be set when saved
            CostYear: currentYear,
            Cost: 0,
            PlannedStartDate: new Date().toISOString(),
            PlannedEndDate: new Date().toISOString()
        };
        setCostPerYearEntries(prev => [...prev, newEntry]);
        
        // Add display value for new entry
        setCostDisplayValues(prev => ({
            ...prev,
            [costPerYearEntries.length]: ''
        }));
    };

    const handleUpdateCostPerYear = (index: number, field: keyof ComponentCostYear, value: any) => {
        setCostPerYearEntries(prev => 
            prev.map((entry, i) => 
                i === index ? { ...entry, [field]: value } : entry
            )
        );
    };

    const handleDeleteCostPerYear = (index: number) => {
        setCostPerYearEntries(prev => prev.filter((_, i) => i !== index));
        
        // Remove display value and reindex remaining values
        setCostDisplayValues(prev => {
            const newValues: { [key: number]: string } = {};
            Object.keys(prev).forEach(key => {
                const numKey = parseInt(key);
                if (numKey < index) {
                    newValues[numKey] = prev[numKey];
                } else if (numKey > index) {
                    newValues[numKey - 1] = prev[numKey];
                }
            });
            return newValues;
        });
    };

    // Currency handling functions for cost per year entries
    const handleCostPerYearChange = (index: number, value: string) => {
        console.log(`handleCostPerYearChange called - index: ${index}, value: ${value}`);
        handleCurrencyChange(
            value,
            (displayValue) => {
                console.log(`Setting display value for index ${index}:`, displayValue);
                setCostDisplayValues(prev => ({ ...prev, [index]: displayValue }));
            },
            (_field, numericValue) => {
                console.log(`Setting numeric value for index ${index}:`, numericValue);
                handleUpdateCostPerYear(index, 'Cost', numericValue);
            },
            'Cost'
        );
    };

    const handleCostPerYearFocus = (e: React.FocusEvent<HTMLInputElement>, index: number) => {
        const entry = costPerYearEntries[index];
        if (entry && entry.Cost > 0) {
            e.target.value = entry.Cost.toString();
        } else {
            e.target.value = '';
        }
    };

    const handleCostPerYearBlur = (e: React.FocusEvent<HTMLInputElement>, index: number) => {
        handleCurrencyBlur(e, (numericValue) => {
            handleUpdateCostPerYear(index, 'Cost', numericValue);
            setCostDisplayValues(prev => ({
                ...prev,
                [index]: numericValue > 0 ? numericValue.FormatToCurrency() : ''
            }));
        });
    };

    // Calculate total from cost per year entries
    const calculateTotalFromYears = () => {
        return costPerYearEntries.reduce((sum, entry) => sum + (entry.Cost || 0), 0);
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                    </label>
                    <textarea
                    value={formData.Description}
                    onChange={(e) => handleChange('Description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter description..."
                    required
                    />
                </div>

                {/* Cost Per Year Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-md font-medium text-gray-900">Cost Per Year Breakdown</h4>
                        <Button
                            type="button"
                            color="blue"
                            onClick={handleAddCostPerYear}
                            className="text-sm"
                        >
                            <PlusIcon className="w-4 h-4 mr-1" />
                            Add Year
                        </Button>
                    </div>

                    {costPerYearEntries.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                            <p className="text-gray-500">No cost per year entries added yet. Click "Add Year" to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {costPerYearEntries.map((entry, index) => (
                                <div key={index} className="grid grid-cols-5 gap-3 p-4 border border-gray-200 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Year
                                        </label>
                                        <input
                                            type="number"
                                            value={entry.CostYear}
                                            onChange={(e) => handleUpdateCostPerYear(index, 'CostYear', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min={new Date().getFullYear() - 5}
                                            max={new Date().getFullYear() + 10}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Cost
                                        </label>
                                        <input
                                            type="text"
                                            value={costDisplayValues[index] || ''}
                                            onChange={(e) => handleCostPerYearChange(index, e.target.value)}
                                            onFocus={(e) => handleCostPerYearFocus(e, index)}
                                            onBlur={(e) => handleCostPerYearBlur(e, index)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                            placeholder="₱0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={entry.PlannedStartDate?.split('T')[0] || ''}
                                            onChange={(e) => handleUpdateCostPerYear(index, 'PlannedStartDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={entry.PlannedEndDate?.split('T')[0] || ''}
                                            onChange={(e) => handleUpdateCostPerYear(index, 'PlannedEndDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCostPerYear(index)}
                                            className="w-full px-3 py-3 text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                                        >
                                            <TrashIcon className="w-4 h-4 mx-auto" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Total Summary */}
                    {costPerYearEntries.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">Total Cost:</span>
                                <span className="text-lg font-semibold text-gray-900">
                                    ₱{calculateTotalFromYears().toLocaleString('en-PH')}
                                </span>
                            </div>
                            {remainingBudget !== null && (
                                <div className="mt-2 text-xs text-gray-500">
                                    Remaining budget: ₱{remainingBudget.toLocaleString('en-PH')}
                                    {calculateTotalFromYears() > remainingBudget && (
                                        <span className="text-red-500 ml-2">
                                            (Exceeds by ₱{(calculateTotalFromYears() - remainingBudget).toLocaleString('en-PH')})
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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
