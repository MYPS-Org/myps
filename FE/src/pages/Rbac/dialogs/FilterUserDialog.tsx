import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { UserFilter } from '../Model';

interface FilterUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: UserFilter) => void;
  onClear?: () => void;
  initialData?: UserFilter;
}

const FilterUserDialog: React.FC<FilterUserDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onClear,
  initialData 
}) => {
  const [formData, setFormData] = useState({
    Name: initialData?.Name || '',
  });

  // Reset form data when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        Name: initialData?.Name || '',
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only submit if at least one field has a value
    const hasValues = formData.Name?.trim();
    if (hasValues) {
      onSubmit(formData);
    } else {
      // If no values, treat as clear filter
      onSubmit({
        Name: ''
      });
    }
    onClose();
  };

  const handleClear = () => {
    setFormData({
      Name: ''
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
              Filter Users
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
              Filter users by name. Leave field empty to show all results.
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.Name || ''}
                  onChange={(e) => handleChange('Name', e.target.value)}
                  placeholder="Search by user name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClear} color="zinc">
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

export default FilterUserDialog;
