import { useCallback, useState } from 'react';
import { useAtom } from 'jotai';
import type {
  ComponentCost,
  ComponentCostPerYear
} from '../../Project/Model';
import {
  componentCostsAtom,
  componentCostPerYearAtom
} from '../atoms/componentCosts.atom';
import {
  MajorItemOfWorksAtom,
  MajorItemLocationsAtom
} from '../atoms/majorItemOfWorks.atom';

export function useComponentCosts() {
  const [costs, setCosts] = useAtom(componentCostsAtom);
  const [costPerYear, setCostPerYear] = useAtom(componentCostPerYearAtom);
  const [currentMajorItems, setMajorItemsAtom] = useAtom(MajorItemOfWorksAtom);
  const [currentLocations, setLocationsAtom] = useAtom(MajorItemLocationsAtom);

  // Delete-dialog state (local to the component using this hook)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ComponentCost | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const seedFromInitial = useCallback((initial?: { ComponentCosts?: ComponentCost[]; ComponentCostPerYear?: ComponentCostPerYear[] }) => {
    setCosts(initial?.ComponentCosts ? [...initial.ComponentCosts] : []);
    setCostPerYear(initial?.ComponentCostPerYear ? [...initial.ComponentCostPerYear] : []);
  }, [setCosts, setCostPerYear]);

  const add = useCallback((cost: ComponentCost, costPerYear?: ComponentCostPerYear[]) => {
    setCosts(prev => [...prev, cost]);
    if (costPerYear && costPerYear.length > 0) {
      setCostPerYear(prev => [...prev, ...costPerYear]);
    }
  }, [setCosts, setCostPerYear]);

  /**
   * Replaces the component at `index`. Changing its Component Type changes its ComponentId
   * (e.g. CoS -> CW1), so its rows are found by what it was BEFORE the edit: a saved
   * component by Id (ComponentCostFK), an unsaved one by its old ComponentId, since every
   * unsaved component shares ComponentCostFK 0. Its Major Items and work locations get the
   * new ComponentId, because the backend matches new ones to their component by that ID.
   */
  const update = useCallback((index: number, updated: ComponentCost, costPerYear?: ComponentCostPerYear[]) => {
    const previous = costs[index];
    if (!previous) return;
    const previousComponentId = previous.ComponentId;
    const belongsToEdited = (fk: number, componentId: string) =>
      previous.Id > 0 ? fk === previous.Id : (!fk || fk <= 0) && componentId === previousComponentId;

    setCosts(prev => prev.map((c, i) => i === index ? updated : c));
    if (costPerYear !== undefined) {
      // Saved rows already soft-deleted stay, so the delete still reaches the backend;
      // the dialog only received the active rows.
      setCostPerYear(prev => [
        ...prev.filter(c => !belongsToEdited(c.ComponentCostFK, c.ComponentId) || (c.IsDeleted && c.Id > 0)),
        ...costPerYear
      ]);
    }

    if (previousComponentId !== updated.ComponentId) {
      setMajorItemsAtom(prev => prev.map(item =>
        !item.IsDeleted && belongsToEdited(item.ComponentCostFK, item.ComponentId)
          ? { ...item, ComponentId: updated.ComponentId }
          : item));
      setLocationsAtom(prev => prev.map(loc =>
        !loc.IsDeleted && loc.ComponentId === previousComponentId
          ? { ...loc, ComponentId: updated.ComponentId }
          : loc));
    }
  }, [costs, setCosts, setCostPerYear, setMajorItemsAtom, setLocationsAtom]);

  const remove = useCallback((componentId: string) => {
    setCosts(prev => prev.filter(c => c.ComponentId !== componentId));
  }, [setCosts]);

  const removeByIndex = useCallback((index: number) => {
    setCosts(prev => {
      const cost = prev[index];
      if (cost && (!cost.Id || cost.Id <= 0)) {
        // Unsaved row: hard-remove rather than leaving an IsDeleted ghost behind.
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((c, i) => i === index ? { ...c, IsDeleted: true } : c);
    });
  }, [setCosts]);

  const total = useCallback(() => (costs || []).reduce((s, c) => s + (c.Total || 0), 0), [costs]);

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

      const hasDbId = selectedForDelete.Id && selectedForDelete.Id > 0;
      const costFK = selectedForDelete.Id;
      const componentId = selectedForDelete.ComponentId;

      // Step 1: Delete ComponentCost itself — hard if Id<=0 (unsaved), soft if Id>0
      if (!hasDbId) {
        setCosts(prev => prev.filter((_, i) => i !== deleteIndex));
      } else {
        setCosts(prev => prev.map((cost, i) =>
          i === deleteIndex ? { ...cost, IsDeleted: true } : cost
        ));
      }

      // Step 2: Cascade to ComponentCostPerYear — hard-delete Id<=0, soft-delete Id>0
      setCostPerYear(prev =>
        prev
          .filter(c => !(c.ComponentCostFK === costFK && c.Id <= 0))
          .map(c =>
            c.ComponentCostFK === costFK
              ? { ...c, IsDeleted: true }
              : c
          )
      );

      // Step 3: Cascade to MajorItems and their Locations
      const relatedItemIds = new Set(
        currentMajorItems
          .filter(item => item.ComponentId === componentId && !item.IsDeleted)
          .map(item => item.Id)
      );

      // Step 3a: Locations — hard-delete Id<=0, soft-delete Id>0
      setLocationsAtom(prev =>
        prev
          .filter(loc => !(relatedItemIds.has(loc.WorkItemFK) && loc.Id <= 0))
          .map(loc =>
            relatedItemIds.has(loc.WorkItemFK)
              ? { ...loc, IsDeleted: true }
              : loc
          )
      );

      // Step 3b: MajorItems — respect each item's own Id
      setMajorItemsAtom(prev => {
        const updated = prev.map(item => {
          if (item.ComponentId !== componentId || item.IsDeleted) return item;
          if (item.Id <= 0) {
            // Hard-delete only if no DB-persisted locations exist for this item
            const hasDbLocations = currentLocations.some(
              loc => loc.WorkItemFK === item.Id && loc.Id > 0
            );
            if (!hasDbLocations) return null;
          }
          return { ...item, IsDeleted: true };
        });
        return updated.filter(item => item !== null) as typeof prev;
      });

    } finally {
      setIsDeleting(false);
      closeDelete();
    }
  }, [selectedForDelete, deleteIndex, isDeleting, setCosts, setCostPerYear, currentMajorItems, currentLocations, setMajorItemsAtom, setLocationsAtom, closeDelete]);

  return {
    // read
    costs,
    costPerYear,
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
    confirmDelete,
    // per-year cost actions
    setCostPerYear
  } as const;
}

export default useComponentCosts;