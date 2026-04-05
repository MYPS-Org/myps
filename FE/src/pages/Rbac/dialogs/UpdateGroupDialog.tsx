import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { vUserGroups, Permissions, AddUserGroups } from '../Model.d';
import { fetchPermissions as fetchPermissionsAPI, editUserGroup } from '../service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface UpdateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupData: any) => void;
  group: vUserGroups;
};

const UpdateGroupDialog: React.FC<UpdateGroupDialogProps> = ({ isOpen, onClose, onSubmit, group }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    id: group.Id,
    groupName: group.GroupName || '',
    description: group.Description || '',
    permissions: [] as number[], // Changed to store permission IDs instead of names
    numberOfUsers: group.NumberOfUsers || 0
  });

  const [availablePermissions, setAvailablePermissions] = useState<Permissions[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [groupedPermissions, setGroupedPermissions] = useState<{[key: string]: Permissions[]}>({});
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    // Fetch available permissions when the dialog opens
    const fetchAvailablePermissions = async () => {
      try {
        setIsLoadingPermissions(true);
        const response = await fetchPermissionsAPI({
          page: 1,
          limit: 1000, // Get all permissions
          Filters: {}
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

  // Group permissions by Module when data changes
  useEffect(() => {
    if (availablePermissions.length > 0) {
      const grouped = availablePermissions.reduce((acc, permission) => {
        const module = permission.Module || 'Other';
        if (!acc[module]) {
          acc[module] = [];
        }
        acc[module].push(permission);
        return acc;
      }, {} as {[key: string]: Permissions[]});
      setGroupedPermissions(grouped);
    }
  }, [availablePermissions]);

  // Update form data when group prop changes — use PermissionViewIds directly
  useEffect(() => {
    if (group) {
      setFormData({
        id: group.Id,
        groupName: group.GroupName || '',
        description: group.Description || '',
        permissions: group.PermissionViewIds || [],
        numberOfUsers: group.NumberOfUsers || 0
      });
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare API payload according to AddUserGroups interface
      const apiPayload: AddUserGroups = {
        Id: formData.id, // Include the ID for update
        GroupName: formData.groupName,
        Description: formData.description,
        PermissionIds: formData.permissions
      };
      
      // Call the API to update the group
      await editUserGroup(apiPayload);
      
      // Convert permission IDs to comma-separated strings for display
      const permissionIdsString = formData.permissions.join(',');
      const permissionNames = formData.permissions.map(id => {
        const permission = availablePermissions.find(p => p.Id === id);
        return permission ? permission.ModuleFunction : '';
      }).filter(name => name !== '').join(',');
      
      // Prepare data for parent component to match API response format
      const submissionData = {
        id: formData.id,
        groupName: formData.groupName,
        description: formData.description,
        permissionIds: permissionIdsString, // Return as comma-separated string of IDs
        permissionNames: permissionNames, // Return as comma-separated string of names
        numberOfUsers: formData.numberOfUsers
      };
      
      onSubmit(submissionData);
      showToast({ message: 'Group updated successfully.', type: 'success' });
      onClose();
    } catch (error) {
      console.error('Error updating group:', error);
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

  // Helper function to check if all permissions in a module are selected
  const isGroupSelected = (module: string): boolean => {
    const groupPermissions = groupedPermissions[module] || [];
    return groupPermissions.length > 0 && groupPermissions.every(permission => 
      formData.permissions.includes(permission.Id)
    );
  };

  // Helper function to check if some permissions in a module are selected
  const isGroupPartiallySelected = (module: string): boolean => {
    const groupPermissions = groupedPermissions[module] || [];
    return groupPermissions.some(permission => 
      formData.permissions.includes(permission.Id)
    ) && !isGroupSelected(module);
  };

  // Helper function to toggle all permissions in a module
  const handleGroupToggle = (module: string) => {
    const groupPermissions = groupedPermissions[module] || [];
    const groupPermissionIds = groupPermissions.map(p => p.Id);
    
    if (isGroupSelected(module)) {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(id => !groupPermissionIds.includes(id))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...groupPermissionIds])]
      }));
    }
  };

  // Filter permissions based on search term
  const filteredGroupedPermissions = Object.keys(groupedPermissions).reduce((acc, module) => {
    const groupPermissions = groupedPermissions[module];
    const filteredPermissions = groupPermissions.filter(permission =>
      permission.ModuleFunction.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (permission.ModuleFunctionDescription ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredPermissions.length > 0) {
      acc[module] = filteredPermissions;
    }
    return acc;
  }, {} as {[key: string]: Permissions[]});

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
                      disabled
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
                
                {/* Search box */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {isLoadingPermissions ? (
                  <div className="flex items-center justify-center p-4 border border-gray-200 rounded-md">
                    <span className="text-gray-500">Loading permissions...</span>
                  </div>
                ) : (
                  <div className="max-h-100 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {Object.keys(filteredGroupedPermissions).map((module) => {
                      const groupPermissions = filteredGroupedPermissions[module] || [];
                      if (groupPermissions.length === 0) return null;
                      
                      return (
                        <div key={module} className="mb-6">
                          <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200">
                            <input
                              type="checkbox"
                              checked={isGroupSelected(module)}
                              ref={(input) => {
                                if (input) input.indeterminate = isGroupPartiallySelected(module);
                              }}
                              onChange={() => handleGroupToggle(module)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <h4 className="font-semibold text-gray-800">
                              {module}
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
                                    {permission.ModuleFunctionDescription}
                                  </span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(groupedPermissions).length === 0 && !isLoadingPermissions && (
                      <div className="text-center py-4 text-gray-500">
                        No permissions available
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
