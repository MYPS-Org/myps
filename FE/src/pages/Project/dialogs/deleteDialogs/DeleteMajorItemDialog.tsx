import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';

interface DeleteMajorItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (index: number) => void;
  majorItem: {
    ComponentId: string;
    WorkTypeFK: number;
    YearOfWork: string | number;
    InfraTypeFK: string;
    TargetUnitId: number;
    TargetUnit: string;
    MajorItemLocations?: any[];
  } | null;
  deleteIndex: number | null;
}

const DeleteMajorItemDialog: React.FC<DeleteMajorItemDialogProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  majorItem,
  deleteIndex
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const handleConfirmDelete = async () => {
    if (!majorItem || deleteIndex === null || isDeleting) return;

    try {
      setIsDeleting(true);

      // Call the parent callback to delete
      onConfirmDelete(deleteIndex);

      showToast({
        type: 'success',
        message: 'Major item of work removed successfully',
      });

      // Close dialog
      onClose();
    } catch (error: any) {
      console.error('Error removing major item of work:', error);

      showToast({
        type: 'error',
        message: 'Failed to remove major item of work. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !majorItem || deleteIndex === null) {
    return null;
  }

  const workTypeDesc = majorItem.WorkTypeFK.toString();
  const componentDesc = majorItem.ComponentId;
  const workLocationCount = majorItem.MajorItemLocations?.length || 0;

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
                Delete Major Item of Work
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
                Are you sure you want to remove this major item of work? This will remove it from the current form. Changes will be saved when you save the form.
              </p>

              {/* Major Item Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Major Item Details:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Component:</span>
                    <span className="font-medium">{componentDesc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Year of Work:</span>
                    <span className="font-medium">{majorItem.YearOfWork}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type of Work:</span>
                    <span className="font-medium">{workTypeDesc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Infrastructure Type:</span>
                    <span className="font-medium">{majorItem.InfraTypeFK}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Target Unit:</span>
                    <span className="font-medium">{majorItem.TargetUnit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Work Locations:</span>
                    <span className="font-medium text-blue-600">{workLocationCount} location(s)</span>
                  </div>
                </div>
              </div>

              {/* Warning if has work locations */}
              {workLocationCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-2">
                      <h5 className="text-sm font-medium text-yellow-800">Work Locations</h5>
                      <p className="text-sm text-yellow-600 mt-1">
                        This major item has {workLocationCount} work location(s). Deleting this item will also remove all associated work locations.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button type="button" color="white" onClick={handleClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" color="red" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </div>
              ) : (
                'Remove Major Item'
              )}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteMajorItemDialog;