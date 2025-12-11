// Field permission rules for Adjustment category

const projectDetailFields = [
    'Description',
    'EmergencyMode',
    'Origin',
    'MYCAApprovalDate',
    'OperatingUnit',
    'ImplementingOffice',
    'DEO',
    'LegislativeDistrict',
    'City',
    'Agency',
    'Thrust',
];

const projectFundingProfileFields = [
    'FundingAgreement',
    'FundSource',
    'FundingOrganization',
];

const projectComponentFields = [
    'EditComponentCost',
    'ComponentCost',
    'ComponentDescription',
    'AddComponentCost',
    'DeleteComponentCost',
    
    'ComponentType',
    'StartDate',
    'EndDate',
    'Total'
];

const majorItemOfWorkFields = [
    'MajorItemOfWork',
    'AddMajorItemOfWork',
    'DeleteMajorItemOfWork',
    'EditMajorItemOfWork',
    // 'TargetUnit',
];

const physicalTargetFields = [
    'AddWorkLocation',
    'EditWorkLocation',
    'DeleteWorkLocation',
    'InfraId',
    'PhysicalTarget',
    'DetailedScope',
    'StartX',
    'StartY',
    'EndX',
    'EndY',
    'TargetUnit',
    'StartChainage',
    'EndChainage',
    'StartStationLimit',
    'EndStationLimit'
];

// Reason-specific field rules (within each case)
// These rules are applied AFTER the case is determined
const reasonSpecificFields: Record<string, string[]> = {
     // Reason: "New Component needed - movement of funds also required"
    // Note: Component types EAO, EXC, and SAV are automatically filtered out in AddMajorItemDialog
    'Component incorrectly set up - to be deleted': [
        // CRUD permissions for component cost
        'EditComponentCost',
        'DeleteComponentCost',
        'AddComponentCost',
        // CRUD permissions for major item of work
        // 'AddMajorItemOfWork',
        'DeleteMajorItemOfWork',
        // 'EditMajorItemOfWork',
        // Allow field access in Component Cost Dialog
        'ComponentDescription',      // Component description field
        'Total',           // Cost amount field
        'ComponentType',   // Component type dropdown
        'StartDate',       // Planned start date
        'EndDate'          // Planned end date
    ],
    // Reason: "Correction of MYPS typographical error for consistency with GAA"
    'Correction of MYPS typographical error for consistency with GAA': [
        'Description'
    ],
    
    // Reason: "Correction of MYPS for null or zero targets"
    'Correction of MYPS for null or zero targets': [
        'PhysicalTarget',
        // 'AddWorkLocation',
        'EditWorkLocation',
    ],
    
    // Reason: "Move funds between existing Project Components"
    'Move funds between existing Project Components': [
        'EditComponentCost',
        'AddComponentCost',

        // Allow field access in Component Cost Dialog
        'Description',      // Component description field
        'Total',           // Cost amount field
        'ComponentType',   // Component type dropdown
        'StartDate',       // Planned start date
        'EndDate'          // Planned end date
    ],
    
    // Reason: "Input of missing Location, Work Location data (if null or zero)"
    'Input of missing Location, Work Location data (if null or zero)': [
        'AddWorkLocation',
        'EditWorkLocation',
        'InfraId',
        'PhysicalTarget',
        'DetailedScope',
        'StartX',
        'StartY',
        'EndX',
        'EndY',
        'TargetUnit',
        'StartChainage',
        'EndChainage',
        'StartStationLimit',
        'EndStationLimit'
    ],
    
    // Reason: "Input of missing Planned Start/End Date (only if null or zero)"
    'Input of missing Planned Start/End Date (only if null or zero)': [
        // Allow access to component cost form
        'EditComponentCost',
        // Add date fields when they're implemented
        'StartDate',
        'EndDate',
        // 'PlannedStartDate',
        // 'Total'
    ],
    
    // Reason: "Excess Amount due to Revised Estimate"
    'Excess Amount due to Revised Estimate': [
        'AddComponentCost',
        'EditComponentCost', 
        'ComponentDescription',
        'Total',
        'ComponentType',
        'StartDate',
        'EndDate'
    ],
    
    // Reason: "New Component needed - movement of funds also required"
    // Note: Component types EAO, EXC, and SAV are automatically filtered out in AddMajorItemDialog
    'New Component needed - movement of funds also required': [
        // CRUD permissions for component cost
        'EditComponentCost',
        // 'DeleteComponentCost',
        'AddComponentCost',
        // CRUD permissions for major item of work
        'AddMajorItemOfWork',
        'DeleteMajorItemOfWork',
        'EditMajorItemOfWork',
        // Allow field access in Component Cost Dialog
        'Description',      // Component description field
        'Total',           // Cost amount field
        'ComponentType',   // Component type dropdown
        'StartDate',       // Planned start date
        'EndDate'          // Planned end date
    ]
};

