import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost } from '../Model';
import { XMarkIcon } from '@heroicons/react/24/outline';

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
  onSave,
  editingCost,
  mode
}) => {
  const [formData, setFormData] = useState<ComponentCost>({
    Id: '',
    Description: '',
    Cost2025: 0,
    Cost2026: 0,
    MYCAApproval: '',
    UACsPAPCode: '',
    PlannedStartDate: ''
  });

  const [additionalYears, setAdditionalYears] = useState<Array<{ year: number; cost: number }>>([]);

  useEffect(() => {
    if (editingCost && mode === 'edit') {
      setFormData(editingCost);
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        Id: `CW${Date.now()}`, // Generate unique ID
        Description: '',
        Cost2025: 0,
        Cost2026: 0,
        MYCAApproval: '',
        UACsPAPCode: '',
        PlannedStartDate: ''
      });
      setAdditionalYears([]);
    }
  }, [editingCost, mode, isOpen]);

  const handleChange = (field: keyof ComponentCost, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddYear = () => {
    const currentYear = new Date().getFullYear();
    const nextYear = Math.max(2027, currentYear + additionalYears.length + 1);
    setAdditionalYears(prev => [...prev, { year: nextYear, cost: 0 }]);
  };

  const handleYearCostChange = (index: number, cost: number) => {
    setAdditionalYears(prev => prev.map((item, i) => 
      i === index ? { ...item, cost } : item
    ));
  };

  const handleRemoveYear = (index: number) => {
    setAdditionalYears(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const baseCosts = (formData.Cost2025 || 0) + (formData.Cost2026 || 0);
    const additionalCosts = additionalYears.reduce((sum, item) => sum + item.cost, 0);
    return baseCosts + additionalCosts;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create the final cost object with additional years
    const finalCost: ComponentCost = {
      ...formData,
      // You might want to store additional years in a separate field
      // For now, we'll just use the base structure
    };

    onSave(finalCost);
    onClose();
  };

  const handleReset = () => {
    setFormData({
      Id: '',
      Description: '',
      Cost2025: 0,
      Cost2026: 0,
      MYCAApproval: '',
      UACsPAPCode: '',
      PlannedStartDate: ''
    });
    setAdditionalYears([]);
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
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl">
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
                        value="Civil Works" // You can make this dynamic
                        disabled
                    >
                        <option>Civil Works</option>
                    </select>
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Component ID
                    </label>
                    <input
                        type="text"
                        value={formData.Id}
                        onChange={(e) => handleChange('Id', e.target.value)}
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
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        1st year Cost {new Date().getFullYear()}
                    </label>
                    <input
                        type="number"
                        value={formData.Cost2025}
                        onChange={(e) => handleChange('Cost2025', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        min="0"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        2nd year Cost
                    </label>
                    <input
                        type="number"
                        value={formData.Cost2026}
                        onChange={(e) => handleChange('Cost2026', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        min="0"
                    />
                    </div>
                </div>

                {/* Additional Years */}
                {additionalYears.length > 0 && (
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Years
                    </label>
                    <div className="space-y-2">
                        {additionalYears.map((item, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                            type="number"
                            value={item.year}
                            readOnly
                            className="w-24 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                            />
                            <input
                            type="number"
                            value={item.cost}
                            onChange={(e) => handleYearCostChange(index, Number(e.target.value))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Cost"
                            min="0"
                            />
                            <Button
                            type="button"
                            color="red"
                            onClick={() => handleRemoveYear(index)}
                            className="px-3"
                            >
                            Remove
                            </Button>
                        </div>
                        ))}
                    </div>
                    </div>
                )}

                {/* Add Year Button */}
                <div>
                    <Button
                    type="button"
                    color="blue"
                    onClick={handleAddYear}
                    className="text-sm"
                    >
                    + Add Year
                    </Button>
                </div>

                {/* Other Fields Row */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        MYCA Approval Date
                    </label>
                    <input
                        type="date"
                        value={formData.MYCAApproval}
                        onChange={(e) => handleChange('MYCAApproval', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        UACS PAP Code
                    </label>
                    <input
                        type="text"
                        value={formData.UACsPAPCode}
                        onChange={(e) => handleChange('UACsPAPCode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter code"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Planned Start Date
                    </label>
                    <input
                        type="date"
                        value={formData.PlannedStartDate}
                        onChange={(e) => handleChange('PlannedStartDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    </div>
                </div>

                {/* Total Display */}
                <div className="p-4 bg-gray-50 rounded-lg items-center text-center">
                    <div className="text-sm text-gray-600">Total (PHP)</div>
                    <div className="text-lg font-semibold text-blue-600">
                    ₱{calculateTotal().toLocaleString('en-PH')}
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
