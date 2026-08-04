// =============================================================================
// DeleteItemizedProjectDialog.tsx — WF-7: Delete Itemized Project
//
// Sends a single delete request; the backend decides whether it ends up a
// hard or soft delete, or rejects it (e.g. project is Published) — mirrors
// Program's DeleteProgramDialog. On rejection, the caught error's message is
// shown as a toast.
// =============================================================================

import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import * as Service from '../Service';
import type { ItemizedProject } from '../Model.d';

interface DeleteItemizedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: ItemizedProject;
}

const DeleteItemizedProjectDialog: React.FC<DeleteItemizedProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
}) => {
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await Service.deleteItemizedProject(project.ProjectId);
      onSuccess();

      showToast({
        type: 'success',
        message: `Project ${project.ProjectId} deleted. Its wallet-funded draw has returned to the wallet's available balance.`,
      });

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      showToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Delete Project
          </DialogTitle>

          <div className="space-y-4 mb-6">
            <div className="text-sm text-gray-600 mb-4">
              <p className="font-medium text-gray-900 mb-1">Project ID:</p>
              <p>{project.ProjectId}</p>
            </div>

            <div className="flex gap-3 mb-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  This action cannot be undone
                </p>
                <p className="text-sm text-gray-600">
                  This will delete the project. The wallet-funded draw amount will immediately
                  return to the wallet's available balance.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button
              type="button"
              onClick={onClose}
              color="zinc"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              color="red"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteItemizedProjectDialog;
