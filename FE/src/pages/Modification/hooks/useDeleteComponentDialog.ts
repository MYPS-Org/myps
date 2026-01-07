import { useAtom } from 'jotai';
import type { ComponentCostWithYears } from '../../Project/Model';
import {
  openDeleteDialogAtom,
  closeDeleteDialogAtom,
  deleteDialogOpenAtom,
  selectedComponentForDeleteAtom,
  deleteIndexAtom,
  deletingComponentAtom,
  canShowDeleteDialogAtom
} from '../store/deleteDialogStore';

/**
 * Hook for managing delete component dialog state
 * 
 * @returns Object with dialog state and control functions
 */
export const useDeleteComponentDialog = () => {
  const [, openDialog] = useAtom(openDeleteDialogAtom);
  const [, closeDialog] = useAtom(closeDeleteDialogAtom);
  const [isOpen] = useAtom(deleteDialogOpenAtom);
  const [selectedComponent] = useAtom(selectedComponentForDeleteAtom);
  const [deleteIndex] = useAtom(deleteIndexAtom);
  const [isDeleting] = useAtom(deletingComponentAtom);
  const [canShowDialog] = useAtom(canShowDeleteDialogAtom);

  /**
   * Open delete confirmation dialog for a specific component
   * 
   * @param component - The component to delete
   * @param index - The index of the component in the array
   */
  const openDeleteDialog = (component: ComponentCostWithYears, index: number) => {
    openDialog({ component, index });
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
    selectedComponent,
    deleteIndex,
    isDeleting,
    canShowDialog,
    
    // Actions
    openDeleteDialog,
    closeDeleteDialog,
  };
};

export default useDeleteComponentDialog;