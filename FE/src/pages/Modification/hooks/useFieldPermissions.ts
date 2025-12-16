import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
    pcmaStatusAtom,
    packageStatusAtom,
    modificationContextAtom,
    currentCaseAtom,
    fieldPermissionsAtom,
    fieldRulesAtom,
    setModificationContextAtom,
    setStatusFromAPIAtom,
    setFieldRulesAtom,
    resetStatusAtom,
    type ModificationContext,
    type FieldPermissions
} from '../store/fieldPermissionStore';

/**
 * Hook to manage field permissions (READ-ONLY)
 * Status and rules are set from API only
 */
export const useFieldPermissions = () => {
    const pcmaStatus = useAtomValue(pcmaStatusAtom);
    const packageStatus = useAtomValue(packageStatusAtom);
    const context = useAtomValue(modificationContextAtom);
    const currentCase = useAtomValue(currentCaseAtom);
    const permissions = useAtomValue(fieldPermissionsAtom);
    const fieldRules = useAtomValue(fieldRulesAtom);

    return {
        pcmaStatus,
        packageStatus,
        context,
        currentCase,
        permissions,
        fieldRules
    };
};

/**
 * Hook to check if a specific field is editable
 * @param fieldName - The name of the field to check
 */
export const useIsFieldEditable = (fieldName: string): boolean => {
    const fieldRules = useAtomValue(fieldRulesAtom);

    if (!fieldRules) {
        return true; // Default to editable if no rules set
    }

    // Check in all rule groups for the field
    for (const rules of Object.values(fieldRules)) {
        if (rules && fieldName in rules) {
            return rules[fieldName] === true;
        }
    }

    // If field not found in rules, default to not editable for safety
    return false;
};

/**
 * Hook to get the edit status of a specific field with explanation
 * @param fieldName - The name of the field to check
 */
export const useFieldEditStatus = (fieldName: string) => {
    const fieldRules = useAtomValue(fieldRulesAtom);

    if (!fieldRules) {
        return { canEdit: true, reason: 'No restrictions' };
    }

    // Check in all rule groups for the field
    for (const [ruleGroup, rules] of Object.entries(fieldRules)) {
        if (rules && fieldName in rules) {
            const canEdit = rules[fieldName] === true;
            return {
                canEdit,
                reason: canEdit 
                    ? 'Field is editable per API rules' 
                    : `Field is not editable per ${ruleGroup}`
            };
        }
    }

    return { canEdit: false, reason: 'Field not found in API rules' };
};

/**
 * Hook to check multiple fields at once
 * @param fieldNames - Array of field names to check
 * @returns Object mapping field names to their editable state
 */
export const useFieldsEditable = (fieldNames: string[]): Record<string, boolean> => {
    const fieldRules = useAtomValue(fieldRulesAtom);

    return React.useMemo(() => {
        if (!fieldRules) {
            return fieldNames.reduce((acc, field) => ({ ...acc, [field]: true }), {});
        }

        return fieldNames.reduce((acc, fieldName) => {
            // Check in all rule groups for the field
            for (const rules of Object.values(fieldRules)) {
                if (rules && fieldName in rules) {
                    acc[fieldName] = rules[fieldName] === true;
                    return acc;
                }
            }
            // If field not found, default to not editable
            acc[fieldName] = false;
            return acc;
        }, {} as Record<string, boolean>);
    }, [fieldNames, fieldRules]);
};

/**
 * Hook to get edit status for multiple fields at once
 * @param fieldNames - Array of field names to check
 * @returns Object mapping field names to their edit status with explanation
 */
export const useFieldsEditStatus = (fieldNames: string[]): Record<string, { canEdit: boolean; reason: string }> => {
    const fieldRules = useAtomValue(fieldRulesAtom);

    return React.useMemo(() => {
        if (!fieldRules) {
            return fieldNames.reduce((acc, field) => ({ 
                ...acc, 
                [field]: { canEdit: true, reason: 'No restrictions' } 
            }), {});
        }

        return fieldNames.reduce((acc, fieldName) => {
            // Check in all rule groups for the field
            for (const [ruleGroup, rules] of Object.entries(fieldRules)) {
                if (rules && fieldName in rules) {
                    const canEdit = rules[fieldName] === true;
                    acc[fieldName] = {
                        canEdit,
                        reason: canEdit 
                            ? 'Field is editable per API rules' 
                            : `Field is not editable per ${ruleGroup}`
                    };
                    return acc;
                }
            }
            acc[fieldName] = { canEdit: false, reason: 'Field not found in API rules' };
            return acc;
        }, {} as Record<string, { canEdit: boolean; reason: string }>);
    }, [fieldNames, fieldRules]);
};

/**
 * Hook to get only the read-only field permission state
 * Useful for components that only need to read permissions
 */
export const useFieldPermissionState = () => {
    const pcmaStatus = useAtomValue(pcmaStatusAtom);
    const packageStatus = useAtomValue(packageStatusAtom);
    const context = useAtomValue(modificationContextAtom);
    const currentCase = useAtomValue(currentCaseAtom);
    const permissions = useAtomValue(fieldPermissionsAtom);
    const fieldRules = useAtomValue(fieldRulesAtom);

    return {
        pcmaStatus,
        packageStatus,
        context,
        currentCase,
        permissions,
        fieldRules
    };
};

/**
 * Hook for debug controls only
 */
export const useDebugControls = () => {
    const reset = useSetAtom(resetStatusAtom);
    return { reset };
};

/**
 * Hook for API integration - sets status, context, and field rules from API
 */
export const useAPIIntegration = () => {
    const setFromAPI = useSetAtom(setStatusFromAPIAtom);
    const setContext = useSetAtom(setModificationContextAtom);
    const setRules = useSetAtom(setFieldRulesAtom);

    const setStatusFromAPI = React.useCallback((pcmaStatus: string, packageStatus: string) => {
        setFromAPI({ pcmaStatus, packageStatus });
    }, [setFromAPI]);

    const setModificationContext = React.useCallback((context: ModificationContext) => {
        setContext(context);
    }, [setContext]);

    const setFieldRules = React.useCallback((fieldRules: any) => {
        setRules(fieldRules);
    }, [setRules]);

    return {
        setStatusFromAPI,
        setModificationContext,
        setFieldRules
    };
};

// Re-export types for convenience
export type { ModificationContext, FieldPermissions };

