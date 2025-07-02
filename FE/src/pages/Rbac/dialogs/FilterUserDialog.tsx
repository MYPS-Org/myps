import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
// import type { Users } from '../Model';

interface FilterUserdialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: any) => void;

}

const FilterUserDialog: React.FC<FilterUserdialogProps> = ({ isOpen, onClose, onSubmit}) => {
  const [formData, setFormData] = useState({
    Name: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
        Name: '',
    });
    onClose();
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
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Filter User
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.Name}
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                  placeholder="Enter employee ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="orange">
                Add User
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FilterUserDialog;
