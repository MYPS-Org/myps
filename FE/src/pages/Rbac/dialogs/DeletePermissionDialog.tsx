import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Permissions } from '../Model.d';

interface DeletePermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (permissionData: any) => void;
  permission: Permissions;
}

const DeletePermissionDialog: React.FC<DeletePermissionDialogProps> = ({ isOpen, onClose, onSubmit, permission }) => {
  const [formData, setFormData] = useState({
    moduleFunction: permission.ModuleFunction || '',
    createdBy: permission.CreatedBy || '',
    createdDate: permission.CreatedDate || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      moduleFunction: '',
      createdBy: '',
      createdDate: ''
    });
    onClose();
  };

  // const handleChange = (field: string, value: string) => {
  //   setFormData(prev => ({ ...prev, [field]: value }));
  // };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Update Permission
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
                Are you sure you want to delete the permission for {formData.moduleFunction}?
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="red">
                Delete Permission
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeletePermissionDialog;
