import { useCallback, useState } from 'react';
import { useAtom } from 'jotai';
import type {
  ComponentCost,
  ComponentCostYear,
  ComponentCostWithYears
} from '../../Project/Model';
import {
  componentCostsAtom,
  componentCostsYearAtom,
  componentCostsWithYearsAtom
} from '../atoms/componentCosts.atom';

export function useComponentCosts() {
  const [costs, setCosts] = useAtom(componentCostsAtom);
  const [years, setYears] = useAtom(componentCostsYearAtom);
  const [costsWithYears] = useAtom(componentCostsWithYearsAtom);

  // Delete-dialog state (local to the component using this hook)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ComponentCostWithYears | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const seedFromInitial = useCallback((initial?: { ComponentCosts?: ComponentCost[]; ComponentCostPerYear?: ComponentCostYear[] }) => {
    setCosts(initial?.ComponentCosts ? [...initial.ComponentCosts] : []);
    setYears(initial?.ComponentCostPerYear ? [...initial.ComponentCostPerYear] : []);
  }, [setCosts, setYears]);

  const add = useCallback((cost: ComponentCost, costYear?: ComponentCostYear) => {
    const referenceId = cost.ReferenceId || Date.now().toString();
    const newCost: ComponentCost = { ...cost, ReferenceId: referenceId };
    setCosts(prev => [...prev, newCost]);

    if (costYear) {
      const newYear: ComponentCostYear = {
        ...costYear,
        ParentId: referenceId,
        Id: costYear.Id || Date.now() + Math.floor(Math.random() * 1000)
      };
      setYears(prev => [...prev, newYear]);
    }
  }, [setCosts, setYears]);

  const update = useCallback((referenceId: string, updated: ComponentCost) => {
    setCosts(prev => prev.map(c => String(c.ReferenceId) === String(referenceId) ? { ...updated, ReferenceId: referenceId } : c));
  }, [setCosts]);

  const remove = useCallback((referenceId: string) => {
    setCosts(prev => prev.filter(c => String(c.ReferenceId) !== String(referenceId)));
    setYears(prev => prev.filter(y => String(y.ParentId) !== String(referenceId)));
  }, [setCosts, setYears]);

  const removeByIndex = useCallback((index: number) => {
    const ref = costs?.[index]?.ReferenceId;
    if (ref) remove(String(ref));
  }, [costs, remove]);

  const addYear = useCallback((parentId: string, year: ComponentCostYear) => {
    const newYear = { ...year, ParentId: parentId, Id: year.Id || Date.now() + Math.floor(Math.random() * 1000) };
    setYears(prev => [...prev, newYear]);
  }, [setYears]);

  const editYear = useCallback((id: number, updatedYear: ComponentCostYear) => {
    setYears(prev => prev.map(y => (y.Id === id ? { ...updatedYear, Id: id } : y)));
  }, [setYears]);

  const removeYear = useCallback((id: number) => {
    setYears(prev => prev.filter(y => y.Id !== id));
  }, [setYears]);

  const total = useCallback(() => (costs || []).reduce((s, c) => s + (c.Total || 0), 0), [costs]);

  // Delete-dialog helpers
  const openDelete = useCallback((component: ComponentCostWithYears, index: number) => {
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
      const ref = selectedForDelete.ReferenceId;
      if (ref) remove(String(ref));
    } finally {
      setIsDeleting(false);
      closeDelete();
    }
  }, [selectedForDelete, deleteIndex, isDeleting, remove, closeDelete]);

  return {
    // read
    costs,
    years,
    costsWithYears,
    // actions
    add,
    update,
    remove,
    removeByIndex,
    addYear,
    editYear,
    removeYear,
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