// Field permission rules for PCMA modifications

const projectDetailFields = [
    'Description',
];

const projectFundingProfileFields = [
    'FundingAgreement',
    'FundSource',
    'FundingOrganization',
    'FundingAdd',
    'FundingDelete',
];

const projectComponentFields = [
    'ComponentCost',
    'ComponentDescription',
    'ComponentCostEdit',
    'ComponentAdd',
    // 'ComponentDelete',
];

const majorItemOfWorkFields = [
    'MajorItemOfWork',
    'MajorItemOfWorkAdd',
    'MajorItemOfWorkDelete',
    'TargetUnit'
];

const physicalTargetFields = [
    'WorkLocation',
    'WorkLocationEdit',
    'WorkLocationAdd',
    'WorkLocationDelete',
    'PhysicalTarget',
];

// Reason-specific field rules (within each case)
// These rules are applied AFTER the case is determined
const reasonSpecificFields: Record<string, string[]> = {
    // Reason: "Correction of MYPS typographical error for consistency with GAA"
    'Additional funds for ROW (STO)' : [
        ...projectFundingProfileFields,
        ...projectComponentFields,
        ...majorItemOfWorkFields,
        ...physicalTargetFields,
    ],

    'Additional (buffer) funds from other agencies' : [
        ...projectFundingProfileFields,
        'Description',
        'ComponentDescription',
        'ComponentCostEdit',
    ],
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
            break;
    }
    // Apply reason-specific field rules
    if (reason && reasonSpecificFields[reason]) {
        const reasonFields = reasonSpecificFields[reason];
        // Intersect caseFields with reasonFields to get final editable fields
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
        editableFields: editableFields
    };
};

const setCaseA = () => {
    const pcmaStatus = 'Not yet started';
    const packageStatus = 'not packaged';
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase, );
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        editableFields
    };
};

const setCaseB = () => {
    const pcmaStatus = ['On-going', 'Not yet started'][Math.floor(Math.random() * 2)];
    const packageStatus = 'packaged';
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        editableFields
    };
};

const setCaseC = () => {
    const pcmaStatus = ['Completed', 'Terminated'][Math.floor(Math.random() * 2)];
    const packageStatus = ['not packaged', 'packaged'][Math.floor(Math.random() * 2)];
    const currentCase = determineCase(pcmaStatus, packageStatus);
    const editableFields = getEditableFieldsForCase(currentCase);
    return {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        editableFields
    };
}

// Helper function to check if a specific field is editable based on current rules
const isFieldEditable = (fieldName: string, currentCase: string) => {
    const editableFields = getEditableFieldsForCase(currentCase);
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

// Export all the functions and data
export default {
    projectDetailFields,
    projectComponentFields,
    majorItemOfWorkFields,
    physicalTargetFields,
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
