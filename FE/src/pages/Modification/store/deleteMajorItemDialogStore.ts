import { atom } from 'jotai';
import type { MajorItemOfWorksWithDropdown } from '../../Project/Model';

// Delete dialog state atoms for major items
export const deleteMajorItemDialogOpenAtom = atom<boolean>(false);
export const selectedMajorItemForDeleteAtom = atom<MajorItemOfWorksWithDropdown | null>(null);
export const deleteMajorItemIndexAtom = atom<number | null>(null);
export const deletingMajorItemAtom = atom<boolean>(false);

// Derived atom to check if we can show the dialog
export const canShowDeleteMajorItemDialogAtom = atom((get) => {
  const isOpen = get(deleteMajorItemDialogOpenAtom);
  const selectedMajorItem = get(selectedMajorItemForDeleteAtom);
  const deleteIndex = get(deleteMajorItemIndexAtom);
  
  return isOpen && selectedMajorItem && deleteIndex !== null;
});

// Actions atoms
export const openDeleteMajorItemDialogAtom = atom(
  null,
  (get, set, { majorItem, index }: { majorItem: MajorItemOfWorksWithDropdown; index: number }) => {
    set(selectedMajorItemForDeleteAtom, majorItem);
    set(deleteMajorItemIndexAtom, index);
    set(deleteMajorItemDialogOpenAtom, true);
  }
);

export const closeDeleteMajorItemDialogAtom = atom(
  null,
  (get, set) => {
    set(deleteMajorItemDialogOpenAtom, false);
    set(selectedMajorItemForDeleteAtom, null);
    set(deleteMajorItemIndexAtom, null);
    set(deletingMajorItemAtom, false);
  }
);

export const setDeletingMajorItemStateAtom = atom(
  null,
  (get, set, isDeleting: boolean) => {
    set(deletingMajorItemAtom, isDeleting);
  }
);