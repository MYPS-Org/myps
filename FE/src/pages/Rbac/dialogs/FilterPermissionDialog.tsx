import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { PermissionFilter } from '../Model';

interface FilterPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: PermissionFilter) => void;
  onClear?: () => void;
  initialData?: PermissionFilter;
}

const FilterPermissionDialog: React.FC<FilterPermissionDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onClear,
  initialData 
}) => {
  const [formData, setFormData] = useState({
    Module: initialData?.Module || '',
    ModuleFunction: initialData?.ModuleFunction || '',
    ModuleFunctionDescription: initialData?.ModuleFunctionDescription || ''
  });

  // Reset form data when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        Module: initialData?.Module || '',
        ModuleFunction: initialData?.ModuleFunction || '',
        ModuleFunctionDescription: initialData?.ModuleFunctionDescription || ''
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleClear = () => {
    setFormData({
      Module: '',
      ModuleFunction: '',
      ModuleFunctionDescription: ''
    });
    if (onClear) {
      onClear();
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Filter Permissions
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="text-sm text-gray-600 mb-4">
              Filter permissions by module function or description. Leave fields empty to show all results.
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module
                </label>
                <input
                  type="text"
                  value={formData.Module || ''}
                  onChange={(e) => handleChange('Module', e.target.value)}
                  placeholder="Search by controller/module..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module Function
                </label>
                <input
                  type="text"
                  value={formData.ModuleFunction || ''}
                  onChange={(e) => handleChange('ModuleFunction', e.target.value)}
                  placeholder="Search by module function..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.ModuleFunctionDescription || ''}
                  onChange={(e) => handleChange('ModuleFunctionDescription', e.target.value)}
                  placeholder="Search by description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClear} color="zinc" disabled={
                !formData.Module && !formData.ModuleFunction && !formData.ModuleFunctionDescription
              }>
                Clear Filter
              </Button>
              <div className="flex space-x-3">
                <Button type="button" onClick={onClose} color="zinc">
                  Cancel
                </Button>
                <Button type="submit" color="orange">
                  Apply Filter
                </Button>
              </div>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FilterPermissionDialog;
