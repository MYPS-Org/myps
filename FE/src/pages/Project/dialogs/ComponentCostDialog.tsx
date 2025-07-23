import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost, ComponentCostYear, ComponentCostWithYears } from '../Model';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { addComponentCost, initProgramDetails } from '../Service';

interface ComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: ComponentCost) => void;
  editingCost?: ComponentCostWithYears;
  mode: 'add' | 'edit';
  componentTypes: any[];
}

const ComponentCostDialog: React.FC<ComponentCostDialogProps> = ({
  isOpen,
  onClose,
//   onSave,
  editingCost,
  mode,
  componentTypes
}) => {
  const [formData, setFormData] = useState({
    Id: 0,
    ProjectId: '',
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
    ApprovalDate: '',
    PAPCode: '',
    StartDate: new Date().toISOString(),
    EndDate: new Date().toISOString(),
  });

  useEffect(() => {
    if (editingCost && mode === 'edit') {
      setFormData({
        ...editingCost,
        CostPerYear: editingCost.CostPerYear || [],
        // Initialize ComponentCostYear fields from the first year if available
        ApprovalDate: editingCost.CostPerYear?.[0]?.ApprovalDate || '',
        PAPCode: editingCost.CostPerYear?.[0]?.PAPCode || '',
        StartDate: editingCost.CostPerYear?.[0]?.StartDate || new Date().toISOString(),
        EndDate: editingCost.CostPerYear?.[0]?.EndDate || new Date().toISOString(),
      });
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        Id: 0,
        ProjectId: '',
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
        ApprovalDate: '',
        PAPCode: '',
        StartDate: new Date().toISOString(),
        EndDate: new Date().toISOString(),
      });
    }
  }, [editingCost, mode, isOpen]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
        // Only save the ComponentCost part, not the CostPerYear
        const { CostPerYear, ...componentCostData } = formData;
        
        addComponentCost(componentCostData as ComponentCost);

    // onSave(finalCost);
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
            Total: 0,
            CreatedBy: '',
            CreatedDate: new Date().toISOString(),
            UpdatedBy: '',
            UpdatedDate: new Date().toISOString(),
            CostPerYear: [] as ComponentCostYear[],
            // Fields for ComponentCostYear
            ApprovalDate: '',
            PAPCode: '',
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
                    {mode === 'add' ? 'Add Cost' : 'Edit Cost'}
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
                        onChange={(e) => handleChange('ComponentType', e.target.value)}
                    >
                        {componentTypes.map((type: any) => (
                            <option key={type.Id} value={type.Id}>
                                {type.Description}
                            </option>
                        ))}
                    </select>
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Component ID
                    </label>
                    <select 
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    value={formData.ComponentId}
                    onChange={(e) => handleChange('ComponentId', e.target.value)}
                    >
                        {componentTypes.map((type: any) => (
                            <option key={type.Id} value={type.Id}>
                                {type.Description}
                            </option>
                        ))}
                    </select>
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
                <div className="grid grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cost
                        </label>
                        <input
                            type="number"
                            value={formData.Total}
                            onChange={(e) => handleChange('Total', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            min="0"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date of Approval
                        </label>
                        <input
                            type="text"
                            value={formData.ApprovalDate}
                            onChange={(e) => handleChange('ApprovalDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            UACsPAP Code
                        </label>
                        <input
                            type="text"
                            value={formData.PAPCode}
                            onChange={(e) => handleChange('PAPCode', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
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
