import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ProgramList } from '../Model';
import { deleteProgram } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface DeleteProgramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  program: ProgramList;
  onDeleteSuccess?: () => void;
}

const DeleteProgramDialog: React.FC<DeleteProgramDialogProps> = ({ isOpen, onClose, program, onDeleteSuccess }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmText.toLowerCase() !== 'delete') {
      return;
    }

    if (!program?.ProgramId) {
      console.error('Program ID is undefined');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProgram(program);
      
      // Call refresh callback before closing
      if (onDeleteSuccess) {
        await onDeleteSuccess();
        showToast({
          type: 'success',
          message: 'Program deleted successfully.',
        })
      }
      
      // Close dialog after successful deletion and refresh
      handleClose();
    } catch (error) {
      console.error('Error deleting program:', error);
      // The interceptor already toasted any API error that carried a Message (e.g. why the
      // delete was refused); toast only when it stayed silent (network error, bare 500).
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to delete the program. Please try again.' });
      }
      // Keep dialog open on error so user can retry
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
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-red-600 flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Delete Program
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
                    Deleting this Program will permanently remove it from the system and may affect users assigned to this Program.
                  </p>
                </div>
              </div>
            </div>

            {/* Program Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Program to be deleted:</h4>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Name:</span>
                  <span className="text-sm font-medium text-gray-900">{program.Name}</span>
                </div>
                
              </div>
            </div>

            {/* Program Impact Warning: a program delete permanently removes every project in it. */}
            {(program.NumberOfProjects ?? 0) > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">
                      Impact on Projects
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This program has {program.NumberOfProjects} project(s). They will be permanently deleted with the program.
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
                {isDeleting ? 'Deleting...' : 'Delete Program'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteProgramDialog;
