import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { useAtom, useAtomValue } from 'jotai';
import {
  deleteDialogOpenAtom,
  selectedComponentForDeleteAtom,
  deleteIndexAtom,
  deletingComponentAtom,
  canShowDeleteDialogAtom,
  closeDeleteDialogAtom,
  setDeletingStateAtom
} from '../../store/deleteDialogStore';

interface DeleteComponentDialogProps {
  onConfirmDelete: (index: number) => void;
  projectId?: string;
}

const DeleteComponentDialog: React.FC<DeleteComponentDialogProps> = ({
  onConfirmDelete,
}) => {
  // Atoms
  const canShowDialog = useAtomValue(canShowDeleteDialogAtom);
  const [isOpen] = useAtom(deleteDialogOpenAtom);
  const selectedComponent = useAtomValue(selectedComponentForDeleteAtom);
  const deleteIndex = useAtomValue(deleteIndexAtom);
  const [isDeleting] = useAtom(deletingComponentAtom);
  const [, closeDialog] = useAtom(closeDeleteDialogAtom);
  const [, setDeletingState] = useAtom(setDeletingStateAtom);

  const { showToast } = useToast();

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };

  const handleClose = () => {
    if (!isDeleting) {
      closeDialog();
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedComponent || deleteIndex === null || isDeleting) return;

    try {
      setDeletingState(true);

      // Just remove from local componentCosts array
      // The save operation will handle persistence to database
      onConfirmDelete(deleteIndex);
      
      showToast({
        type: 'success',
        message: 'Component cost removed successfully'
      });
      
      // Close dialog
      closeDialog();

    } catch (error: any) {
      console.error('Error removing component cost:', error);
      
      showToast({
        type: 'error',
        message: 'Failed to remove component cost. Please try again.'
      });
    } finally {
      setDeletingState(false);
    }
  };

  if (!canShowDialog || !selectedComponent || deleteIndex === null) {
    return null;
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <DialogTitle className="ml-3 text-lg font-semibold leading-6 text-gray-900">
                Delete Component Cost
              </DialogTitle>
            </div>
            
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 disabled:cursor-not-allowed"
              onClick={handleClose}
              disabled={isDeleting}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="mt-3">
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to remove this component cost? This will remove it from the current form. Changes will be saved when you save the form.
              </p>
              
              {/* Component Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Component Details:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Component ID:</span>
                    <span className="font-medium">{selectedComponent.ComponentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{selectedComponent.ComponentType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Cost:</span>
                    <span className="font-medium text-red-600">₱{formatCurrency(selectedComponent.Total || 0)}</span>
                  </div>
                  {selectedComponent.Description && (
                    <div className="pt-2 border-t">
                      <span className="text-gray-600">Description:</span>
                      <p className="mt-1 text-gray-900">{selectedComponent.Description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button
              type="button"
              color="white"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              color="red"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </div>
              ) : (
                'Remove Component'
              )}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteComponentDialog;