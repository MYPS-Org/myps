/**
 * Utility for handling revision navigation paths
 */

/**
 * Get the navigation path based on revision group ID
 * @param revisionGroupId - The revision group ID (1-12)
 * @param projectId - The project ID
 * @param stageName - The stage name
 * @returns The navigation path
 */
export const getRevisionNavigationPath = (
    revisionGroupId: number,
    projectId: string,
    stageName: string
): string => {
    const baseParams = `${projectId}:${stageName}`;
    
    switch (revisionGroupId) {
        case 1:
            return `/revision/modification/${baseParams}`;
        case 6:
            return `/revision/adjustment-details/${baseParams}`;
        case 10:
            return `/revision/additional-funding/${baseParams}`;
        case 7: 
            return `/revision/change-in-authority/${baseParams}`;
        case 12:
            return `/revision/change-in-funding/${baseParams}`;
        case 16:
            return `/revision/change-of-creditor/${baseParams}`;
        case 15:
            return `/revision/expire-funding/${baseParams}`;
        case 11:
            return `/revision/for-savings/${baseParams}`;
        case 13:
            return `/revision/mode-of-implementation/${baseParams}`;
        case 14:
            return `/revision/multi-year-costing-changes/${baseParams}`;
        case 8:
            return `/revision/non-implementable/${baseParams}`;
        case 9:
            return `/revision/termination/${baseParams}`;
        default:
            // Fallback to modification details
            return `/projects/project-details/${baseParams}`;
    }
};

/**
 * Extract project ID and stage from TransactionId
 * Format: P00900117LZ-1 -> { projectId: "P00900117LZ", revision: "1" }
 */
export const parseTransactionId = (transactionId: string): { projectId: string; revision: string; stageName: string } => {
    const parts = transactionId.split('-');
    const projectId = parts[0]; // e.g., "P00900117LZ"
    const revision = parts[1] || '1'; // e.g., "1"
    
    // Extract stage name from projectId (last 2 characters before the revision number)
    // Assuming format: P00900117LZ where LZ is the stage
    const stageName = projectId.slice(-2); // Get last 2 characters
    
    return {
        projectId,
        revision,
        stageName
    };
};
