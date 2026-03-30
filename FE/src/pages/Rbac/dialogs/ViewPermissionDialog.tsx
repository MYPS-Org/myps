import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Permissions } from '../Model.d';

interface ViewPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // onSubmit: (permissionData: any) => void;
  permission: Permissions;
}

const ViewPermissionDialog: React.FC<ViewPermissionDialogProps> = ({ isOpen, onClose, permission }) => {
  const [formData] = useState({
    Module: permission.Module || '',
    ModuleFunction: permission.ModuleFunction || '',
    ModuleFunctionDescription: permission.ModuleFunctionDescription || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              View Permission
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
                Module
              </label>
              <input
                type="text"
                value={formData.Module}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Module Function
              </label>
              <input
                type="text"
                value={formData.ModuleFunction}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.ModuleFunctionDescription}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              {/* <Button type="submit" color="blue">
                Add Permission
              </Button> */}
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ViewPermissionDialog;
