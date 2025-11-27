import { httpClient } from "../../services/httpClient";
import type { ModificationCategoryReason, RevisionRules } from "./Model.d";

export const fetchRevisionReasons = async () => {
    try {
        const response = await httpClient.post<ModificationCategoryReason[]>('/codetable/revisionreasons');
        return response;
    } catch (error) {
        console.error('Error fetching revision reasons:', error);
        throw error;
    }
};

export const fetchRevisionRules = async () => {
    try {
        const response = await httpClient.post<RevisionRules[]>('/codetable/revisionrules');
        return response;
    } catch (error) {
        console.error('Error fetching revision rules:', error);
        throw error;
    }
};