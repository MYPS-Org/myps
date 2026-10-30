import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { addUserGroup } from '../service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface AddGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const AddGroupDialog: React.FC<AddGroupDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const { showToast } = useToast();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [applyFilter, setApplyFilter] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await addUserGroup({ GroupName: groupName.trim(), Description: description.trim() || undefined, ApplyFilter: applyFilter, PermissionIds: [] });
      showToast({ message: `Group '${groupName.trim()}' created successfully.`, type: 'success' });
      onSubmit({ GroupName: groupName.trim(), Description: description.trim() });
      handleClose();
    } catch (err: any) {
      const msg = err?.response?.data?.Message || err?.Message || 'Failed to create group. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setDescription('');
    setApplyFilter(false);
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
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="applyFilter"
                type="checkbox"
                checked={applyFilter}
                onChange={(e) => setApplyFilter(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="applyFilter" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                Apply Filter
              </label>
            </div>
            {/* 2026-10-30: vUsers.ApplyFilter is on only when EVERY group of the user has it on. */}
            <p className="text-xs text-gray-400 -mt-2">
              A user in several groups is region-filtered only when all their groups have Apply Filter.
            </p>

            <p className="text-xs text-gray-400">
              Permissions can be assigned after the group is created via the Edit action.
            </p>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button color="zinc" type="button" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={isSubmitting || !groupName.trim()}>
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