// Dynamic field conditions - defines when a field can be edited based on its current value
// Format: { reason: { fieldName: validationFunction } }
const fieldValueConditions: Record<string, Record<string, (value: any) => boolean>> = {
    'Correction of MYPS for null or zero targets': {
        'PhysicalTarget': (value) => value === null || value === undefined || value === 0 || value === '',
        'WorkLocation': (value) => value === null || value === undefined || value === '',
        'TargetUnit': (value) => value === null || value === undefined || value === '',
    },
    'Input of missing Location, Work Location data (if null or zero)': {
        'City': (value) => value === null || value === undefined || value === '',
        'LegislativeDistrict': (value) => value === null || value === undefined || value === 0 || value === '',
        'WorkLocation': (value) => value === null || value === undefined || value === '',
        'WorkLocationAdd': (_value) => true, // Adding is always allowed when condition matches
        'PhysicalTarget': (value) => value === null || value === undefined || value === 0 || value === '',
    },
    'Input of missing Planned Start/End Date (only if null or zero)': {
        'PlannedStartDate': (value) => value === null || value === undefined || value === '',
        'PlannedEndDate': (value) => value === null || value === undefined || value === '',
        'StartDate': (value) => value === null || value === undefined || value === '',
        'EndDate': (value) => value === null || value === undefined || value === '',
    }
};

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

// Helper function to determine case based on status and package
const determineCase = (pcmaStatus: string, packageStatus: string) => {
    // Case A: Not yet started AND not packaged
    if (pcmaStatus === 'Not yet started' && packageStatus === 'not packaged') {
        return 'CaseA';
    }
    
    // Case B: (Not yet started AND packaged) OR (On-going AND packaged)
    if ((pcmaStatus === 'Not yet started' || pcmaStatus === 'On-going') && packageStatus === 'packaged') {
        return 'CaseB';
    }
    
    // Case C: Completed OR Terminated (regardless of package status)
    if (pcmaStatus === 'Completed' || pcmaStatus === 'Terminated') {
        return 'CaseC';
    }
    
    return 'CaseC'; // Default to most restrictive
};

const getEditableFieldsForCase = (caseType: string, reason?: string) => {
    let caseFields: string[] = [];
    
    // First, determine base fields based on case
    switch (caseType) {
        case 'CaseA':
            // Case A: All fields are editable (most permissive)
            caseFields = [
                ...projectDetailFields,
                ...projectFundingProfileFields,
                ...projectComponentFields,
                ...majorItemOfWorkFields,
                ...physicalTargetFields
            ];
            break;
            
        case 'CaseB':
            // Case B: Only Description, EmergencyMode, and Origin are editable
            caseFields = [
                'Description',
                'EmergencyMode', 
                'Origin',
                'Agency',
                // Funding Profile
                'FundingProfile',
                // Component Cost they are not allowed to delete description
                'ComponentCostEdit',
                // Work Location
                'WorkLocationEdit',
            ];
            break;
            
        case 'CaseC':
            // Case C: No fields are editable
            caseFields = [];
            break;
            
        default:
            caseFields = [];
    }
    
    // Then, if a reason is provided, further filter fields based on reason-specific rules
    if (reason && reasonSpecificFields[reason]) {
        // Intersection: only fields allowed by both case AND reason
        const reasonFields = reasonSpecificFields[reason];
        caseFields = caseFields.filter(field => reasonFields.includes(field));
    }
    
    return caseFields;
};

