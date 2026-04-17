import { useCallback } from "react";
import { useAtom } from "jotai";

import type {
    MajorItemOfWorksWithDropdown,
} from "../../Project/Model";
import {
    MajorItemLocationsAtom,
    MajorItemOfWorksAtom,
    MajorItemOfWorksWithDropdownAtom,
    ScopeOfWorkEnumAtom
} from "../atoms/majorItemOfWorks.atom"

export const useMajorItemOfWorks = () => {
    const [, setItems] = useAtom(MajorItemOfWorksAtom);
    const [currentLocations, setLocations] = useAtom(MajorItemLocationsAtom);
    const [, setScopeOfWorks] = useAtom(ScopeOfWorkEnumAtom);
    
    // UI Ready
    const [majorItems] = useAtom(MajorItemOfWorksWithDropdownAtom);

    /** 
     * Seed major items, locations, and scope of works from initial data
    */
    const seedFromInitialData = useCallback((initialData?: any) => {
        if(!initialData) return;

        setItems(initialData.MajorItemOfWorks ?? []);
        setLocations(initialData.MajorItemLocations ?? []);
        setScopeOfWorks(initialData?.Dropdowns?.ScopeOfWorks ?? []);
    }, [setItems, setLocations, setScopeOfWorks]);

    /**
     * CRUD Operations
     */

    const addMajorItem = (item?: MajorItemOfWorksWithDropdown) => {
        const newItem = item ?? {
            Id: 0,
            ProjectId: '',
            ReferenceId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ComponentId: '',
            YearOfWork: 0,
            WorkTypeId: 0,
            InfraType: '',
            TargetUnitId: 0,
            TargetUnit: '',
            CreatedBy: '',
            IsDeleted: false
        };

        setItems(prev => [...prev, {
            Id: newItem.Id,
            ProjectId: newItem.ProjectId,
            ReferenceId: newItem.ReferenceId,
            ComponentId: newItem.ComponentId,
            YearOfWork: newItem.YearOfWork,
            WorkTypeId: newItem.WorkTypeId,
            InfraType: newItem.InfraType,
            TargetUnitId: newItem.TargetUnitId,
            TargetUnit: newItem.TargetUnit,
            CreatedBy: newItem.CreatedBy,
            IsDeleted: false
        }]);
    }

    const editMajorItem = (
        index: number,
        updatedItem: MajorItemOfWorksWithDropdown
        ) => {
        setItems(prev =>
            prev.map((item, i) =>
            i === index
                ? {
                    Id: updatedItem.Id,
                    ProjectId: updatedItem.ProjectId,
                    ReferenceId: updatedItem.ReferenceId,
                    ComponentId: updatedItem.ComponentId,
                    YearOfWork: updatedItem.YearOfWork,
                    WorkTypeId: updatedItem.WorkTypeId,
                    InfraType: updatedItem.InfraType,
                    TargetUnitId: updatedItem.TargetUnitId,
                    TargetUnit: updatedItem.TargetUnit,
                    CreatedBy: updatedItem.CreatedBy,
                    IsDeleted: updatedItem.IsDeleted ?? item.IsDeleted ?? false
                }
                : item
            )
        );
        // Note: MajorItemLocations are now managed independently via useMajorItemLocations hook
    };


    const deleteMajorItem = (index: number) => {
        setItems(prev => {
        const itemToDelete = prev[index];
        if (!itemToDelete) return prev;

        const refId = itemToDelete.ReferenceId;
        if (!refId) return prev;

        // Check if any DB-persisted locations exist for this item
        const hasDbLocations = currentLocations.some(l => l.ParentId === refId && l.Id > 0);

        // Process locations: hard-delete Id===0, soft-delete Id>0
        setLocations(locs =>
          locs
            .filter(l => !(l.ParentId === refId && l.Id === 0))
            .map(l => l.ParentId === refId ? { ...l, IsDeleted: true } : l)
        );

        if (itemToDelete.Id === 0 && !hasDbLocations) {
          // Fully unsaved — hard delete the item
          return prev.filter((_, i) => i !== index);
        }
        // Soft delete — item is in DB, or has DB children that need explicit delete signal
        return prev.map((item, i) =>
          i === index ? { ...item, IsDeleted: true } : item
        );
        });
    };

    return {
        // Data
        majorItems,
        // Fetch/Seed
        seedFromInitialData,
        // CRUD
        addMajorItem,
        editMajorItem,
        deleteMajorItem
    };
};