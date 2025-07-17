import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Permissions, PermissionGroup } from '../Model.d';
import { fetchPermissions, fetchPermissionGroups, addUserGroup } from '../service';

interface AddGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const AddGroupDialog: React.FC<AddGroupDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    groupName: '',
    description: '',
    permissions: [] as number[], // Changed to store permission IDs
    module: '',
    memberCount: 0
  });

  const [availablePermissions, setAvailablePermissions] = useState<Permissions[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [groupedPermissions, setGroupedPermissions] = useState<{[key: number]: Permissions[]}>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch permissions and permission groups when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailablePermissions();
      fetchAvailablePermissionGroups();
    }
  }, [isOpen]);

  // Group permissions by permissionGroupId when data changes
  useEffect(() => {
    if (availablePermissions.length > 0) {
      const grouped = availablePermissions.reduce((acc, permission) => {
        const groupId = permission.PermissionGroupId;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(permission);
        return acc;
      }, {} as {[key: number]: Permissions[]});
      setGroupedPermissions(grouped);
    }
  }, [availablePermissions]);

  const fetchAvailablePermissions = async () => {
    try {
      setIsLoadingPermissions(true);
      const response = await fetchPermissions({
        page: 1,
        limit: 1000, // Get all permissions
        filters: {}
      });
      console.log('Available Permissions:', response);
      if (response.Data && response.Data.lists) {
        setAvailablePermissions(response.Data.lists);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const fetchAvailablePermissionGroups = async () => {
    try {
      const response = await fetchPermissionGroups();
      console.log('Available Permission Groups:', response);
      if (response.Data) {
        setPermissionGroups(response.Data);
      }
    } catch (error) {
      console.error('Error fetching permission groups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const submissionData = {
        GroupName: formData.groupName,
        Description: formData.description,
        PermissionIds: formData.permissions, // Include permission IDs in API call
      };
      await addUserGroup(submissionData);
      
      // Convert permission IDs to comma-separated strings for display
      const permissionIdsString = formData.permissions.join(',');
      const permissionNamesString = getSelectedPermissionNames().join(',');
      
      // Include data for the parent component to match API response format
      const responseData = {
        ...submissionData,
        permissionIds: permissionIdsString, // Comma-separated string of IDs
        permissionNames: permissionNamesString // Comma-separated string of names
      };
      
      onSubmit(responseData);
      setFormData({
        groupName: '',
        description: '',
        permissions: [],
        module: '',
        memberCount: 0
      });
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };
  

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionToggle = (permissionId: number) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  // Helper function to check if all permissions in a group are selected
  const isGroupSelected = (groupId: number): boolean => {
    const groupPermissions = groupedPermissions[groupId] || [];
    return groupPermissions.length > 0 && groupPermissions.every(permission => 
      formData.permissions.includes(permission.Id)
    );
  };

  // Helper function to check if some permissions in a group are selected
  const isGroupPartiallySelected = (groupId: number): boolean => {
    const groupPermissions = groupedPermissions[groupId] || [];
    return groupPermissions.some(permission => 
      formData.permissions.includes(permission.Id)
    ) && !isGroupSelected(groupId);
  };

  // Helper function to toggle all permissions in a group
  const handleGroupToggle = (groupId: number) => {
    const groupPermissions = groupedPermissions[groupId] || [];
    const groupPermissionIds = groupPermissions.map(p => p.Id);
    
    if (isGroupSelected(groupId)) {
      // Remove all group permissions
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(id => !groupPermissionIds.includes(id))
      }));
    } else {
      // Add all group permissions
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...groupPermissionIds])]
      }));
    }
  };

  // Helper function to get selected permission names for form submission
  const getSelectedPermissionNames = (): string[] => {
    return formData.permissions.map(id => {
      const permission = availablePermissions.find(p => p.Id === id);
      return permission ? permission.ModuleFunction : '';
    }).filter(name => name !== '');
  };

  // Filter permissions based on search term
  const filteredGroupedPermissions = Object.keys(groupedPermissions).reduce((acc, groupId) => {
    const groupPermissions = groupedPermissions[parseInt(groupId)];
    const filteredPermissions = groupPermissions.filter(permission =>
      permission.ModuleFunction.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.Description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredPermissions.length > 0) {
      acc[parseInt(groupId)] = filteredPermissions;
    }
    return acc;
  }, {} as {[key: number]: Permissions[]});

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add New Group
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 "
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            <div className="grid grid-cols-3 gap-4">
              <div className='col-span-1'>
                <div className="mb-4">
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
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Enter group description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>

              <div className='col-span-2'>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Permissions
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allPermissionIds = availablePermissions.map(p => p.Id);
                        setFormData(prev => ({ ...prev, permissions: allPermissionIds }));
                      }}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, permissions: [] }))}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search permissions..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>
                {isLoadingPermissions ? (
                  <div className="flex items-center justify-center p-4 border border-gray-200 rounded-md">
                    <span className="text-gray-500">Loading permissions...</span>
                  </div>
                ) : (
                  <div className="max-h-100 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {permissionGroups.map((group) => {
                      const groupPermissions = filteredGroupedPermissions[group.Id] || [];
                      if (groupPermissions.length === 0) return null;
                      
                      return (
                        <div key={group.Id} className="mb-6">
                          <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200">
                            <input
                              type="checkbox"
                              checked={isGroupSelected(group.Id)}
                              ref={(input) => {
                                if (input) input.indeterminate = isGroupPartiallySelected(group.Id);
                              }}
                              onChange={() => handleGroupToggle(group.Id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <h4 className="font-semibold text-gray-800">
                              {group.Name}
                            </h4>
                            <span className="text-xs text-gray-500">
                              ({groupPermissions.length} permissions)
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 ml-6">
                            {groupPermissions.map((permission) => (
                              <label key={permission.Id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.includes(permission.Id)}
                                  onChange={() => handlePermissionToggle(permission.Id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm text-gray-700 font-medium">
                                    {permission.ModuleFunction}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {permission.Description}
                                  </span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {permissionGroups.length === 0 && !isLoadingPermissions && (
                      <div className="text-center py-4 text-gray-500">
                        No permission groups available
                      </div>
                    )}
                    {Object.keys(filteredGroupedPermissions).length === 0 && searchTerm && (
                      <div className="text-center py-4 text-gray-500">
                        No permissions found matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {formData.permissions.length} permissions
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="orange">
                Add Group
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddGroupDialog;
