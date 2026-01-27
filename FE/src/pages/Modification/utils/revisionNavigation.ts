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
        case 1: // Additional Funding
            return `/revision/additional-funding/${baseParams}`;
        case 2: // Adjustment
            return `/revision/adjustment-details/${baseParams}`;
        case 3: // Change in Authority to Implement
            return `/revision/change-in-authority/${baseParams}`;
        case 4: // Change in Funding
            return `/revision/change-in-funding/${baseParams}`;
        case 5: // Change of Creditor
            return `/revision/change-of-creditor/${baseParams}`;
        case 6: // Expired Funding
            return `/revision/expired-funding/${baseParams}`;
        case 7: // For Savings - Partial Unutilized Balance
            return `/revision/for-saving/${baseParams}`;
        case 8: // Mode of Implementation
            return `/revision/mode-of-implementation/${baseParams}`;
        case 9: // Modification Details
            return `/revision/modification-details/${baseParams}`;
            case 10: // Multi-Year Costing Changes
        return `/revision/multi-year-costing-changes/${baseParams}`;
            case 11: // Non-Implementable
        return `/revision/non-implementable/${baseParams}`;
            case 12: // Termination
        return `/revision/termination/${baseParams}`;
        default:
            // Fallback to modification details
            return `/revision/modification-details/${baseParams}`;
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
