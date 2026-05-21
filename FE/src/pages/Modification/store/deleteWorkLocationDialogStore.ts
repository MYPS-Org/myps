import { atom } from 'jotai';
import type { MajorItemLocations } from '../../Project/Model';

// Delete dialog state atoms for work locations
export const deleteWorkLocationDialogOpenAtom = atom<boolean>(false);
export const selectedWorkLocationForDeleteAtom = atom<MajorItemLocations | null>(null);
export const deleteWorkLocationIndexAtom = atom<number | null>(null);
export const deletingWorkLocationAtom = atom<boolean>(false);

// Derived atom to check if we can show the dialog
export const canShowDeleteWorkLocationDialogAtom = atom((get) => {
  const isOpen = get(deleteWorkLocationDialogOpenAtom);
  const selectedWorkLocation = get(selectedWorkLocationForDeleteAtom);
  const deleteIndex = get(deleteWorkLocationIndexAtom);
  
  return isOpen && selectedWorkLocation && deleteIndex !== null;
});

// Actions atoms
export const openDeleteWorkLocationDialogAtom = atom(
  null,
  (_get, set, { workLocation, index }: { workLocation: MajorItemLocations; index: number }) => {
    set(selectedWorkLocationForDeleteAtom, workLocation);
    set(deleteWorkLocationIndexAtom, index);
    set(deleteWorkLocationDialogOpenAtom, true);
  }
);

export const closeDeleteWorkLocationDialogAtom = atom(
  null,
  (_get, set) => {
    set(deleteWorkLocationDialogOpenAtom, false);
    set(selectedWorkLocationForDeleteAtom, null);
    set(deleteWorkLocationIndexAtom, null);
    set(deletingWorkLocationAtom, false);
  }
);

export const setDeletingWorkLocationStateAtom = atom(
  null,
  (_get, set, isDeleting: boolean) => {
    set(deletingWorkLocationAtom, isDeleting);
  }
);