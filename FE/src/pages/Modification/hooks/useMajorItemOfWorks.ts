import { useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";

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
    const setItems = useSetAtom(MajorItemOfWorksAtom);
    const setLocations = useSetAtom(MajorItemLocationsAtom);
    const setScopeOfWorks = useSetAtom(ScopeOfWorkEnumAtom);
    
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
            ReferenceId: `temp_${Date.now()}`,
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

        if (itemToDelete.Id === 0) {
          // New item - hard delete (remove from array and its locations)
          setLocations(locs => locs.filter(l => l.ParentId !== refId));
          return prev.filter((_, i) => i !== index);
        } else {
          // Existing item - soft delete (mark as deleted and mark its locations as deleted)
          setLocations(locs => locs.map(l => 
            l.ParentId === refId ? { ...l, IsDeleted: true } : l
          ));
          return prev.map((item, i) => 
            i === index ? { ...item, IsDeleted: true } : item
          );
        }
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