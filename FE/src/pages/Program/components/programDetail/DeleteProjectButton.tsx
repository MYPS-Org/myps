import React, { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../../components/tailwindui/button';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { batchDeleteProjects, previewBatchDelete } from '../../Service';
import type { BatchDeletePreview } from '../../Model';
import ConfirmDialogBatch from '../../dialogs/ConfirmDialogBatch';

interface DeleteProjectButtonProps {
  /** vProgramLatest.ProgramId, as Batch Delete takes it (not the ProgramPK). */
  programId: string;
  programName: string;
  projectId: string;
  /** Called after a successful delete; the parent refreshes the table and the program header. */
  onDeleted: () => Promise<void>;
  onLoadingChange: (loading: boolean) => void;
}

/**
 * Deletes one project from its row (S01-TC004-P002). It is Batch Delete for a single Project ID:
 * the same server preview (permanent, current stage only, or refused and why) and the same
 * type-DELETE confirmation, so the server rules stay in one place.
 */
const DeleteProjectButton: React.FC<DeleteProjectButtonProps> = ({
  programId,
  programName,
  projectId,
  onDeleted,
  onLoadingChange,
}) => {
  const { showToast } = useToast();
  const [deletePreview, setDeletePreview] = useState<BatchDeletePreview | undefined>(undefined);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleClick = async () => {
    setIsPreviewing(true);
    try {
      const response = await previewBatchDelete({ ProgramId: programId, ProjectIds: projectId });
      setDeletePreview(response.Data);
    } catch (error) {
      console.error('Error checking project for delete:', error);
      // The interceptor already toasted any API error that carried a Message.
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Could not check this project. Please try again.' });
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    let deleted = false;
    try {
      onLoadingChange(true);
      const response = await batchDeleteProjects({ ProgramId: programId, ProjectIds: projectId });
      showToast({ type: 'success', message: response.Data.Message });
      deleted = true;
    } catch (error) {
      console.error('Error deleting project:', error);
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to delete the project. Please try again.' });
      }
    }

    // As in BatchActionsDropdown: a failed reload after a successful delete must not read as a failed delete.
    if (deleted) {
      try {
        await onDeleted();
      } catch (error) {
        console.error('Error refreshing after project delete:', error);
        showToast({ type: 'warning', message: 'The project was deleted, but the page failed to refresh. Please reload to see the latest data.' });
      }
    }
    onLoadingChange(false);
  };

  return (
    <>
      <Button
        color="red"
        title="Delete project"
        aria-label={`Delete project ${projectId}`}
        disabled={isPreviewing}
        onClick={handleClick}
        className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded"
      >
        <TrashIcon stroke="white" className="h-5 w-5 text-gray-900" />
      </Button>

      <ConfirmDialogBatch
        isOpen={!!deletePreview}
        onClose={() => setDeletePreview(undefined)}
        onConfirm={handleConfirm}
        action="delete"
        title="Delete Project"
        buttonText="Yes, Delete Project"
        programName={programName}
        projectIds={projectId}
        projectCount={1}
        deletePreview={deletePreview}
      />
    </>
  );
};

export default DeleteProjectButton;
