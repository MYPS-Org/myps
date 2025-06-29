import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { User } from '../Model.d';

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
  user: User;
}

const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({ isOpen, onClose, onSubmit, user }) => {
  const [formData, setFormData] = useState({
    employeeId: user.EmployeeId || '',
    name: user.Name || '',
    userId: user.UserId || '',
    email: user.Email || '',
    userGroup: user.UserGroup || '',
    regCode: user.RegCode || '',
    plantillaOffice: user.PlantillaOffice || '',
    isActive: user.IsActive ? 'active' : 'inactive',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
        employeeId: '',
        name: '',
        userId: '',
        email: '',
        userGroup: '',
        regCode: '',
        plantillaOffice: '',
        isActive: 'active',
    });
    onClose();
  };

//   const handleChange = (field: string, value: string) => {
//     setFormData(prev => ({ ...prev, [field]: value }));
//   };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete User
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Are you sure you want to delete this user? {formData.name}
                    </label>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="red">
                Delete User
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteUserDialog;
