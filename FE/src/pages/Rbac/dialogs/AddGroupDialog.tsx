import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Permissions, PermissionGroup } from '../Model.d';
import { fetchPermissions, fetchPermissionGroups, addUserGroup } from '../service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface AddGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const AddGroupDialog: React.FC<AddGroupDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const { showToast } = useToast();
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
      showToast({ message: 'Group added successfully.', type: 'success' });
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

  const handleClose = () => {
    setFormData({ groupName: '', description: '' });
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">Add New Group</DialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData(prev => ({ ...prev, groupName: e.target.value }))}
                placeholder="Enter group name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 resize-none"
              />
            </div>

            <p className="text-xs text-gray-400">Permissions can be assigned after the group is created via the Edit action.</p>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button color="zinc" type="button" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
              <Button color="blue" type="submit" disabled={isSubmitting || !formData.groupName.trim()}>
                {isSubmitting ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddGroupDialog;
