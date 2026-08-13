import { atom } from 'jotai';
import type { FieldRules } from '../Model';

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
 * Set from API response
 * Possible values: 'On-going', 'Completed', 'Not yet started', 'Terminated'
 */
export const pcmaStatusAtom = atom<string>('');

/**
 * Package Status Atom
 * Set from API response
 * Possible values: 'packaged', 'not packaged'
 */
export const packageStatusAtom = atom<string>('');

/**
 * Modification Context Atom
 * Stores the current modification category, reason, and reasonId
 */
export const modificationContextAtom = atom<ModificationContext>({
    category: undefined,
    reason: undefined,
    reasonId: undefined
});

/**
 * Field Rules Atom
 * Stores the parsed field editability rules from API
 * true = editable, false = not editable
 */
export const fieldRulesAtom = atom<FieldRules | null>(null);

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Current Case Atom (Derived)
 * Determines the case based on PCMA status and package status
 * Returns: 'CaseA', 'CaseB', 'CaseC', or undefined if status not set
 */
export const currentCaseAtom = atom((get) => {
    const pcmaStatus = get(pcmaStatusAtom);
    const packageStatus = get(packageStatusAtom);

    if (!pcmaStatus || !packageStatus) {
        return undefined;
    }

    // Normalize strings to lowercase for case-insensitive comparison
    const normalizedPcmaStatus = pcmaStatus.toLowerCase();
    const normalizedPackageStatus = packageStatus.toLowerCase();
    
    // Case A: Not yet started AND not packaged
    if (normalizedPcmaStatus === 'not yet started' && normalizedPackageStatus === 'not packaged') {
        return 'CaseA';
    }
    
    // Case B: (Not yet started AND packaged) OR (On-going AND packaged)
    if ((normalizedPcmaStatus === 'not yet started' || normalizedPcmaStatus === 'on-going') && normalizedPackageStatus === 'packaged') {
        return 'CaseB';
    }
    
    // Case C: Completed OR Terminated (regardless of package status)
    if (normalizedPcmaStatus === 'completed' || normalizedPcmaStatus === 'terminated') {
        return 'CaseC';
    }
    
    return 'CaseC'; // Default to most restrictive
});

/**
 * Field Permissions Atom (Derived)
 * Automatically calculates field permissions based on API rules
 */
export const fieldPermissionsAtom = atom((get) => {
    const pcmaStatus = get(pcmaStatusAtom);
    const packageStatus = get(packageStatusAtom);
    const context = get(modificationContextAtom);
    const fieldRules = get(fieldRulesAtom);
    const currentCase = get(currentCaseAtom);

    // console.log('=== FIELD PERMISSIONS ATOM CALCULATION ===');
    // console.log('PCMA Status:', pcmaStatus);
    // console.log('Package Status:', packageStatus);
    // console.log('Current Case:', currentCase);
    // console.log('Field Rules from atom:', fieldRules);

    // If status not set, return null
    if (!pcmaStatus || !packageStatus) {
        return null;
    }

    // Collect all editable fields from API rules
    const editableFields: string[] = [];
    if (fieldRules) {
        Object.entries(fieldRules).forEach(([, rules]) => {
            if (rules) {
                // Handle both old format (Record<string, boolean>) and new format (FieldRuleSection)
                const fields = typeof rules === 'object' && 'Fields' in rules ? rules.Fields : rules;
                
                Object.entries(fields).forEach(([fieldName, isEditable]) => {
                    // console.log(`  Field: ${fieldName}, Editable: ${isEditable}`);
                    if (isEditable === true) {
                        editableFields.push(fieldName);
                        // console.log(`    ✓ Added ${fieldName} to editable fields`);
                    }
                });
            }
        });
    } else {
        console.warn('No field rules available');
    }

    const permissions: FieldPermissions = {
        pcmaStatus,
        packageStatus,
        case: currentCase || 'Unknown',
        category: context.category || '',
        reason: context.reason,
        editableFields
    };

    // console.log('Final permissions object:', permissions);
    // console.log('=========================================');

    return permissions;
});

/**
 * Is Field Editable Atom (Derived - Factory)
 * Returns an atom that checks if a specific field is editable based on API rules
 */
export const isFieldEditableAtom = (fieldName: string) => {
    return atom((get) => {
        const fieldRules = get(fieldRulesAtom);

        if (!fieldRules) {
            return true; // Default to editable if no rules set
        }

        // Check in all rule groups for the field
        for (const rules of Object.values(fieldRules)) {
            if (rules) {
                // Handle both old format and new format with Fields property
                const fields = typeof rules === 'object' && 'Fields' in rules ? rules.Fields : rules;
                
                if (fieldName in fields) {
                    return fields[fieldName] === true;
                }
            }
        }

        // If field not found in rules, default to not editable for safety
        return false;
    });
};

/**
 * Field Edit Status Atom (Derived - Factory)
 * Returns detailed status about why a field is or isn't editable
 */
