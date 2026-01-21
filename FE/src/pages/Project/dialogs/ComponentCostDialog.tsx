import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost, ComponentCostYear, ComponentCostWithYears, ComponentTypeEnum } from '../Model';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { handleCurrencyBlur, handleCurrencyChange } from '../../../utils/GlobalFunctions';

interface ComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: ComponentCost, costYear?: ComponentCostYear) => void; // Added costYear parameter
  editingCost?: ComponentCostWithYears;
  mode: 'add' | 'edit';
  componentTypes: ComponentTypeEnum[];
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
    CostPerYear: [] as ComponentCostYear[],
    // Fields for ComponentCostYear
    // ApprovalDate: '',
    // PAPCode: '',
    StartDate: '',
    EndDate: '',
  });

  const [displayValue, setDisplayValue] = useState('');

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
        CostPerYear: editingCost.CostPerYear || [],
        // ApprovalDate: editingCost.CostPerYear?.[0]?.ApprovalDate || '',
        // PAPCode: editingCost.CostPerYear?.[0]?.PAPCode || '',
        StartDate: editingCost.CostPerYear?.[0]?.StartDate || '',
        EndDate: editingCost.CostPerYear?.[0]?.EndDate || '',
      });
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
        CostPerYear: [] as ComponentCostYear[],
        // Fields for ComponentCostYear
        // ApprovalDate: '',
        // PAPCode: '',
        StartDate: '',
        EndDate: '',
      });
    }
  }, [editingCost, mode, isOpen]);

  useEffect(() => {
    if (formData.Total > 0) {
      setDisplayValue(formData.Total.FormatToCurrency());
    } else {
      setDisplayValue('');
    }
  }, [formData.Total]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleCurrencyFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Show raw number on focus for easier editing
    if (formData.Total > 0) {
      e.target.value = formData.Total.toString();
    } else {
      e.target.value = '';
    }
  };

  const [newComponentId, setNewComponentId] = useState('');
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

    setNewComponentId(generatedId)
    // ✅ Save into formData so it's actually submitted
    handleChange('ComponentId', generatedId);
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
        // Validate if the total would exceed max amount cost
        if (maxAmountCost && maxAmountCost > 0) {
          let currentTotalCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);
          
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
        
        // Split the form data into ComponentCost and ComponentCostYear parts
        const { CostPerYear, StartDate, EndDate, ...componentCostData } = formData;
        
        // Create ComponentCostYear object if we have the required fields
        const componentCostYear: ComponentCostYear = {
          Id: 0, // Will be set by backend
          ParentId: componentCostData.ReferenceId, // Will be linked after ComponentCost is saved
          CostYear: new Date().getFullYear(), // Default to current year
          Cost: componentCostData.Total, // Use the same cost value
          // ApprovalDate: ApprovalDate || undefined,
          // PAPCode: PAPCode || '',
          StartDate: StartDate || new Date().toISOString(),
          EndDate: EndDate || new Date().toISOString()
        };

        // Send both ComponentCost and ComponentCostYear data to parent
        onSave(componentCostData as ComponentCost, componentCostYear);
        
        console.log('Component cost saved:', componentCostData);
        console.log('Component cost year saved:', componentCostYear);
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
            CostPerYear: [] as ComponentCostYear[],
            // Fields for ComponentCostYear
            // ApprovalDate: '',
            // PAPCode: '',
            StartDate: new Date().toISOString(),
            EndDate: new Date().toISOString(),
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
                            value={formData.ComponentId || newComponentId}
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

                {/* Cost Years Row */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cost
                        </label>
                        <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => handleCurrencyChange(e.target.value, setDisplayValue, handleChange, 'Total')}
                            onFocus={handleCurrencyFocus}
                            onBlur={(e) => handleCurrencyBlur(e, (value) => handleChange('Total', value))}
                            className={`w-full px-3 py-2 border rounded-md text-right focus:outline-none focus:ring-2 ${
                              remainingBudget !== null && formData.Total > remainingBudget 
                                ? 'border-red-300 focus:ring-red-500' 
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                            placeholder="₱0.00"
                            min="0"
                        />
                        {remainingBudget !== null && (
                          <div className="mt-1">
                            <p className="text-xs text-gray-500">
                              Remaining budget: ₱{remainingBudget.toLocaleString('en-PH')}
                            </p>
                            {formData.Total > remainingBudget && (
                              <p className="text-xs text-red-500">
                                Exceeds remaining budget by ₱{(formData.Total - remainingBudget).toLocaleString('en-PH')}
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
                            Planned Start Date
                        </label>
                        <input
                            type="date"
                            value={formData.StartDate.split('T')[0]}
                            onChange={(e) => handleChange('StartDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Planned End Date
                        </label>
                        <input
                            type="date"
                            value={formData.EndDate.split('T')[0]}
                            onChange={(e) => handleChange('EndDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
