import { httpClient } from "../../services/httpClient";
import type { ModificationCategory, OptionRevisionCategory, OptionRevisionHeader, OptionRevisionReasons } from "./Model.d"
import type { ProjectDetails, ComponentCost, ComponentCostYear, MajorItemOfWork, MajorItemLocations, FundingProfile } from "../Project/Model.d";

export const fetchRevDropdownData = async () => {
    try {
        const response = await httpClient.post<{ RevisionTypes: OptionRevisionHeader[], Categories: OptionRevisionCategory[], Reasons: OptionRevisionReasons[] }>('/Revision/RevisionCategories');
        return response;
    } catch (error) {
        console.error('Error fetching modification dropdown data:', error);
        throw error;
    }
}

export const submitModificationRequest = async (
    payload: {
        RevisionDetails: {
            ReasonId: number;
            ApprovalDate: string;
            ApprovedDocument: {
                Name: string;
                Extension: string;
                ContentType: string;
                DataUrl: string;
            };
        }
        ProjectDetails: ProjectDetails;
        ComponentCosts: ComponentCost[];
        ComponentCostYear: ComponentCostYear[];
        MajorItemOfWorks: MajorItemOfWork[];
        MajorItemLocations: MajorItemLocations[];
        FundingProfile: FundingProfile[];
    },
    userRole?: string
) => {
    try {
        // Determine endpoint based on user role
        // IO = Implementing Office, RO = Regional Office
        const isIO = userRole?.toLowerCase().includes('implementing') || userRole?.toLowerCase().includes('io');
        const endpoint = isIO ? '/IORevision/RequestRevision/' : '/RORevision/RequestRevision/';
        
        const response = await httpClient.post(endpoint, payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error requesting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const updateRevisionRequestStatus = async (projectId: string, status: string) => {
    try {
        const response = await httpClient.post(`/RORevision/UpdateRevisionStatus/`, { 'ProjectId': projectId, 'Status': status }, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error requesting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const getLabelField = async (payload: { categoryDesc: any; reasonId: any; projectId: string | undefined }) => {
    try {
        const response = await httpClient.post(`/IORevision/GetLabelField/`, payload);
        return response;
    } catch (error) {
        console.error('Error fetching label field:', error);
        throw error;
    }
};