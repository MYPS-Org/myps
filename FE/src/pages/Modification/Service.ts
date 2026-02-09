import { httpClient } from "../../services/httpClient";
import type { ModificationCategory } from "./Model.d"
import type { ProjectDetails, ComponentCost, ComponentCostYear, MajorItemOfWork, MajorItemLocations, FundingProfile } from "../Project/Model.d";

export const fetchDropDownData = async () => {
    try {
        const response = await httpClient.post<{ ModCategories: ModificationCategory[], ModReasons: ModificationCategory[] }>('/modification/initDropdowns');
        return response;
    } catch (error) {
        console.error('Error fetching modification dropdown data:', error);
        throw error;
    }
}

export const submitModificationRequest = async (payload: {
    RevisionDetails: {
        RevisionCategory: string;
        RevisionReason: string;
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
}) => {
    try {
        const response = await httpClient.post(`/IORevision/RequestRevision/`, payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error requesting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};