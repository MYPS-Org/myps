// Field permission rules for PCMA modifications

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
];

const projectFundingProfileFields = [
    'FundingAgreement',
    'FundSource',
    'FundingOrganization',
];

const projectComponentFields = [
    'ComponentCost',
    'Description',
    'Project Component Cost',
    'Component Addition (for ROW, CW, CWD, or DR type)',
    'Component Deletion (for CW, CWD, ROW or DR)',
];

const majorItemOfWorkFields = [
    'MajorItemOfWork',
    'Add or Delete Major Item of Work (e.g., Target, Type of Work)',
    'Target Unit'
];

const physicalTargetFields = [
    'WorkLocation',
    'Physical Target',
    'Work Location fields (e.g., station limits, validation based on infrastructure type)',
];

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

const getEditableFieldsForCase = (caseType: string) => {
    switch (caseType) {
        case 'CaseA':
            // Case A: All fields are editable (most permissive)
            return [
                ...projectDetailFields,
                ...projectComponentFields,
                ...majorItemOfWorkFields,
                ...physicalTargetFields
            ];
            
        case 'CaseB':
            // Case B: Only Description, EmergencyMode, and Origin are editable
            return [
                'Description',
                'EmergencyMode', 
                'Origin',
                'ComponentCost',
                'MajorItemOfWork',
                'WorkLocation'
            ];
            
        case 'CaseC':
            // Case C: No fields are editable
            return [];
            
        default:
            return [];
    }
};

// Function to run randomization and get editable fields
const runRandomization = () => {
    const currentPcmaStatus = getPcmaStatus();
    const currentPackageStatus = packaged();
    const currentCase = determineCase(currentPcmaStatus, currentPackageStatus);
    const editableFields = getEditableFieldsForCase(currentCase);
    
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
    const editableFields = getEditableFieldsForCase(currentCase);
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

// Export all the functions and data
export default {
    projectDetailFields,
    projectFundingProfileFields,
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
    setCaseA,
    setCaseB,
    setCaseC
};
