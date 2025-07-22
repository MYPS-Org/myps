import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost } from '../Model';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { addComponentCost } from '../Service';

interface ComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: ComponentCost) => void;
  editingCost?: ComponentCost;
  mode: 'add' | 'edit';
}

const ComponentCostDialog: React.FC<ComponentCostDialogProps> = ({
  isOpen,
  onClose,
//   onSave,
  editingCost,
  mode
}) => {
  const [formData, setFormData] = useState<ComponentCost>({
    Id: 0,
    ProjectId: '',
    ComponentType: '',
    ComponentId: '',
    Description: '',
    Total: 0,
    CreatedBy: '',
    CreatedDate: new Date().toISOString(),
    UpdatedBy: '',
    UpdatedDate: new Date().toISOString()
  });

  useEffect(() => {
    if (editingCost && mode === 'edit') {
      setFormData(editingCost);
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        Id: 0,
        ProjectId: '',
        ComponentType: 'Civil Works',
        ComponentId: `CW${Date.now()}`,
        Description: '',
        Total: 0,
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
        UpdatedBy: '',
        UpdatedDate: new Date().toISOString()
      });
    }
  }, [editingCost, mode, isOpen]);

  const handleChange = (field: keyof ComponentCost, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
        addComponentCost(formData)

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
            ComponentType: 'Civil Works',
            ComponentId: '',
            Description: '',
            Total: 0,
            CreatedBy: '',
            CreatedDate: new Date().toISOString(),
            UpdatedBy: '',
            UpdatedDate: new Date().toISOString()
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
                        <option value="Civil Works">Civil Works</option>
                    </select>
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Component ID
                    </label>
                    <input
                        type="text"
                        value={formData.ComponentId}
                        onChange={(e) => handleChange('ComponentId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CW"
                        required
                    />
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
                            Total Cost
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
                            Created By
                        </label>
                        <input
                            type="text"
                            value={formData.CreatedBy}
                            onChange={(e) => handleChange('CreatedBy', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Created Date
                        </label>
                        <input
                            type="date"
                            value={formData.CreatedDate.split('T')[0]}
                            onChange={(e) => handleChange('CreatedDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Updated By
                        </label>
                        <input
                            type="text"
                            value={formData.UpdatedBy}
                            onChange={(e) => handleChange('UpdatedBy', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Updated Date
                        </label>
                        <input
                            type="date"
                            value={formData.UpdatedDate.split('T')[0]}
                            onChange={(e) => handleChange('UpdatedDate', e.target.value)}
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
