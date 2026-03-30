import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Badge } from '../../../components/tailwindui/badge';
import type { vUserGroups } from '../Model.d';
import { deleteUserGroup } from '../service';

interface DeleteGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupId: number) => void;
  group: vUserGroups;
}

const DeleteGroupDialog: React.FC<DeleteGroupDialogProps> = ({ isOpen, onClose, onSubmit, group }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmText.toLowerCase() !== 'delete') {
      return;
    }

    setIsDeleting(true);
    setError('');
    
    try {
      // Call the actual delete API
      await deleteUserGroup(group.Id);
      
      // Call the parent component's onSubmit handler to update the UI
      onSubmit(group.Id);
      handleClose();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      
      // Extract error message from the API response
      const errorMessage = error?.response?.data?.Message || error?.Message || 'Failed to delete group. Please try again.';
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setIsDeleting(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-red-600 flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Delete Group
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Warning Message */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Warning: This action cannot be undone
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Deleting this group will permanently remove it from the system and may affect users assigned to this group.
                  </p>
                </div>
              </div>
            </div>

            {/* Group Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Group to be deleted:</h4>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Name:</span>
                  <span className="text-sm font-medium text-gray-900">{group.GroupName}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Members:</span>
                  <Badge color="blue">{group.NumberOfUsers || 0} members</Badge>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Permissions:</span>
                  <Badge color="green">
                    {group.PermissionNames ? group.PermissionNames.split(',').filter((p: string) => p.trim()).length : 0} permissions
                  </Badge>
                </div>
              </div>
            </div>

            {/* Member Impact Warning */}
            {(group.NumberOfUsers || 0) > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">
                      Impact on Members
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This group has {group.NumberOfUsers || 0} member(s). Deleting this group may affect their access permissions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 placeholder-gray-500"
                autoComplete="off"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
                {error}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button color="zinc" onClick={handleClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                color="red" 
                disabled={confirmText.toLowerCase() !== 'delete' || isDeleting}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Group'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteGroupDialog;
