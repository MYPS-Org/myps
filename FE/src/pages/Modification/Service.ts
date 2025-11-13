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
    ProjectDetails: ProjectDetails;
    ComponentCosts: ComponentCost[];
    ComponentCostYear: ComponentCostYear[];
    MajorItemOfWorks: MajorItemOfWork[];
    MajorItemLocations: MajorItemLocations[];
    FundingProfile: FundingProfile[];
    RevisionReason: string;
    RevisionType: string;
    ApprovalDate: string;
    FileAttachments: string[];
}) => {
    try {
        const response = await httpClient.post(`/Project/UpdateProjectDetails/`, payload, {
            preloaderMessage: 'Updating entire project...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating entire project:', ErrorResponse);
        throw ErrorResponse;
    }
};