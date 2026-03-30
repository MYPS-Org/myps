import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Badge } from '../../../components/tailwindui/badge';
import type { vUserGroups } from '../Model.d';

interface ViewGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  group: vUserGroups;
}

const ViewGroupDialog: React.FC<ViewGroupDialogProps> = ({ isOpen, onClose, group }) => {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              View Group Details
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Group Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group ID
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                  {group.Id}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900 font-semibold">
                  {group.GroupName}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                {group.Description}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Count
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                  <Badge color="blue">{group.NumberOfUsers} members</Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Created Date
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                  {/* {new Date(group.CreatedDate).toLocaleDateString()} */}
                </div>
              </div>
            </div>

            {/* Permissions Section */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Permissions ({group.PermissionsName.length})
              </label>
              <div className="bg-gray-50 rounded-md p-4">
                {group.PermissionName.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {group.PermissionName.map((permission, index) => (
                      <Badge key={index} color="green" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No permissions assigned</p>
                )}
              </div>
            </div> */}

            {/* {group.Module && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                  {group.Module}
                </div>
              </div>
            )} */}
          </div>

          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <Button color="zinc" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ViewGroupDialog;
