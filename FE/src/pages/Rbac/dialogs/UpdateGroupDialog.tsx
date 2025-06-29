import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ConsolidatedUserGroup } from '../Model.d';

interface UpdateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupData: any) => void;
  group: ConsolidatedUserGroup;
}

const UpdateGroupDialog: React.FC<UpdateGroupDialogProps> = ({ isOpen, onClose, onSubmit, group }) => {
  const [formData, setFormData] = useState({
    id: group.Id,
    groupName: group.GroupName || '',
    description: group.Description || '',
    permissions: group.PermissionName || [],
    module: group.Module || '',
    memberCount: group.MemberCount || 0
  });

  const availablePermissions = [
    'User Management',
    'View Reports',
    'Edit Content',
    'Delete Records',
    'Role Management',
    'System Settings',
    'Audit Logs',
    'Data Export',
    'API Access',
    'Notifications'
  ];

  // Update form data when group prop changes
  useEffect(() => {
    setFormData({
      id: group.Id,
      groupName: group.GroupName || '',
      description: group.Description || '',
      permissions: group.PermissionName || [],
      module: group.Module || '',
      memberCount: group.MemberCount || 0
    });
  }, [group]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Update Group
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => handleChange('groupName', e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Member Count
                </label>
                <input
                  type="number"
                  value={formData.memberCount}
                  onChange={(e) => handleChange('memberCount', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter group description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Module (Optional)
              </label>
              <input
                type="text"
                value={formData.module}
                onChange={(e) => handleChange('module', e.target.value)}
                placeholder="Enter module name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Permissions
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-3 bg-gray-50 dark:bg-gray-700">
                {availablePermissions.map((permission) => (
                  <label key={permission} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(permission)}
                      onChange={() => handlePermissionToggle(permission)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {permission}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Selected: {formData.permissions.length} permission(s)
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button color="zinc" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" color="blue">
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
