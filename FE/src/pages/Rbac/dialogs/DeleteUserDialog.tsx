import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Users } from '../Model.d';
import { deleteUser } from '../service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userId: number) => void;
  user: Users;
}

const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({ isOpen, onClose, onSubmit, user }) => {

  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleSubmit = async(e: React.FormEvent) => {
    e.preventDefault();
    if (isDeleting) return;

    try {
        if (!user.Id) {
            throw new Error('User ID is required for deletion.');
        }
        setIsDeleting(true);
        await deleteUser(user);
        onSubmit(user.Id);
        showToast({ message: 'User deleted successfully.', type: 'success' });
        onClose();
    } catch (error) {
        console.error('Error deleting user:', error);
        return;
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Delete User
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Are you sure you want to delete this user? {user.Name}
                    </label>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="red" disabled={isDeleting}>
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
