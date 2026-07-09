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
import { ExclamationTriangleIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
              <LockClosedIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Published Project — Cannot Delete
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Soft Delete — Excludes from Active Views
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Permanent Deletion — No Recovery
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete Project
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p className="font-medium text-gray-900 dark:text-white mb-1">Project ID:</p>
              <p>{project.ProjectId}</p>
            </div>

            {renderTierContent()}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
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
