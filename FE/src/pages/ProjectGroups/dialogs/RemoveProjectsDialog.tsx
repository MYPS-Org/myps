import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { removeProjectsFromGroup } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';
import IdChipGroup from '../components/IdChipGroup';

interface RemoveProjectsDialogProps {
  /** The Project IDs to remove. The dialog is open when this is non-null. */
  projectIds: string[] | null;
  groupId: string;
  groupName: string;
  /** `changed` is true after any successful remove call, so the table is refreshed. */
  onClose: (changed: boolean) => void;
}

/** Confirms unlinking projects from the group. The projects themselves are not deleted. */
const RemoveProjectsDialog: React.FC<RemoveProjectsDialogProps> = ({ projectIds, groupId, groupName, onClose }) => {
  const { showToast } = useToast();
  const [isRemoving, setIsRemoving] = useState(false);
  const ids = projectIds ?? [];

  const handleClose = () => {
    if (isRemoving) return;
    onClose(false);
  };

  const handleRemove = async () => {
    if (ids.length === 0) return;

    setIsRemoving(true);
    try {
      const response = await removeProjectsFromGroup({ GroupId: groupId, ProjectIds: ids });
      const { Message, RemovedProjectIds, NotInGroupProjectIds } = response.Data;
      showToast({ type: RemovedProjectIds.length > 0 ? 'success' : 'info', message: Message });
      if (NotInGroupProjectIds.length > 0) {
        const shown = NotInGroupProjectIds.slice(0, 10).join(', ');
        const more = NotInGroupProjectIds.length > 10 ? ` +${NotInGroupProjectIds.length - 10} more` : '';
        showToast({ type: 'info', message: `Not in this group: ${shown}${more}` });
      }
      // Refresh even when nothing was removed: NotInGroupProjectIds means the rows on screen are stale.
      onClose(true);
    } catch (error) {
      console.error('Error removing projects from group:', error);
      // The interceptor already toasted any API error that carried a Message.
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to remove projects. Please try again.' });
      }
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={projectIds !== null} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Remove projects from group
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close dialog"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Remove {ids.length} project(s) from <span className="font-semibold">{groupName}</span>? The projects are not
              deleted and can be added back.
            </p>

            <IdChipGroup title="Projects" ids={ids} chipClass="bg-red-100 text-red-800" />

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button color="zinc" onClick={handleClose} disabled={isRemoving}>
                Cancel
              </Button>
              <Button color="red" onClick={handleRemove} disabled={isRemoving || ids.length === 0}>
                {isRemoving ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default RemoveProjectsDialog;
