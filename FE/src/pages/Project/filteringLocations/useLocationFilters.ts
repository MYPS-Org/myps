import { useState, useEffect } from 'react';
import type { ProjectEnums, ProjectDetails } from '../Model';
import { type FilteredLocationData, emptyLocationData, getLocationFilters } from './locationFilterUtils';

/**
 * Hook that maintains filtered location dropdown data.
 * Automatically re-filters whenever the relevant project detail fields or
 * the isLumpSum flag change.
 */
export function useLocationFilters(
    projectEnums: ProjectEnums | null | undefined,
    projectDetails: ProjectDetails,
    isLumpSum: boolean,
): FilteredLocationData {
    const [filtered, setFiltered] = useState<FilteredLocationData>(emptyLocationData);

    useEffect(() => {
        if (!projectEnums) return;
        setFiltered(getLocationFilters(projectEnums, projectDetails, isLumpSum));
    }, [
        projectEnums,
        projectDetails.Province,
        projectDetails.City,
        projectDetails.LegislativeDistrict,
        projectDetails.DEO,
        projectDetails.ImplementingOffice,
        isLumpSum,
    ]);

    return filtered;
}
