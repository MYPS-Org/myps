import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface SaveProjectConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  mode: 'add' | 'edit';
  projectName?: string;
}

const SaveProjectConfirmDialog: React.FC<SaveProjectConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode,
  projectName
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error('Error saving/updating project:', error);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-orange-600 flex items-center">
              <CheckCircleIcon className="h-6 w-6 mr-2" />
              {mode === 'add' ? 'Save New Project' : 'Update Project'}
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                {mode === 'add' 
                  ? 'Are you sure you want to save this new project? Once saved, you can continue editing the project details.'
                  : 'Are you sure you want to update this project? All changes will be saved.'}
              </p>
            </div>

            {projectName && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Project:</h4>
                <p className="text-sm text-gray-700">{projectName}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <Button
              color="zinc"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {mode === 'add' ? 'Saving...' : 'Updating...'}
                </div>
              ) : (
                mode === 'add' ? 'Save Project' : 'Update Project'
              )}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default SaveProjectConfirmDialog;
