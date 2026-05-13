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
  userGroupOptions?: { Id: number; GroupName: string }[];
}

const FilterUserDialog: React.FC<FilterUserDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onClear,
  initialData,
  userGroupOptions = [],
}) => {
  const [formData, setFormData] = useState({
    Name: initialData?.Name || '',
    UserGroup: initialData?.UserGroup || undefined as string | undefined,
    IsActive: undefined as boolean | undefined
  });

  // Reset form data when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        Name: initialData?.Name || '',
        UserGroup: initialData?.UserGroup || undefined,
        IsActive: initialData?.IsActive !== undefined ? initialData.IsActive : undefined
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
      Name: '',
      UserGroup: undefined,
      IsActive: undefined
    });
    if (onClear) {
      onClear();
    }
  };

  const handleChange = (field: string, value: string) => {
    if (field === 'IsActive') {
      let boolValue: boolean | undefined;
      if (value === 'active') {
        boolValue = true;
      } else if (value === 'inactive') {
        boolValue = false;
      } else {
        boolValue = undefined;
      }
      setFormData(prev => ({ ...prev, [field]: boolValue }));
    } else if (field === 'UserGroup') {
      setFormData(prev => ({ ...prev, UserGroup: value === '' ? undefined : value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Group
                </label>
                <select
                  value={formData.UserGroup || ''}
                  onChange={(e) => handleChange('UserGroup', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                >
                  <option value="">All Groups</option>
                  {userGroupOptions.map(g => (
                    <option key={g.Id} value={g.GroupName}>{g.GroupName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select 
                  name="Status" 
                  id="Status" 
                  value={
                    formData.IsActive === true ? 'active' : 
                    formData.IsActive === false ? 'inactive' : 
                    ''
                  } 
                  onChange={(e) => handleChange('IsActive', e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClear} color="zinc" disabled={
                !formData.Name && !formData.UserGroup && formData.IsActive === undefined}>
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
