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

  const update = useCallback((componentId: string, updated: ComponentCost, costPerYear?: ComponentCostPerYear[]) => {
    setCosts(prev => prev.map(c => c.ComponentId === componentId ? updated : c));
    if (costPerYear !== undefined) {
      // ComponentCostPerYear.ComponentCostFK links to ComponentCost.Id (not ComponentId)
      setCostPerYear(prev => [
        ...prev.filter(c => c.ComponentCostFK !== updated.Id),
        ...costPerYear
      ]);
    }
  }, [setCosts, setCostPerYear]);

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