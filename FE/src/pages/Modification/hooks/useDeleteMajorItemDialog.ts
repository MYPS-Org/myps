import { useAtom } from 'jotai';
import type { MajorItemOfWorksWithDropdown } from '../../Project/Model';
import {
  openDeleteMajorItemDialogAtom,
  closeDeleteMajorItemDialogAtom,
  deleteMajorItemDialogOpenAtom,
  selectedMajorItemForDeleteAtom,
  deleteMajorItemIndexAtom,
  deletingMajorItemAtom,
  canShowDeleteMajorItemDialogAtom
} from '../store/deleteMajorItemDialogStore';

/**
 * Hook for managing delete major item dialog state
 * 
 * @returns Object with dialog state and control functions
 */
export const useDeleteMajorItemDialog = () => {
  const [, openDialog] = useAtom(openDeleteMajorItemDialogAtom);
  const [, closeDialog] = useAtom(closeDeleteMajorItemDialogAtom);
  const [isOpen] = useAtom(deleteMajorItemDialogOpenAtom);
  const [selectedMajorItem] = useAtom(selectedMajorItemForDeleteAtom);
  const [deleteIndex] = useAtom(deleteMajorItemIndexAtom);
  const [isDeleting] = useAtom(deletingMajorItemAtom);
  const [canShowDialog] = useAtom(canShowDeleteMajorItemDialogAtom);

  /**
   * Open delete confirmation dialog for a specific major item
   * 
   * @param majorItem - The major item to delete
   * @param index - The index of the major item in the array
   */
  const openDeleteDialog = (majorItem: MajorItemOfWorksWithDropdown, index: number) => {
    console.log('useDeleteMajorItemDialog: openDeleteDialog called with:', { majorItem: majorItem.ComponentId, index });
    openDialog({ majorItem, index });
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
    selectedMajorItem,
    deleteIndex,
    isDeleting,
    canShowDialog,
    
    // Actions
    openDeleteDialog,
    closeDeleteDialog,
  };
};

export default useDeleteMajorItemDialog;