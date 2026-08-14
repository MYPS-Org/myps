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
import { generateTempId } from "../../../utils/GlobalFunctions";

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
            Id: generateTempId(),
            Source: '',
            ComponentCostFK: 0,
            ProjectFK: '',
            ProjectId: '',
            StageName: '',
            ComponentId: '',
            YearOfWork: 0,
            WorkTypeFK: 0,
            InfraTypeFK: '',
            TargetUnitId: 0,
            TargetUnit: '',
            CreatedBy: '',
            IsDeleted: false
        };

        setItems(prev => [...prev, {
            Id: newItem.Id,
            Source: newItem.Source,
            ComponentCostFK: newItem.ComponentCostFK,
            ProjectFK: newItem.ProjectFK,
            ProjectId: newItem.ProjectId,
            StageName: newItem.StageName,
            ComponentId: newItem.ComponentId,
            YearOfWork: newItem.YearOfWork,
            WorkTypeFK: newItem.WorkTypeFK,
            InfraTypeFK: newItem.InfraTypeFK,
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
                    Source: updatedItem.Source,
                    ComponentCostFK: updatedItem.ComponentCostFK,
                    ProjectFK: updatedItem.ProjectFK,
                    ProjectId: updatedItem.ProjectId,
                    StageName: updatedItem.StageName,
                    ComponentId: updatedItem.ComponentId,
                    YearOfWork: updatedItem.YearOfWork,
                    WorkTypeFK: updatedItem.WorkTypeFK,
                    InfraTypeFK: updatedItem.InfraTypeFK,
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

        const itemId = itemToDelete.Id;

        // Check if any DB-persisted locations exist for this item
        const hasDbLocations = currentLocations.some(l => l.WorkItemFK === itemId && l.Id > 0);

        // Process locations: hard-delete Id<=0, soft-delete Id>0
        setLocations(locs =>
          locs
            .filter(l => !(l.WorkItemFK === itemId && l.Id <= 0))
            .map(l => l.WorkItemFK === itemId ? { ...l, IsDeleted: true } : l)
        );

        if (itemToDelete.Id <= 0 && !hasDbLocations) {
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