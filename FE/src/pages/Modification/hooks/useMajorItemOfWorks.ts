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
            CreatedBy: ''
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
            CreatedBy: newItem.CreatedBy
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
                    CreatedBy: updatedItem.CreatedBy
                }
                : item
            )
        );
        
        // Update MajorItemLocations if they exist in the updatedItem
        if (updatedItem.MajorItemLocations && updatedItem.MajorItemLocations.length >= 0) {
            setLocations(prev => {
                // Remove old locations for this parent
                const filtered = prev.filter(loc => loc.ParentId !== updatedItem.ReferenceId);
                // Add updated locations
                const updated = [...filtered, ...updatedItem.MajorItemLocations];
                return updated;
            });
        }
    };


    const deleteMajorItem = (index: number) => {
        setItems(prev => {
        const refId = prev[index]?.ReferenceId;
        if (!refId) return prev;

        setLocations(locs => locs.filter(l => l.ParentId !== refId));
        return prev.filter((_, i) => i !== index);
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