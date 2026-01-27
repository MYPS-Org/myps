import type { ProjectComponentStatus } from '../Model.d';

/**
 * Determines the overall PCMA status based on component statuses
 * Rules:
 * - If ANY component is "On-Going" → Overall status is "On-Going"
 * - If ALL components are "Completed" → Overall status is "Completed"
 * - If ALL components are "Not yet started" → Overall status is "Not yet started"
 * - If ALL components are "Terminated" → Overall status is "Terminated"
 * - For mixed statuses (except On-Going), prioritize active statuses over terminated/completed
 */
export const determinePCMAStatus = (componentsStatus: ProjectComponentStatus[]): string => {
    if (!componentsStatus || componentsStatus.length === 0) {
        return 'Not yet started';
    }

    // Check if ANY component is On-Going (highest priority)
    const hasOnGoing = componentsStatus.some(
        component => component.ConstructionStatusName?.toLowerCase() === 'on-going'
    );
    if (hasOnGoing) {
        return 'On-Going';
    }

    // Get all unique statuses
    const statuses = componentsStatus.map(c => c.ConstructionStatusName?.toLowerCase() || 'not yet started');
    const uniqueStatuses = new Set(statuses);

    // If ALL are completed
    if (uniqueStatuses.size === 1 && uniqueStatuses.has('completed')) {
        return 'Completed';
    }

    // If ALL are not yet started
    if (uniqueStatuses.size === 1 && uniqueStatuses.has('not yet started')) {
        return 'Not yet started';
    }

    // If ALL are terminated
    if (uniqueStatuses.size === 1 && uniqueStatuses.has('terminated')) {
        return 'Terminated';
    }

    // For mixed statuses without On-Going:
    // If there's at least one "Not yet started" or any active status
    if (uniqueStatuses.has('not yet started')) {
        return 'Not yet started';
    }

    // Default fallback (mixed terminated/completed)
    return 'Not yet started';
};

/**
 * Determines the overall Package status based on component statuses
 * Rules:
 * - If ALL components are packaged → "Packaged"
 * - Otherwise → "Not Packaged"
 */
export const determinePackageStatus = (componentsStatus: ProjectComponentStatus[]): string => {
    if (!componentsStatus || componentsStatus.length === 0) {
        return 'Not Packaged';
    }

    // Check if ALL components are packaged using PackedStatusName from API
    const allPackaged = componentsStatus.every(
        component => component.PackedStatusName?.toLowerCase() === 'packaged'
    );

    return allPackaged ? 'Packaged' : 'Not Packaged';
};
