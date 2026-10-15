import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';
import type { MajorItemLocations } from '../../Model';

interface DeleteWorkLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (index: number) => void;
  workLocation: MajorItemLocations | null;
  deleteIndex: number | null;
  infraType?: string;
  /** Display name for the infra type (e.g. "Roads"); falls back to infraType. */
  infraTypeLabel?: string;
}

const DeleteWorkLocationDialog: React.FC<DeleteWorkLocationDialogProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  workLocation,
  deleteIndex,
  infraType,
  infraTypeLabel
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const handleConfirmDelete = async () => {
    if (!workLocation || deleteIndex === null || isDeleting) return;

    try {
      setIsDeleting(true);

      // Call parent callback to delete
      onConfirmDelete(deleteIndex);
      
      showToast({
        type: 'success',
        message: 'Work location removed successfully'
      });
      
      // Close dialog
      onClose();

    } catch (error: any) {
      console.error('Error removing work location:', error);
      
      showToast({
        type: 'error',
        message: 'Failed to remove work location. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!workLocation || deleteIndex === null) {
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
                  {workLocation.InfraId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Infrastructure ID:</span>
                      <span className="font-medium">{workLocation.InfraId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Infrastructure Type:</span>
                    <span className="font-medium">{infraTypeLabel || infraType || 'Unknown'}</span>
                  </div>
                  {workLocation.TargetUnit && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target Unit:</span>
                      <span className="font-medium">{workLocation.TargetUnit}</span>
                    </div>
                  )}
                  {workLocation.PhysicalTarget !== null && workLocation.PhysicalTarget !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Physical Target:</span>
                      <span className="font-medium text-blue-600">{workLocation.PhysicalTarget} {workLocation.TargetUnit}</span>
                    </div>
                  )}
                  {/* Infrastructure-specific details */}
                  {(infraType?.toLowerCase() === 'road' || infraType?.toLowerCase() === 'roads') && (
                    <>
                      {workLocation.StartStationLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Station:</span>
                          <span className="font-medium">{workLocation.StartStationLimit}</span>
                        </div>
                      )}
                      {workLocation.EndStationLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Station:</span>
                          <span className="font-medium">{workLocation.EndStationLimit}</span>
                        </div>
                      )}
                      {(workLocation.StartChainage || workLocation.EndChainage) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chainage:</span>
                          <span className="font-medium">{workLocation.StartChainage}m - {workLocation.EndChainage}m</span>
                        </div>
                      )}
                    </>
                  )}
                  {/* Coordinates for other infrastructure types */}
                  {!(infraType?.toLowerCase() === 'road' || infraType?.toLowerCase() === 'roads' || infraType?.toLowerCase() === 'bridge' || infraType?.toLowerCase() === 'bridges') && (
                    <>
                      {(workLocation.StartX || workLocation.StartY) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Coordinates:</span>
                          <span className="font-medium">{workLocation.StartX}, {workLocation.StartY}</span>
                        </div>
                      )}
                      {(workLocation.EndX || workLocation.EndY) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Coordinates:</span>
                          <span className="font-medium">{workLocation.EndX}, {workLocation.EndY}</span>
                        </div>
                      )}
                    </>
                  )}
                  {workLocation.DetailedScope && (
                    <div className="pt-2 border-t">
                      <span className="text-gray-600">Detailed Scope:</span>
                      <p className="mt-1 text-gray-900 text-xs">{workLocation.DetailedScope}</p>
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
