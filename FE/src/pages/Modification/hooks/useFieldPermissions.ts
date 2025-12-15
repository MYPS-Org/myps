import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    pcmaStatusAtom,
    packageStatusAtom,
    modificationContextAtom,
    currentCaseAtom,
    fieldPermissionsAtom,
    setCaseAAtom,
    setCaseBAtom,
    setCaseCAtom,
    randomizeStatusAtom,
    setModificationContextAtom,
    setStatusFromAPIAtom,
    resetStatusAtom,
    isFieldEditableAtom,
    fieldEditStatusAtom,
    type ModificationContext,
    type FieldPermissions
} from '../store/fieldPermissionStore';

/**
 * Hook to manage field permissions
 * Provides all the necessary state and actions for field permission management
 */
export const useFieldPermissions = () => {
    const [pcmaStatus, setPcmaStatus] = useAtom(pcmaStatusAtom);
    const [packageStatus, setPackageStatus] = useAtom(packageStatusAtom);
    const [context, setContext] = useAtom(modificationContextAtom);
    const currentCase = useAtomValue(currentCaseAtom);
    const permissions = useAtomValue(fieldPermissionsAtom);

    // Action setters
    const setCaseA = useSetAtom(setCaseAAtom);
    const setCaseB = useSetAtom(setCaseBAtom);
    const setCaseC = useSetAtom(setCaseCAtom);
    const randomize = useSetAtom(randomizeStatusAtom);
    const setFromAPI = useSetAtom(setStatusFromAPIAtom);
    const reset = useSetAtom(resetStatusAtom);

    return {
        // State
        pcmaStatus,
        packageStatus,
        context,
        currentCase,
        permissions,

        // Direct setters (for API integration)
        setPcmaStatus,
        setPackageStatus,
        setContext,

        // Actions
        setCaseA,
        setCaseB,
        setCaseC,
        randomize,
        setFromAPI,
        reset
    };
};

/**
 * Hook to check if a specific field is editable
 * @param fieldName - The name of the field to check
 * @param currentValue - The current value of the field (optional)
 */
export const useIsFieldEditable = (fieldName: string, currentValue?: any): boolean => {
    const atom = isFieldEditableAtom(fieldName, currentValue);
    return useAtomValue(atom);
};

/**
 * Hook to get the edit status of a specific field with explanation
 * @param fieldName - The name of the field to check
 * @param currentValue - The current value of the field (optional)
 */
export const useFieldEditStatus = (fieldName: string, currentValue?: any) => {
    const atom = fieldEditStatusAtom(fieldName, currentValue);
    return useAtomValue(atom);
};

/**
 * Hook to initialize modification context from navigation state or props
 * @param category - Modification category
 * @param reason - Modification reason
 * @param reasonId - Modification reason ID
 */
export const useInitializeModificationContext = (
    category?: string,
    reason?: string,
    reasonId?: number
) => {
    const setContext = useSetAtom(setModificationContextAtom);

    // Initialize context when component mounts or when values change
    React.useEffect(() => {
        if (category || reason || reasonId) {
            setContext({ category, reason, reasonId });
        }
    }, [category, reason, reasonId, setContext]);
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
 * Provides actions for setting cases manually (for development/testing)
 */
export const useDebugControls = () => {
    const setCaseA = useSetAtom(setCaseAAtom);
    const setCaseB = useSetAtom(setCaseBAtom);
    const setCaseC = useSetAtom(setCaseCAtom);
    const randomize = useSetAtom(randomizeStatusAtom);
    const reset = useSetAtom(resetStatusAtom);

    return {
        setCaseA,
        setCaseB,
        setCaseC,
        randomize,
        reset
    };
};

/**
 * Hook for API integration
 * Provides functions to set status from API responses
 */
export const useAPIIntegration = () => {
    const setFromAPI = useSetAtom(setStatusFromAPIAtom);
    const setContext = useSetAtom(setModificationContextAtom);

    /**
     * Set status from API response
     * @param pcmaStatus - PCMA status from external API
     * @param packageStatus - Package status from external API
     */
    const setStatusFromAPI = React.useCallback((pcmaStatus: string, packageStatus: string) => {
        setFromAPI({ pcmaStatus, packageStatus });
    }, [setFromAPI]);

    /**
     * Set modification context from navigation or initial data
     */
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

