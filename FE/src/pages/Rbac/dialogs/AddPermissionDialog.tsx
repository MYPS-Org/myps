import React, { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { AddPermission, PermissionGroup } from '../Model.d'; // Adjust the import path as necessary
import { fetchPermissionGroups, addPermission } from '../service';

interface AddPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (permissionData: AddPermission) => void;
}

const AddPermissionDialog: React.FC<AddPermissionDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    Id: 0,
    PermissionGroupId: 0,
    ModuleFunction: '',
    Description: '',
    CreatedBy: '',
    CreatedDate: new Date().toISOString(),
  });

  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<PermissionGroup[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableGroups();
    }
  }, [isOpen]);

  const fetchAvailableGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const response = await fetchPermissionGroups();
      console.log('Available Groups:', response);
      if (response.Data && response.Data) {
         setAvailableGroups(response.Data);
      }
    } catch (error) {
      console.error('Error fetching user groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await addPermission(formData);
      onSubmit(formData);
      setFormData({
        Id: 0,
        PermissionGroupId: 0,
  
        ModuleFunction: '',
        Description: '',
        CreatedBy: '',
        CreatedDate: new Date().toISOString(),
      });
      onClose();
      resetFormData();
    } catch (error) {
      console.error('Error submitting form:', error);
    }

  };
  const resetFormData = () => {
    setFormData({
      Id: 0,
      PermissionGroupId: 0,
      ModuleFunction: '',
      Description: '',
      CreatedBy: '',
      CreatedDate: new Date().toISOString(),
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add New Permission
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              <textarea
                value={formData.Description}
                onChange={(e) => handleChange('Description', e.target.value)}
                placeholder="Describe what this permission allows..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                <div >Select a group</div>
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
                Add Permission
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddPermissionDialog;
