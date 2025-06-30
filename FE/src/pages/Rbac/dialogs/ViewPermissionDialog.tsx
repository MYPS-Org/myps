import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Permissions } from '../Model.d';

interface ViewPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // onSubmit: (permissionData: any) => void;
  permission: Permissions;
}

const ViewPermissionDialog: React.FC<ViewPermissionDialogProps> = ({ isOpen, onClose, /*onSubmit*/  permission }) => {
  const [formData, setFormData] = useState({
    ModuleFunction: permission.ModuleFunction || '',
    CreatedBy: permission.CreatedBy || '',
    CreatedDate: permission.CreatedDate || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // onSubmit(formData);
    setFormData({
      ModuleFunction: '',
      CreatedBy: '',
      CreatedDate: ''
    });
    onClose();
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              View Permission
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Module Function
              </label>
              <input
                type="text"
                value={formData.ModuleFunction}
                onChange={(e) => handleChange('ModuleFunction', e.target.value)}
                placeholder="e.g., manage_users"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created By {formData.CreatedBy}
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              {/* <Button type="submit" color="blue">
                Add Permission
              </Button> */}
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ViewPermissionDialog;
