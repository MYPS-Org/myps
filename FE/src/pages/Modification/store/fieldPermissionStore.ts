import { atom } from 'jotai';
import RuleManager from '../rules/RuleManager';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FieldPermissions {
    pcmaStatus: string;
    packageStatus: string;
    case: string;
    category: string;
    reason?: string;
    editableFields: string[];
}

export interface ModificationContext {
    category?: string;
    reason?: string;
    reasonId?: number;
}

// ============================================================================
// Core Atoms
// ============================================================================

/**
 * PCMA Status Atom
 * - For development: Set manually using debug buttons
 * - For production: Will be set from API response
 * 
 * Possible values: 'On-going', 'Completed', 'Not yet started', 'Terminated'
 */
export const pcmaStatusAtom = atom<string>(''); // Changed from atomWithStorage to regular atom

/**
 * Package Status Atom
 * - For development: Set manually using debug buttons
 * - For production: Will be set from API response
 * 
 * Possible values: 'packaged', 'not packaged'
 */
export const packageStatusAtom = atom<string>(''); // Changed from atomWithStorage to regular atom

/**
 * Modification Context Atom
 * Stores the current modification category, reason, and reasonId
 */
export const modificationContextAtom = atom<ModificationContext>({
    category: undefined,
    reason: undefined,
    reasonId: undefined
});

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Current Case Atom (Derived)
 * Automatically determines the case based on PCMA status and package status
 * Returns: 'CaseA', 'CaseB', 'CaseC', or undefined if status not set
 */
export const currentCaseAtom = atom((get) => {
    const pcmaStatus = get(pcmaStatusAtom);
    const packageStatus = get(packageStatusAtom);
    const context = get(modificationContextAtom);

    console.log('=== CURRENT CASE ATOM ===');
    console.log('PCMA Status from atom:', pcmaStatus);
    console.log('Package Status from atom:', packageStatus);
    console.log('Context:', context);

    if (!pcmaStatus || !packageStatus) {
        console.log('Status not set, returning undefined');
        return undefined;
    }

    const determinedCase = RuleManager.determineCase(pcmaStatus, packageStatus, context.category);
    console.log('Determined Case:', determinedCase);
    console.log('========================');
    
    return determinedCase;
});

/**
 * Field Permissions Atom (Derived)
 * Automatically calculates field permissions based on current state
 */
export const fieldPermissionsAtom = atom((get) => {
    const pcmaStatus = get(pcmaStatusAtom);
    const packageStatus = get(packageStatusAtom);
    const currentCase = get(currentCaseAtom);
    const context = get(modificationContextAtom);

    // If status not set, return null
    if (!pcmaStatus || !packageStatus || !currentCase) {
        return null;
    }

    // Calculate editable fields
    const editableFields = RuleManager.getEditableFieldsForCase(
        currentCase,
        context.category,
        context.reason
    );

    const permissions: FieldPermissions = {
        pcmaStatus,
        packageStatus,
        case: currentCase,
        category: context.category || 'modification',
        reason: context.reason,
        editableFields
    };

    return permissions;
});

/**
 * Is Field Editable Atom (Derived - Factory)
 * Returns an atom that checks if a specific field is editable
 */
export const isFieldEditableAtom = (fieldName: string, currentValue?: any) => {
    return atom((get) => {
        const permissions = get(fieldPermissionsAtom);
        const currentCase = get(currentCaseAtom);
        const context = get(modificationContextAtom);

        if (!permissions || !currentCase) {
            return true; // Default to editable if no restrictions set
        }

        return RuleManager.isFieldEditableWithValue(
            fieldName,
            currentCase,
            currentValue,
            context.category,
            context.reason
        );
    });
};

/**
 * Field Edit Status Atom (Derived - Factory)
 * Returns detailed status about why a field is or isn't editable
 */
export const fieldEditStatusAtom = (fieldName: string, currentValue?: any) => {
    return atom((get) => {
        const permissions = get(fieldPermissionsAtom);
        const currentCase = get(currentCaseAtom);
        const context = get(modificationContextAtom);

        if (!permissions || !currentCase) {
            return { canEdit: true, reason: 'No restrictions' };
        }

        return RuleManager.getFieldEditStatus(
            fieldName,
            currentCase,
            currentValue,
            context.category,
            context.reason
        );
    });
};

// ============================================================================
// Action Atoms (Write-only)
// ============================================================================

/**
 * Set Case A Atom (Action)
 * Sets status to Case A conditions (Not yet started + not packaged)
 */
export const setCaseAAtom = atom(
    null,
    (_get, set) => {
        set(pcmaStatusAtom, 'Not yet started');
        set(packageStatusAtom, 'not packaged');
    }
);

/**
 * Set Case B Atom (Action)
 * Sets status to Case B conditions (On-going + packaged)
 */
export const setCaseBAtom = atom(
    null,
    (_get, set) => {
        // Randomly choose between "On-going" and "Not yet started" for Case B
        const statuses = ['On-going', 'Not yet started'];
        const randomStatus = statuses[Math.floor(Math.random() * 2)];
        set(pcmaStatusAtom, randomStatus);
        set(packageStatusAtom, 'packaged');
    }
);

/**
 * Set Case C Atom (Action)
 * Sets status to Case C conditions (Completed or Terminated)
 */
export const setCaseCAtom = atom(
    null,
    (_get, set) => {
        // Randomly choose between "Completed" and "Terminated" for Case C
        const statuses = ['Completed', 'Terminated'];
        const randomStatus = statuses[Math.floor(Math.random() * 2)];
        set(pcmaStatusAtom, randomStatus);
        
        // Package status can be either for Case C
        const packageStatuses = ['packaged', 'not packaged'];
        const randomPackageStatus = packageStatuses[Math.floor(Math.random() * 2)];
        set(packageStatusAtom, randomPackageStatus);
    }
);

/**
 * Randomize Status Atom (Action)
 * Randomly sets PCMA and package status for testing
 */
export const randomizeStatusAtom = atom(
    null,
    (_get, set) => {
        const pcmaStatuses = ['On-going', 'Completed', 'Not yet started', 'Terminated'];
        const packageStatuses = ['packaged', 'not packaged'];
        
        const randomPcma = pcmaStatuses[Math.floor(Math.random() * pcmaStatuses.length)];
        const randomPackage = packageStatuses[Math.floor(Math.random() * packageStatuses.length)];
        
        set(pcmaStatusAtom, randomPcma);
        set(packageStatusAtom, randomPackage);
    }
);

/**
 * Set Modification Context Atom (Action)
 * Updates the modification category, reason, and reasonId
 */
export const setModificationContextAtom = atom(
    null,
    (_get, set, update: ModificationContext) => {
        set(modificationContextAtom, update);
    }
);

/**
 * Set Status From API Atom (Action)
 * Sets PCMA and package status from API response
 * This will be used in production when receiving data from other application
 */
export const setStatusFromAPIAtom = atom(
    null,
    (_get, set, payload: { pcmaStatus: string; packageStatus: string }) => {
        set(pcmaStatusAtom, payload.pcmaStatus);
        set(packageStatusAtom, payload.packageStatus);
    }
);

/**
 * Reset Status Atom (Action)
 * Clears all status and permission data
 */
export const resetStatusAtom = atom(
    null,
    (_get, set) => {
        set(pcmaStatusAtom, '');
        set(packageStatusAtom, '');
        set(modificationContextAtom, {
            category: undefined,
            reason: undefined,
            reasonId: undefined
        });
    }
);
