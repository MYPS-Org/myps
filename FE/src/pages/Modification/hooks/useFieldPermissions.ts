import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import RuleManager from '../rules/RuleManager';
import {
    pcmaStatusAtom,
    packageStatusAtom,
    modificationContextAtom,
    currentCaseAtom,
    fieldPermissionsAtom,
    setModificationContextAtom,
    setStatusFromAPIAtom,
    resetStatusAtom,
    type ModificationContext,
    type FieldPermissions
} from '../store/fieldPermissionStore';

/**
 * Hook to manage field permissions (READ-ONLY)
 * Status and context are set from API only
 */
export const useFieldPermissions = () => {
    const pcmaStatus = useAtomValue(pcmaStatusAtom);
    const packageStatus = useAtomValue(packageStatusAtom);
    const context = useAtomValue(modificationContextAtom);
    const currentCase = useAtomValue(currentCaseAtom);
    const permissions = useAtomValue(fieldPermissionsAtom);

    return {
        pcmaStatus,
        packageStatus,
        context,
        currentCase,
        permissions
    };
};

/**
 * Hook to check if a specific field is editable
 * @param fieldName - The name of the field to check
 */
export const useIsFieldEditable = (fieldName: string): boolean => {
    const permissions = useAtomValue(fieldPermissionsAtom);
    const currentCase = useAtomValue(currentCaseAtom);
    const context = useAtomValue(modificationContextAtom);

    if (!permissions || !currentCase) {
        return true; // Default to editable if no restrictions set
    }

    return RuleManager.isFieldEditable(fieldName, currentCase, context.category, context.reason);
};

/**
 * Hook to get the edit status of a specific field with explanation
 * @param fieldName - The name of the field to check
 */
export const useFieldEditStatus = (fieldName: string) => {
    const permissions = useAtomValue(fieldPermissionsAtom);
    const currentCase = useAtomValue(currentCaseAtom);
    const context = useAtomValue(modificationContextAtom);

    if (!permissions || !currentCase) {
        return { canEdit: true, reason: 'No restrictions' };
    }

    return RuleManager.getFieldEditStatus(fieldName, currentCase, undefined, context.category, context.reason);
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

    return {
        pcmaStatus,
        packageStatus,
        context,
        currentCase,
        permissions
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
 * Hook for API integration - sets status and context from API
 */
export const useAPIIntegration = () => {
    const setFromAPI = useSetAtom(setStatusFromAPIAtom);
    const setContext = useSetAtom(setModificationContextAtom);

    const setStatusFromAPI = React.useCallback((pcmaStatus: string, packageStatus: string) => {
        setFromAPI({ pcmaStatus, packageStatus });
    }, [setFromAPI]);

    const setModificationContext = React.useCallback((context: ModificationContext) => {
        setContext(context);
    }, [setContext]);

    return {
        setStatusFromAPI,
        setModificationContext
    };
};

// Re-export types for convenience
export type { ModificationContext, FieldPermissions };