// Function to run randomization and get editable fields
const runRandomization = (reason?: string) => {
    const currentPcmaStatus = getPcmaStatus();
    const currentPackageStatus = packaged();
    const currentCase = determineCase(currentPcmaStatus, currentPackageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    
    return {
        pcmaStatus: currentPcmaStatus,
        packageStatus: currentPackageStatus,
        case: currentCase,
        reason: reason,
        editableFields: editableFields
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
        reason: reason,
        editableFields
    };
};

const setCaseB = (reason?: string) => {
    const pcmaStatus = ['On-going', 'Not yet started'][Math.floor(Math.random() * 2)];
    const packageStatus = 'packaged';
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        reason: reason,
        editableFields
    };
};

const setCaseC = (reason?: string) => {
    const pcmaStatus = ['Completed', 'Terminated'][Math.floor(Math.random() * 2)];
    const packageStatus = ['not packaged', 'packaged'][Math.floor(Math.random() * 2)];
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        reason: reason,
        editableFields
    };
}

// Helper function to check if a specific field is editable based on current rules
const isFieldEditable = (fieldName: string, currentCase: string, reason?: string) => {
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    return editableFields.includes(fieldName);
};

// Helper function to get all available reasons with specific field rules
const getAvailableReasons = () => {
    return Object.keys(reasonSpecificFields);
};

// Helper function to get fields allowed for a specific reason (independent of case)
const getFieldsForReason = (reason: string) => {
    return reasonSpecificFields[reason] || [];
};

// Helper function to check if a field can be edited based on its current value and the reason's conditions
const canEditFieldBasedOnValue = (fieldName: string, currentValue: any, reason?: string): boolean => {
    // If no reason specified, no additional value-based restrictions
    if (!reason) {
        return true;
    }
    
    // Check if this reason has value-based conditions
    const reasonConditions = fieldValueConditions[reason];
    if (!reasonConditions) {
        return true; // No value conditions for this reason
    }
    
    // Check if this specific field has a condition
    const fieldCondition = reasonConditions[fieldName];
    if (!fieldCondition) {
        return true; // No value condition for this specific field
    }
    
    // Apply the condition
    return fieldCondition(currentValue);
};

// Enhanced version of isFieldEditable that considers both permissions AND value conditions
const isFieldEditableWithValue = (
    fieldName: string, 
    currentCase: string, 
    fieldValue?: any,
    reason?: string
): boolean => {
    // First check if field is in the editable list for this case/reason
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    const isInEditableList = editableFields.includes(fieldName);
    
    if (!isInEditableList) {
        return false; // Not in editable list, definitely not editable
    }
    
    // If in editable list, check value-based conditions
    if (fieldValue !== undefined) {
        return canEditFieldBasedOnValue(fieldName, fieldValue, reason);
    }
    
    // If no value provided, just return the permission-based result
    return true;
};

// Helper function to get field edit status with reason
const getFieldEditStatus = (
    fieldName: string,
    currentCase: string,
    fieldValue?: any,
    reason?: string
): { canEdit: boolean; reason: string } => {
    const editableFields = getEditableFieldsForCase(currentCase, reason);
    const isInEditableList = editableFields.includes(fieldName);
    
    if (!isInEditableList) {
        return {
            canEdit: false,
            reason: 'Field is not editable for this case/reason combination'
        };
    }


    
    if (fieldValue !== undefined && reason && fieldValueConditions[reason]?.[fieldName]) {
        const conditionMet = canEditFieldBasedOnValue(fieldName, fieldValue, reason);
        if (!conditionMet) {
            return {
                canEdit: false,
                reason: 'Field already has a value and cannot be edited per the modification reason'
            };
        }
    }
    
    return {
        canEdit: true,
        reason: 'Field is editable'
    };
};

// Export all the functions and data
export default {
    projectDetailFields,
    projectFundingProfileFields,
    projectComponentFields,
    majorItemOfWorkFields,
    physicalTargetFields,
    reasonSpecificFields,
    fieldValueConditions,
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
    setCaseC,
    // New value-based functions
    canEditFieldBasedOnValue,
    isFieldEditableWithValue,
    getFieldEditStatus
};
