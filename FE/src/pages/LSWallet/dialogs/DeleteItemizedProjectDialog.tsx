// =============================================================================
// DeleteItemizedProjectDialog.tsx — WF-7: Delete Itemized Project (3-tier)
//
// Three-tier deletion pattern:
//   - 'blocked' (Published): read-only explanation, Close only
//   - 'soft' (HasStageData, unpublished): warning, Confirm calls service
//   - 'hard' (brand new, no stage data): warning, Confirm calls service
//
// NOTE: tier is a REQUIRED prop (not optional). This is intentional: the caller
// already knows the tier via getItemizedProjectActions()'s disabled-state logic
// before this dialog is even openable. Making it required eliminates the need
// for defensive checks inside the dialog.
//
// On soft/hard delete success: explicitly mention that the wallet's available
// balance has been updated (key side effect the user must know happened).
// =============================================================================

import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import * as Service from '../Service';
import type { ItemizedProject } from '../Model.d';

interface DeleteItemizedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: ItemizedProject;
  tier: 'hard' | 'soft' | 'blocked'; // REQUIRED prop (not optional)
}

const DeleteItemizedProjectDialog: React.FC<DeleteItemizedProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
  tier,
}) => {
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await Service.deleteItemizedProject(project.ProjectId);
      onSuccess();

      // Tier-appropriate success toast message
      if (tier === 'soft') {
        showToast({
          type: 'success',
          message: `Project ${project.ProjectId} marked as deleted. Its wallet-funded draw has returned to the wallet's available balance.`,
        });
      } else if (tier === 'hard') {
        showToast({
          type: 'success',
          message: `Project ${project.ProjectId} permanently deleted. Its wallet-funded draw has returned to the wallet's available balance.`,
        });
      }

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

  // Render tier-specific content
  const renderTierContent = () => {
    switch (tier) {
      case 'blocked':
        return (
          <>
            <div className="flex gap-3 mb-4">
              <LockClosedIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Published Project — Cannot Delete
                </p>
                <p className="text-sm text-gray-600">
                  This project is published and cannot be deleted directly. To cancel or modify it,
                  please submit a revision request.
                </p>
              </div>
            </div>
          </>
        );

      case 'soft':
        return (
          <>
            <div className="flex gap-3 mb-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Soft Delete — Excludes from Active Views
                </p>
                <p className="text-sm text-gray-600">
                  This project will be marked as deleted and excluded from all active views. The
                  wallet-funded draw amount will immediately return to the wallet's available balance.
                  This action can be reversed if needed.
                </p>
              </div>
            </div>
          </>
        );

      case 'hard':
        return (
          <>
            <div className="flex gap-3 mb-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Permanent Deletion — No Recovery
                </p>
                <p className="text-sm text-gray-600">
                  This action is permanent and cannot be undone. The project will be completely
                  removed from the system, and the wallet-funded draw amount will immediately return
                  to the wallet's available balance.
                </p>
              </div>
            </div>
          </>
        );

      default:
        return null;
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

            {renderTierContent()}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            {tier === 'blocked' ? (
              // Read-only mode for blocked projects
              <Button type="button" onClick={onClose} color="zinc">
                Close
              </Button>
            ) : (
              // Confirmation mode for soft/hard deletes
              <>
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
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteItemizedProjectDialog;
