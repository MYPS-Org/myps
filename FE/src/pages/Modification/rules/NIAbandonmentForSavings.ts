// Field permission rules for Non-Implementable - Abandonment For Savings category
// CodeGroupId: 8 - Shares same rules with NIDelisted and NIReversion

const projectDetailFields = [
    'Description',
];

const projectFundingProfileFields = [
    'Source',
    'Agreement',
    'Amount',
    'Percentage'
];

const projectComponentFields = [
    'ComponentType',
    'ComponentId',
    'ComponentDescription',
    'ComponentTotal',
    'ComponentStartDate',
    'ComponentEndDate',
    'ComponentCost',
];

const majorItemOfWorkFields: string[] = [];

const physicalTargetFields: string[] = [];

const pcmaStatus = [
    'On-going',
    'Completed',
    'Not yet started',
    'Terminated'
];

const packageStatus = [
    'packaged',
    'not packaged'
];

// Reason-specific field mapping based on CSV data
// All 13 reasons for CodeGroupId 8 follow the same pattern:
// - Only "Not yet started" + "not packaged" allows editing
// - All other combinations return None (no editable fields)
const reasonSpecificFields: Record<string, string[]> = {
    'Unresolved ROW': [...projectComponentFields, ...projectFundingProfileFields],
    'Unresolved Utilities': [...projectComponentFields, ...projectFundingProfileFields],
    'No Site': [...projectComponentFields, ...projectFundingProfileFields],
    'Site Inaccessible': [...projectComponentFields, ...projectFundingProfileFields],
    'Issues with other Agencies Concerned': [...projectComponentFields, ...projectFundingProfileFields],
    'Late release of SARO/SAA': [...projectComponentFields, ...projectFundingProfileFields],
    'Modification disapproved': [...projectComponentFields, ...projectFundingProfileFields],
    'Presidential approval for by administration above PHP 50M not recieved/disapproved': [...projectComponentFields, ...projectFundingProfileFields],
    'Failure of Bidding': [...projectComponentFields, ...projectFundingProfileFields],
    'Insufficient Funds': [...projectComponentFields, ...projectFundingProfileFields],
    'Insufficient Time to Implement': [...projectComponentFields, ...projectFundingProfileFields],
    'Inadequate Resources': [...projectComponentFields, ...projectFundingProfileFields],
    'Third Party Intervention': [...projectComponentFields, ...projectFundingProfileFields],
};

const getPcmaStatus = () => {
    const rand = Math.random();
    if (rand < 0.25) {
        return pcmaStatus[0];
    } else if (rand < 0.5) {
        return pcmaStatus[1];
    } else if (rand < 0.75) {
        return pcmaStatus[2];
    } else {
        return pcmaStatus[3];
    }
};

const packaged = () => {
    const rand = Math.random();
    return rand < 0.5 ? packageStatus[0] : packageStatus[1];
};

// Determine case based on PCMA status and package status
const determineCase = (pcmaStatus: string, packageStatus: string) => {
    // Case A: Not yet started AND not packaged (only case that allows editing for NI categories)
    if (pcmaStatus === 'Not yet started' && packageStatus === 'not packaged') {
        return 'CaseA';
    }
    
    // Case C: All other combinations (no fields editable)
    return 'CaseC';
};

const getEditableFieldsForCase = (caseType: string, reason?: string) => {
    switch (caseType) {
        case 'CaseA':
            // Case A: Only "Not yet started" + "not packaged" allows editing
            // Return reason-specific fields if reason is provided
            if (reason && reasonSpecificFields[reason]) {
                return reasonSpecificFields[reason];
            }
            // Default fields if no reason specified
            return [...projectComponentFields, ...projectFundingProfileFields];
            
        case 'CaseC':
            // Case C: No fields are editable for all other combinations
            return [];
            
        default:
            return [];
    }
};

const runRandomization = (reason?: string) => {
    const currentPcmaStatus = getPcmaStatus();
    const currentPackageStatus = packaged();
    const currentCase = determineCase(currentPcmaStatus, currentPackageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    
    return {
        pcmaStatus: currentPcmaStatus,
        packageStatus: currentPackageStatus,
        case: currentCase,
        editableFields: editableFields,
        reason: reason
    };
};

const setCaseA = (reason?: string) => {
    const pcmaStatus = 'Not yet started';
    const packageStatus = 'not packaged';
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        editableFields,
        reason
    };
};

const setCaseB = (reason?: string) => {
    // Case B doesn't exist for NI categories - all map to Case C
    const pcmaStatus = 'On-going';
    const packageStatus = 'packaged';
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        editableFields,
        reason
    };
};

const setCaseC = (reason?: string) => {
    // Pick any combination that results in Case C
    const pcmaStatus = ['Completed', 'Terminated', 'On-going'][Math.floor(Math.random() * 3)];
    const packageStatus = ['not packaged', 'packaged'][Math.floor(Math.random() * 2)];
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        editableFields,
        reason
    };
};

const isFieldEditable = (fieldName: string, currentCase: string, reason?: string) => {
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return editableFields.includes(fieldName);
};

// Get available reasons for this category
const getAvailableReasons = () => {
    return Object.keys(reasonSpecificFields);
};

// Get fields for a specific reason
const getFieldsForReason = (reason: string) => {
    return reasonSpecificFields[reason] || [];
};

export default {
    projectDetailFields,
    projectFundingProfileFields,
    projectComponentFields,
    majorItemOfWorkFields,
    physicalTargetFields,
    reasonSpecificFields,
    pcmaStatus,
    packageStatus,
    getPcmaStatus,
    packaged,
    determineCase,
    getEditableFieldsForCase,
    runRandomization,
    isFieldEditable,
    getAvailableReasons,
    getFieldsForReason,
    setCaseA,
    setCaseB,
    setCaseC
};