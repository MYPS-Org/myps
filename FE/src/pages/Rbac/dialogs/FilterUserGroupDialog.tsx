import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { UserGroupFilter } from '../Model';

interface FilterUserGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: UserGroupFilter) => void;
  onClear?: () => void;
    initialData?: UserGroupFilter; // Adjust type as needed

}

const FilterUserGroupDialog: React.FC<FilterUserGroupDialogProps> = ({ isOpen, onClose, onClear, onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    GroupName: initialData?.GroupName || '',
    PermissionNames: initialData?.PermissionNames || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
        GroupName: '',
        PermissionNames: '',
    });
    onClose();
  };

  const handleClear = () => {
    setFormData({
      GroupName: '',
      PermissionNames: '',
    });
    if (onClear) {
      onClose();
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
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Filter User Group
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="text-sm text-gray-600 mb-4">
              Filter User Group. Leave field empty to show all results.
            </div>
            <div className="w-full flex flex-col space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={formData.GroupName}
                  onChange={(e) => handleChange('GroupName', e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permission Name
                </label>
                <input
                  type="text"
                  value={formData.PermissionNames}
                  onChange={(e) => handleChange('PermissionNames', e.target.value)}
                  placeholder="Enter permission name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            
            <div className='flex justify-between items-center mt-4 border-t border-gray-200'>
              <div className='flex items-center space-x-2'>
                <Button type="button" onClick={handleClear} color="zinc" className="mt-2"
                disabled={formData.GroupName === ''}>
                  Clear Filters
                </Button>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" onClick={onClose} color="zinc">
                  Cancel
                </Button>
                <Button type="submit" color="orange">
                  Filter Group
                </Button>
              </div>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FilterUserGroupDialog;
