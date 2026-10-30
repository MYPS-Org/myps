import type { User } from '../pages/login/Service';

/*  The group rule mirrors the backend project view gate (Helpers/ProjectHelper.cs): DPC or RPC, and
    neither AUC nor DPD Admin. Keep the two in step. */
export const RESTRICTED_GROUPS = ['DPC', 'RPC'];
export const SEE_ALL_GROUPS = ['AUC', 'DPD Admin'];

/** A district or regional user (DEO / RO): DPC or RPC, and neither AUC nor DPD Admin. */
export const isRestrictedUser = (user: User | null | undefined): boolean => {
    const groups = user?.UserGroupNames ?? [];
    return groups.some((g) => RESTRICTED_GROUPS.includes(g))
        && !groups.some((g) => SEE_ALL_GROUPS.includes(g));
};
