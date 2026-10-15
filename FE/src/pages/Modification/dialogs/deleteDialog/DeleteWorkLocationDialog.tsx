import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { useAtom, useAtomValue } from 'jotai';
import {
  deleteWorkLocationDialogOpenAtom,
  selectedWorkLocationForDeleteAtom,
  deleteWorkLocationIndexAtom,
  deletingWorkLocationAtom,
  canShowDeleteWorkLocationDialogAtom,
  closeDeleteWorkLocationDialogAtom,
  setDeletingWorkLocationStateAtom
} from '../../store/deleteWorkLocationDialogStore';

interface DeleteWorkLocationDialogProps {
  onConfirmDelete: (index: number) => void;
  infraType?: string;
  /** Display name for the infra type (e.g. "Roads"); falls back to infraType. */
  infraTypeLabel?: string;
}

const DeleteWorkLocationDialog: React.FC<DeleteWorkLocationDialogProps> = ({
  onConfirmDelete,
  infraType,
  infraTypeLabel
}) => {
  const { showToast } = useToast();
  
  // Atoms
  const canShowDialog = useAtomValue(canShowDeleteWorkLocationDialogAtom);
  const [isOpen] = useAtom(deleteWorkLocationDialogOpenAtom);
  const selectedWorkLocation = useAtomValue(selectedWorkLocationForDeleteAtom);
  const deleteIndex = useAtomValue(deleteWorkLocationIndexAtom);
  const [isDeleting] = useAtom(deletingWorkLocationAtom);
  const [, closeDialog] = useAtom(closeDeleteWorkLocationDialogAtom);
  const [, setDeletingState] = useAtom(setDeletingWorkLocationStateAtom);

  const handleClose = () => {
    if (!isDeleting) {
      closeDialog();
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedWorkLocation || deleteIndex === null || isDeleting) return;

    try {
      setDeletingState(true);

      // Just remove from local workLocations array
      // The save operation will handle persistence to database
      onConfirmDelete(deleteIndex);
      
      showToast({
        type: 'success',
        message: 'Work location removed successfully'
      });
      
      // Close dialog
      closeDialog();

    } catch (error: any) {
      console.error('Error removing work location:', error);
      
      showToast({
        type: 'error',
        message: 'Failed to remove work location. Please try again.'
      });
    } finally {
      setDeletingState(false);
    }
  };

  if (!canShowDialog || !selectedWorkLocation || deleteIndex === null) {
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
                Delete Work Location
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
                Are you sure you want to remove this work location? This will remove it from the current form. Changes will be saved when you save the form.
              </p>
              
              {/* Work Location Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Work Location Details:</h4>
                <div className="space-y-2 text-sm">
                  {selectedWorkLocation.InfraId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Infrastructure ID:</span>
                      <span className="font-medium">{selectedWorkLocation.InfraId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Infrastructure Type:</span>
                    <span className="font-medium">{infraTypeLabel || infraType || 'Unknown'}</span>
                  </div>
                  {selectedWorkLocation.TargetUnit && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target Unit:</span>
                      <span className="font-medium">{selectedWorkLocation.TargetUnit}</span>
                    </div>
                  )}
                  {selectedWorkLocation.PhysicalTarget !== null && selectedWorkLocation.PhysicalTarget !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Physical Target:</span>
                      <span className="font-medium text-blue-600">{selectedWorkLocation.PhysicalTarget} {selectedWorkLocation.TargetUnit}</span>
                    </div>
                  )}
                  {/* Infrastructure-specific details */}
                  {(infraType?.toLowerCase() === 'road' || infraType?.toLowerCase() === 'roads') && (
                    <>
                      {selectedWorkLocation.StartStationLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Station:</span>
                          <span className="font-medium">{selectedWorkLocation.StartStationLimit}</span>
                        </div>
                      )}
                      {selectedWorkLocation.EndStationLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Station:</span>
                          <span className="font-medium">{selectedWorkLocation.EndStationLimit}</span>
                        </div>
                      )}
                      {(selectedWorkLocation.StartChainage || selectedWorkLocation.EndChainage) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chainage:</span>
                          <span className="font-medium">{selectedWorkLocation.StartChainage}m - {selectedWorkLocation.EndChainage}m</span>
                        </div>
                      )}
                    </>
                  )}
                  {/* Coordinates for other infrastructure types */}
                  {!(infraType?.toLowerCase() === 'road' || infraType?.toLowerCase() === 'roads' || infraType?.toLowerCase() === 'bridge' || infraType?.toLowerCase() === 'bridges') && (
                    <>
                      {(selectedWorkLocation.StartX || selectedWorkLocation.StartY) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Coordinates:</span>
                          <span className="font-medium">{selectedWorkLocation.StartX}, {selectedWorkLocation.StartY}</span>
                        </div>
                      )}
                      {(selectedWorkLocation.EndX || selectedWorkLocation.EndY) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Coordinates:</span>
                          <span className="font-medium">{selectedWorkLocation.EndX}, {selectedWorkLocation.EndY}</span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedWorkLocation.DetailedScope && (
                    <div className="pt-2 border-t">
                      <span className="text-gray-600">Detailed Scope:</span>
                      <p className="mt-1 text-gray-900 text-xs">{selectedWorkLocation.DetailedScope}</p>
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
                'Remove Location'
              )}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteWorkLocationDialog;
