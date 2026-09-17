// =============================================================================
// DeleteItemizedProjectDialog.tsx — delete one itemized project.
//
// Addressed by ProjectPK, not by the readable Project ID: ItemizedProjectIdDTO
// takes tProjects.ProjectPK.
//
// The server decides hard, soft or refused, and its message says which. A
// published project is refused and the user is directed to Programs — never to
// a revision workflow, which no longer exists here.
// =============================================================================

import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import * as Service from '../Service';
import type { LumpSumChild } from '../Model.d';

interface DeleteItemizedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: LumpSumChild;
  /** The parent, so the delete can re-read what its cost returned to. */
  parent: { lumpSumId: number; projectId: string };
}

const DeleteItemizedProjectDialog: React.FC<DeleteItemizedProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
  parent,
}) => {
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await Service.deleteItemizedProject(project.ProjectPK, parent);
      showToast({ type: 'success', message: result.Data.Message || 'Itemized project deleted.' });
      onSuccess();
      onClose();
    } catch {
      // httpClient's interceptor already raised the toast, including the
      // published-project refusal.
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
            Delete Itemized Project
          </DialogTitle>

          <div className="space-y-4 mb-6">
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-1">{project.Description}</p>
              <p className="font-mono text-xs">{project.ProjectId}</p>
            </div>

            <div className="flex gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  This action cannot be undone
                </p>
                <p className="text-sm text-gray-600">
                  {formatCurrency(project.DrawnFromParent)} returns to the Lump Sum Project&apos;s
                  remaining allocation.
                </p>
                {project.IsPublished && (
                  <p className="text-sm text-red-700 mt-2">
                    This project is published. Deleting it from here will be refused — cancel it
                    through Programs instead.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button type="button" onClick={onClose} color="zinc" disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmDelete} color="red" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteItemizedProjectDialog;
