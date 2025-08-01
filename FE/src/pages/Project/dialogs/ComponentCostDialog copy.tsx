import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ComponentCost } from '../Model';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/16/solid';

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
    Cost: 0,
    MYCAApproval: '',
    UACsPAPCode: '',
    PlannedStartDate: ''
  });

  const [additionalYears, setAdditionalYears] = useState<Array<{ 
    year: number;
    cost: number;
    Myca: Date | null;
    UACsPAPCode: string;
    PlannedStartDate: string | null;
    PlannedEndDate: string | null;
  }>>([]);

  useEffect(() => {
    if (editingCost && mode === 'edit') {
      setFormData(editingCost);
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        Id: `CW${Date.now()}`, // Generate unique ID
        Description: '',
        Cost: 0,
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
    setAdditionalYears(prev => [...prev, { 
        year: nextYear,
        cost: 0,
        Myca: null,
        UACsPAPCode: '',
        PlannedStartDate: null,
        PlannedEndDate: null
      }]);
  };

  const handleYearCostChange = (index: number, field: string, value: string | number | Date | null) => {
  setAdditionalYears(prev => prev.map((item, i) => {
    if (i === index) {
      return { ...item, [field]: value };
    }
    return item;
  }));
};

  const handleRemoveYear = (index: number) => {
    setAdditionalYears(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const baseCosts = (formData.Cost);
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
        Cost: 0,
        MYCAApproval: '',
        UACsPAPCode: '',
        PlannedStartDate: '',
        PlannedEndDate: '' // Add this field
    });
    setAdditionalYears([]);
    };

    const getOrdinal = (n: number): string => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
                <div className="grid grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            1st year Cost {new Date().getFullYear()}
                        </label>
                        <input
                            type="number"
                            value={formData.Cost}
                            onChange={(e) => handleChange('Cost', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            min="0"
                        />
                    </div>
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Planned End Date
                        </label>
                        <input
                            type="date"
                            value={formData.PlannedEndDate}
                            onChange={(e) => handleChange('PlannedEndDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {additionalYears.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Years
                    </label>
                    <div className="space-y-4">
                    {additionalYears.map((item, index) => (
                        <div key={index} className="flex items-center space-x-4">
                            <div className='grid grid-cols-5 gap-4 p-4 border border-gray-200 rounded-lg'>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {getOrdinal(index + 2)} year Cost {item.year}
                                    </label>
                                    <input
                                    type="number"
                                    value={item.cost}
                                    onChange={(e) => handleYearCostChange(index, 'cost', Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0"
                                    min="0"
                                    />
                                </div>

                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                    MYCA Approval Date
                                    </label>
                                    <input
                                    type="date"
                                    value={item.Myca ? item.Myca.toISOString().split('T')[0] : ''}
                                    onChange={(e) =>
                                        handleYearCostChange(index, 'Myca', e.target.value ? new Date(e.target.value) : null)
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                    UACS PAP Code
                                    </label>
                                    <input
                                    type="text"
                                    value={item.UACsPAPCode}
                                    onChange={(e) => handleYearCostChange(index, 'UACsPAPCode', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Planned Start Date
                                    </label>
                                    <input
                                    type="date"
                                    value={item.PlannedStartDate || ''}
                                    onChange={(e) => handleYearCostChange(index, 'PlannedStartDate', e.target.value || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Planned End Date
                                    </label>
                                    <input
                                    type="date"
                                    value={item.PlannedEndDate || ''}
                                    onChange={(e) => handleYearCostChange(index, 'PlannedEndDate', e.target.value || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="col-span-1 flex items-center justify-center">
                            <button
                            type="button"
                            onClick={() => handleRemoveYear(index)}
                            className="bg-red-600 text-white hover:text-red-800 p-1 w-fit aspect-square rounded-md hover:bg-red-100"
                            aria-label="Remove year"
                            >
                            <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
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
