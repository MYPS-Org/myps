import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ProjectList } from '../Model';
import { deleteProject } from '../Service';

interface DeleteProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectId: string) => void;
  project: ProjectList;
}

const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({ isOpen, onClose, onSubmit, project }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmText.toLowerCase() !== 'delete') {
      return;
    }

    if (!project.ProjectId) {
      console.error('Project ID is undefined');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(project.ProjectId);
      onSubmit(project.ProjectId); // Call the onSubmit prop with the project ID
      handleClose();
    } catch (error) {
      console.error('Error deleting project group:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setIsDeleting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Delete Program
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Warning Message */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Warning: This action cannot be undone
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Deleting this group will permanently remove it from the system and may affect users assigned to this group.
                  </p>
                </div>
              </div>
            </div>

            {/* Group Information */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Group to be deleted:</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Project Id:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{project?.ProjectId}</span>
                </div>
                
              </div>
            </div>

            {/* Program Impact Warning - Uncomment when ProjectCount is available */}
            {/* {program.ProjectCount && program.ProjectCount > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Impact on Projects
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This program has {program.ProjectCount} project(s). Deleting this program may affect the associated projects.
                    </p>
                  </div>
                </div>
              </div>
            )} */}

            {/* Confirmation Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <span className="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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

export default DeleteProjectDialog;