export const fieldEditStatusAtom = (fieldName: string) => {
    return atom((get) => {
        const fieldRules = get(fieldRulesAtom);

        if (!fieldRules) {
            return { canEdit: true, reason: 'No restrictions' };
        }

        // Check in all rule groups for the field
        for (const [ruleGroup, rules] of Object.entries(fieldRules)) {
            if (rules) {
                // Handle both old format and new format with Fields property
                const fields = typeof rules === 'object' && 'Fields' in rules ? rules.Fields : rules;
                
                if (fieldName in fields) {
                    const canEdit = fields[fieldName] === true;
                    return {
                        canEdit,
                        reason: canEdit 
                            ? 'Field is editable per API rules' 
                            : `Field is restricted by ${ruleGroup}`,
                        ruleGroup
                    };
                }
            }
        }

        return { canEdit: false, reason: 'Field not found in rules', ruleGroup: undefined };
    });
}; 
                      

// ============================================================================
// Action Atoms (Write-only)
// ============================================================================

/**
 * Set Modification Context Atom (Action)
 * Updates the modification category, reason, and reasonId
 * Called from API in ModificationDetails.tsx
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
 * Called from API in ModificationDetails.tsx
 */
export const setStatusFromAPIAtom = atom(
    null,
    (_get, set, payload: { pcmaStatus: string; packageStatus: string }) => {
        set(pcmaStatusAtom, payload.pcmaStatus);
        set(packageStatusAtom, payload.packageStatus);
    }
);

/**
 * Set Field Rules From API Atom (Action)
 * Sets the field editability rules from API response
 * Called from API in ModificationDetails.tsx
 */
export const setFieldRulesAtom = atom(
    null,
    (_get, set, fieldRules: FieldRules) => {
        // console.log('=== SETTING FIELD RULES FROM API (ATOM) ===');
        // console.log('Field Rules received:', fieldRules);
        // console.log('Field Rules type:', typeof fieldRules);
        // console.log('Field Rules keys:', Object.keys(fieldRules || {}));
        
        // Log each rule group
        // if (fieldRules) {
        //     Object.entries(fieldRules).forEach(([group, rules]) => {
        //         console.log(`${group}:`, rules);
        //         if (rules) {
        //             // Handle both old format and new format
        //             const fields = typeof rules === 'object' && 'Fields' in rules ? rules.Fields : rules;
        //             const editableCount = Object.values(fields).filter(v => v === true).length;
        //             console.log(`  - ${editableCount} editable fields out of ${Object.keys(fields).length}`);
                    
        //             // Log CRUD rules if present
        //             if (typeof rules === 'object' && 'CRUD' in rules) {
        //                 console.log(`  - CRUD: CanAdd=${rules.CRUD.CanAdd}, CanDelete=${rules.CRUD.CanDelete}`);
        //                 if (rules.CRUD.Message) {
        //                     console.log(`  - Message: ${rules.CRUD.Message}`);
        //                 }
        //             }
        //         }
        //     });
        // }
        
        set(fieldRulesAtom, fieldRules);
        // console.log('Field rules set to atom successfully');
        // console.log('==========================================');
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
        set(fieldRulesAtom, null);
        set(modificationContextAtom, {
            category: undefined,
            reason: undefined,
            reasonId: undefined
        });
    }
);

/**
 * CRUD Rules Atom (Derived - Factory)
 * Returns the CRUD rules for a specific section
 */
export const crudRulesAtom = (section: 'ComponentCostRules' | 'ComponentCostYearRules' | 'MajorItemOfWorkRules' | 'MajorItemLocationRules' | 'FundingProfileRules') => {
    return atom((get) => {
        const fieldRules = get(fieldRulesAtom);
        
        if (!fieldRules || !fieldRules[section]) {
            return null;
        }
        
        const sectionRules = fieldRules[section];
        
        // Check if it has CRUD property (new format)
        if (typeof sectionRules === 'object' && 'CRUD' in sectionRules) {
            return sectionRules.CRUD;
        }
        
        return null;
    });
};

/**
 * Can Add Item Atom (Derived - Factory)
 * Checks if items can be added to a specific section
 */
export const canAddItemAtom = (section: 'ComponentCostRules' | 'ComponentCostYearRules' | 'MajorItemOfWorkRules' | 'MajorItemLocationRules' | 'FundingProfileRules') => {
    return atom((get) => {
        const crud = get(crudRulesAtom(section));
        
        if (!crud) {
            return true; // Default to allowing add if no rules
        }

        return crud.CanAdd === true;
    });
};

/**
 * Can Delete Item Atom (Derived - Factory)
 * Checks if items can be deleted from a specific section
 */
export const canDeleteItemAtom = (section: 'ComponentCostRules' | 'ComponentCostYearRules' | 'MajorItemOfWorkRules' | 'MajorItemLocationRules' | 'FundingProfileRules') => {
    return atom((get) => {
        const crud = get(crudRulesAtom(section));
        
        if (!crud) {
            return true; // Default to allowing delete if no rules
        }

        return crud.CanDelete === true;
    });
};
