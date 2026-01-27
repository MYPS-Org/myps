import { useAtom } from 'jotai';
import type { MajorItemLocations } from '../../Project/Model';
import {
  openDeleteWorkLocationDialogAtom,
  closeDeleteWorkLocationDialogAtom,
  deleteWorkLocationDialogOpenAtom,
  selectedWorkLocationForDeleteAtom,
  deleteWorkLocationIndexAtom,
  deletingWorkLocationAtom,
  canShowDeleteWorkLocationDialogAtom
} from '../store/deleteWorkLocationDialogStore';

/**
 * Hook for managing delete work location dialog state
 * 
 * @returns Object with dialog state and control functions
 */
export const useDeleteWorkLocationDialog = () => {
  const [, openDialog] = useAtom(openDeleteWorkLocationDialogAtom);
  const [, closeDialog] = useAtom(closeDeleteWorkLocationDialogAtom);
  const [isOpen] = useAtom(deleteWorkLocationDialogOpenAtom);
  const [selectedWorkLocation] = useAtom(selectedWorkLocationForDeleteAtom);
  const [deleteIndex] = useAtom(deleteWorkLocationIndexAtom);
  const [isDeleting] = useAtom(deletingWorkLocationAtom);
  const [canShowDialog] = useAtom(canShowDeleteWorkLocationDialogAtom);

  /**
   * Open delete confirmation dialog for a specific work location
   * 
   * @param workLocation - The work location to delete
   * @param index - The index of the work location in the array
   */
  const openDeleteDialog = (workLocation: MajorItemLocations, index: number) => {
    console.log('useDeleteWorkLocationDialog: openDeleteDialog called with:', { workLocation: workLocation.InfraId, index });
    openDialog({ workLocation, index });
  };

  /**
   * Close the delete confirmation dialog
   */
  const closeDeleteDialog = () => {
    closeDialog();
  };

  return {
    // State
    isOpen,
    selectedWorkLocation,
    deleteIndex,
    isDeleting,
    canShowDialog,
    
    // Actions
    openDeleteDialog,
    closeDeleteDialog,
  };
};

export default useDeleteWorkLocationDialog;