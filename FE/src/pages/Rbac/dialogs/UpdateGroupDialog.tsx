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
}

const UpdateGroupDialog: React.FC<UpdateGroupDialogProps> = ({ isOpen, onClose, onSubmit, group }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    groupName: group.GroupName || '',
    description: group.Description || '',
    actionIds: [] as number[],
    viewIds: [] as number[],
  });
  const [dropdowns, setDropdowns] = useState<UserGroupDropdowns>({
    PermissionControllers: [],
    PermissionActions: [],
    PermissionViews: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchAction, setSearchAction] = useState('');
  const [searchView, setSearchView] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
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

  const toggleViewId = (id: number) => {
    setFormData(prev => ({
      ...prev,
      viewIds: prev.viewIds.includes(id)
        ? prev.viewIds.filter(x => x !== id)
        : [...prev.viewIds, id],
    }));
  };

  const toggleAllActionsInController = (controllerName: string) => {
    const ids = dropdowns.PermissionActions
      .filter(a => a.ControllerName === controllerName)
      .map(a => a.Id);
    const allSelected = ids.every(id => formData.actionIds.includes(id));
    setFormData(prev => ({
      ...prev,
      actionIds: allSelected
        ? prev.actionIds.filter(id => !ids.includes(id))
        : [...new Set([...prev.actionIds, ...ids])],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.groupName.trim()) {
      setError('Group name is required.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const payload: UpdateUserGroupPayload = {
        Id: group.Id,
        GroupName: formData.groupName.trim(),
        Description: formData.description.trim() || undefined,
        PermissionActionIds: formData.actionIds,
        PermissionViewIds: formData.viewIds,
      };
      await editUserGroup(payload);
      onSubmit({
        id: group.Id,
        groupName: formData.groupName.trim(),
        description: formData.description.trim(),
        permissionIds: formData.viewIds.join(','),
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.Message || err?.Message || 'Failed to update group. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group PermissionActions by ControllerName
  const groupedActions = dropdowns.PermissionActions.reduce((acc, action) => {
    if (!acc[action.ControllerName]) acc[action.ControllerName] = [];
    acc[action.ControllerName].push(action);
    return acc;
  }, {} as Record<string, PermissionActions[]>);

  const filteredActions = Object.entries(groupedActions).reduce((acc, [controller, actions]) => {
    const filtered = actions.filter(a =>
      a.ActionName.toLowerCase().includes(searchAction.toLowerCase()) ||
      controller.toLowerCase().includes(searchAction.toLowerCase())
    );
    if (filtered.length > 0) acc[controller] = filtered;
    return acc;
  }, {} as Record<string, PermissionActions[]>);

  const filteredViews = dropdowns.PermissionViews.filter(v =>
    v.RoutePath.toLowerCase().includes(searchView.toLowerCase()) ||
    (v.Description || '').toLowerCase().includes(searchView.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <DialogTitle className="text-lg font-semibold text-gray-900">Update Group</DialogTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Group Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={e => setFormData(prev => ({ ...prev, groupName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  autoComplete="off"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading permissions...</div>
            ) : (
              <>
                {/* API Permissions (PermissionActions) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">
                      API Permissions
                      <span className="ml-2 text-xs font-normal text-gray-500">({formData.actionIds.length} selected)</span>
                    </h3>
                    <input
                      type="text"
                      placeholder="Search actions..."
                      value={searchAction}
                      onChange={e => setSearchAction(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 w-48"
                    />
                  </div>
                  <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {Object.entries(filteredActions).map(([controller, actions]) => {
                      const allSelected = actions.every(a => formData.actionIds.includes(a.Id));
                      const someSelected = actions.some(a => formData.actionIds.includes(a.Id));
                      return (
                        <div key={controller}>
                          <div
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleAllActionsInController(controller)}
                          >
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => toggleAllActionsInController(controller)}
                              className="rounded border-gray-300 text-blue-600"
                            />
                            <span className="text-xs font-semibold text-gray-700">{controller}</span>
                            <span className="ml-auto text-xs text-gray-400">
                              {actions.filter(a => formData.actionIds.includes(a.Id)).length}/{actions.length}
                            </span>
                          </div>
                          {actions.map(action => (
                            <div
                              key={action.Id}
                              className="flex items-center gap-2 px-6 py-1.5 hover:bg-blue-50 cursor-pointer"
                              onClick={() => toggleActionId(action.Id)}
                            >
                              <input
                                type="checkbox"
                                checked={formData.actionIds.includes(action.Id)}
                                onChange={() => toggleActionId(action.Id)}
                                className="rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-xs text-gray-700">{action.ActionName}</span>
                              {action.Description && (
                                <span className="text-xs text-gray-400 truncate">� {action.Description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {Object.keys(filteredActions).length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-gray-400">No actions found</div>
                    )}
                  </div>
                </div>

                {/* Route Permissions (PermissionViews) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Route Permissions
                      <span className="ml-2 text-xs font-normal text-gray-500">({formData.viewIds.length} selected)</span>
                    </h3>
                    <input
                      type="text"
                      placeholder="Search routes..."
                      value={searchView}
                      onChange={e => setSearchView(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 w-48"
                    />
                  </div>
                  <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                    {filteredViews.map(view => (
                      <div
                        key={view.Id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                        onClick={() => toggleViewId(view.Id)}
                      >
                        <input
                          type="checkbox"
                          checked={formData.viewIds.includes(view.Id)}
                          onChange={() => toggleViewId(view.Id)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-xs text-gray-700">{view.RoutePath}</span>
                        {view.Description && (
                          <span className="text-xs text-gray-400 truncate">� {view.Description}</span>
                        )}
                      </div>
                    ))}
                    {filteredViews.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-gray-400">No routes found</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button color="zinc" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button color="blue" type="submit" disabled={isSubmitting || !formData.groupName.trim()}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default UpdateGroupDialog;
