import { atom } from 'jotai';
import type { ComponentCostWithYears } from '../../Project/Model';

// Delete dialog state atoms
export const deleteDialogOpenAtom = atom<boolean>(false);
export const selectedComponentForDeleteAtom = atom<ComponentCostWithYears | null>(null);
export const deleteIndexAtom = atom<number | null>(null);
export const deletingComponentAtom = atom<boolean>(false);

// Derived atom to check if we can show the dialog
export const canShowDeleteDialogAtom = atom((get) => {
  const isOpen = get(deleteDialogOpenAtom);
  const selectedComponent = get(selectedComponentForDeleteAtom);
  const deleteIndex = get(deleteIndexAtom);
  
  return isOpen && selectedComponent && deleteIndex !== null;
});

// Actions atoms
export const openDeleteDialogAtom = atom(
  null,
  (get, set, { component, index }: { component: ComponentCostWithYears; index: number }) => {
    set(selectedComponentForDeleteAtom, component);
    set(deleteIndexAtom, index);
    set(deleteDialogOpenAtom, true);
  }
);

export const closeDeleteDialogAtom = atom(
  null,
  (get, set) => {
    set(deleteDialogOpenAtom, false);
    set(selectedComponentForDeleteAtom, null);
    set(deleteIndexAtom, null);
    set(deletingComponentAtom, false);
  }
);

export const setDeletingStateAtom = atom(
  null,
  (get, set, isDeleting: boolean) => {
    set(deletingComponentAtom, isDeleting);
  }
);