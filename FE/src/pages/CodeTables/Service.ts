import { httpClient } from "../../services/httpClient";
import type { ModificationCategoryReason, RevisionRules, CodeTableData, AdminAreaData } from "./Model.d";

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

export const fetchCodeTableData = async () => {
    try {
        const response = await httpClient.post<CodeTableData>('CodeTable/GetAllCodeTables');
        return response;
    } catch (error) {
        console.error('Error fetching code table data:', error);
        throw error;
    }
}

export const updateCodeTable = async (code: string, transactionType: number, json: string) => {
    try {
        const response = await httpClient.post('/CodeTable/UpdateCodeTable', {
            Code: code,
            TransactionType: transactionType,
            Json: json
        });
        return response;
    }
    catch (error) {
        console.error('Error updating code table:', error);
        throw error;
    }
}

export const fetchAdminAreas = async () => {
    try {
        const response = await httpClient.post<AdminAreaData>('CodeTable/GetAdminAreas');
        return response;
    } catch (error) {
        console.error('Error fetching admin area data:', error);
        throw error;
    }
}