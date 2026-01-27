import { useCallback, useState } from 'react';
import { useAtom } from 'jotai';
import type {
  ComponentCost
} from '../../Project/Model';
import {
  componentCostsAtom
} from '../atoms/componentCosts.atom';

export function useComponentCosts() {
  const [costs, setCosts] = useAtom(componentCostsAtom);

  // Delete-dialog state (local to the component using this hook)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ComponentCost | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const seedFromInitial = useCallback((initial?: { ComponentCosts?: ComponentCost[] }) => {
    setCosts(initial?.ComponentCosts ? [...initial.ComponentCosts] : []);
  }, [setCosts]);

  const add = useCallback((cost: ComponentCost) => {
    setCosts(prev => [...prev, cost]);
  }, [setCosts]);

  const update = useCallback((componentId: string, updated: ComponentCost) => {
    setCosts(prev => prev.map(c => c.ComponentId === componentId ? updated : c));
  }, [setCosts]);

  const remove = useCallback((componentId: string) => {
    setCosts(prev => prev.filter(c => c.ComponentId !== componentId));
  }, [setCosts]);

  const removeByIndex = useCallback((index: number) => {
    setCosts(prev => prev.map((cost, i) => 
      i === index ? { ...cost, IsDeleted: true } : cost
    ));
  }, [setCosts]);

  const total = useCallback(() => (costs || []).reduce((s, c) => s + (c.Amount || 0), 0), [costs]);

  // Delete-dialog helpers
  const openDelete = useCallback((component: ComponentCost, index: number) => {
    setSelectedForDelete(component);
    setDeleteIndex(index);
    setIsDeleteOpen(true);
  }, []);

  const closeDelete = useCallback(() => {
    setIsDeleteOpen(false);
    setSelectedForDelete(null);
    setDeleteIndex(null);
    setIsDeleting(false);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedForDelete || deleteIndex === null || isDeleting) return;
    try {
      setIsDeleting(true);
      const componentId = selectedForDelete.ComponentId;
      if (componentId) {
        // Use conditional delete based on Id
        if (selectedForDelete.Id === 0) {
          // New item - hard delete
          remove(componentId);
        } else {
          // Existing item - soft delete
          removeByIndex(deleteIndex);
        }
      }
    } finally {
      setIsDeleting(false);
      closeDelete();
    }
  }, [selectedForDelete, deleteIndex, isDeleting, remove, removeByIndex, closeDelete]);

  return {
    // read
    costs,
    // actions
    add,
    update,
    remove,
    removeByIndex,
    // helpers
    seedFromInitial,
    total,
    // delete-dialog state & actions
    isDeleteOpen,
    selectedForDelete,
    deleteIndex,
    isDeleting,
    openDelete,
    closeDelete,
    confirmDelete
  } as const;
}

export default useComponentCosts;