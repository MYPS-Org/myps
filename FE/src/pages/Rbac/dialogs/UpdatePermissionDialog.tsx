import React, { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { PermissionGroup, Permissions } from '../Model.d';
import { fetchPermissionGroups, updatePermission } from '../service';

interface UpdatePermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (permissionData: Permissions) => void;
  permission: Permissions;
}

const UpdatePermissionDialog: React.FC<UpdatePermissionDialogProps> = ({ isOpen, onClose, onSubmit, permission }) => {
  const [formData, setFormData] = useState({
    Id: permission.Id,
    PermissionGroupId: permission.PermissionGroupId || 0,
    ModuleFunction: permission.ModuleFunction || '',
    Description: permission.Description || '',
    CreatedBy: permission.CreatedBy || '',
    CreatedDate: permission.CreatedDate || ''
  });

  const [availableGroups, setAvailableGroups] = useState<PermissionGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {

      fetchAvailableGroups();
    }
  }, [isOpen]);

  const fetchAvailableGroups = async () => {
    try {
      // Fetch available permission groups from the API
      setIsLoadingGroups(true);
      const response = await fetchPermissionGroups();
      console.log('Available Groups:', response);
      if (response.Data && response.Data) {
        setAvailableGroups(response.Data);
      }
    } catch (error) {
      console.error('Error fetching permission groups:', error);
    }finally {
      setIsLoadingGroups(false);
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Call the API to update the permission
      const response = await updatePermission(formData);
      console.log('Update permission response:', response);
      
      // Pass the updated permission data to parent
      onSubmit(formData);
      onClose();
    } catch (error: any) {
      console.error('Error updating permission:', error);
      setError(error.Message || 'Failed to update permission');
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: field === 'PermissionGroupId' ? parseInt(value, 10) : value 
    }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Update Permission
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Module Function
              </label>
              <input
                type="text"
                value={formData.ModuleFunction}
                onChange={(e) => handleChange('ModuleFunction', e.target.value)}
                placeholder="e.g., manage_users"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.Description}
                onChange={(e) => handleChange('Description', e.target.value)}
                placeholder="e.g., Manage Users"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permission Group
              </label>
              <select
                value={formData.PermissionGroupId}
                onChange={(e) => handleChange('PermissionGroupId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a group</option>
                {isLoadingGroups ? (
                  <option disabled>Loading groups...</option>
                ) : (
                  availableGroups.map(group => (
                    <option key={group.Id} value={group.Id}>
                      {group.Name}
                    </option>
                  ))
                )}
              </select>

            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="orange">
                Update Permission
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default UpdatePermissionDialog;
