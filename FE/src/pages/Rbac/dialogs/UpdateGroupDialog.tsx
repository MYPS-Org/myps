import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { UserGroups, Permissions } from '../Model.d';
import { fetchPermissions as fetchPermissionsAPI } from '../service';

interface UpdateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupData: any) => void;
  group: UserGroups;
};

const UpdateGroupDialog: React.FC<UpdateGroupDialogProps> = ({ isOpen, onClose, onSubmit, group }) => {
  const [formData, setFormData] = useState({
    id: group.Id,
    groupName: group.GroupName || '',
    description: group.Description || '',
    permissionsName: group.PermissionsName ? group.PermissionsName.split(',').map(p => p.trim()) : [],
    numberOfUsers: group.NumberOfUsers || 0
  });

  const [availablePermissions, setAvailablePermissions] = useState<Permissions[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  // const availablePermissions = [
  //   'User Management',
  //   'View Reports',
  //   'Edit Content',
  //   'Delete Records',
  //   'Role Management',
  //   'System Settings',
  //   'Audit Logs',
  //   'Data Export',
  //   'API Access',
  //   'Notifications'
  // ];
  useEffect(() => {
    // Fetch available permissions when the dialog opens
    const fetchAvailablePermissions = async () => {
      try {
        setIsLoadingPermissions(true);
        const response = await fetchPermissionsAPI({
          page: 1,
          limit: 100, // Get all permissions
          Filters: {
            PermissionGroupName: '',
            ModuleFunction: '',
            Description: ''
          }
        });
        
        if (response.Data && response.Data.lists) {
          setAvailablePermissions(response.Data.lists);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    if (isOpen) {
      fetchAvailablePermissions();
    }
  }, [isOpen]);

  // Update form data when group prop changes
  useEffect(() => {
    setFormData({
      id: group.Id,
      groupName: group.GroupName || '',
      description: group.Description || '',
      permissionsName: group.PermissionsName ? group.PermissionsName.split(',').map(p => p.trim()) : [],
      numberOfUsers: group.NumberOfUsers || 0
    });
  }, [group]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert permissions array back to comma-separated string
    const submissionData = {
      Id: formData.id,
      GroupName: formData.groupName,
      Description: formData.description,
      PermissionsName: formData.permissionsName.join(','),
      NumberOfUsers: formData.numberOfUsers
    };
    
    onSubmit(submissionData);
    onClose();
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionToggle = (permissionName: string) => {
    setFormData(prev => ({
      ...prev,
      permissionsName: prev.permissionsName.includes(permissionName)
        ? prev.permissionsName.filter(p => p !== permissionName)
        : [...prev.permissionsName, permissionName]
    }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Update Group
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className='grid grid-cols-3 gap-4 mb-4'>
              <div>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={formData.groupName}
                      onChange={(e) => handleChange('groupName', e.target.value)}
                      placeholder="Enter group name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Member Count
                    </label>
                    <input
                      type="number"
                      value={formData.numberOfUsers}
                      onChange={(e) => handleChange('numberOfUsers', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Enter group description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                    required
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                {isLoadingPermissions ? (
                  <div className="text-sm text-gray-500 p-4">Loading permissions...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-100 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                    {availablePermissions.length > 0 ? (
                      availablePermissions.map((permission) => (
                        <label key={permission.Id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissionsName.includes(permission.ModuleFunction)}
                            onChange={() => handlePermissionToggle(permission.ModuleFunction)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {permission.ModuleFunction}
                          </span>
                        </label>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No permissions available</div>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {formData.permissionsName.length} permission(s)
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button color="zinc" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" color="orange">
                Update Group
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default UpdateGroupDialog;
