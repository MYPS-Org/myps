import { httpClient } from "../../services/httpClient";
import type { ProjectDetails, ComponentCost, MajorItemOfWork, MajorItemLocations, FundingProfile, ComponentCostPerYear } from "../Project/Model.d";
import type { RevisionLists, RevisionPagination, RevisionProjectPayload } from "./Model";

// export const fetchRevDropdownData = async () => {
//     try {
//         const response = await httpClient.post<{ RevisionTypes: OptionRevisionHeader[], Categories: OptionRevisionCategory[], Reasons: OptionRevisionReasons[] }>('/Revision/RevisionCategories');
//         return response;
//     } catch (error) {
//         console.error('Error fetching modification dropdown data:', error);
//         throw error;
//     }
// }

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
        ComponentCostPerYear: ComponentCostPerYear[];
        MajorItemOfWorks: MajorItemOfWork[];
        MajorItemLocations: MajorItemLocations[];
        FundingProfile: FundingProfile[];
    },
    // userRole?: string
) => {
    try {
        // Determine endpoint based on user role
        // IO = Implementing Office, RO = Regional Office
        // const isIO = userRole?.toLowerCase().includes('implementing') || userRole?.toLowerCase().includes('io');
        // const endpoint = isIO ? '/IORevision/RequestRevision/' : '/RORevision/RequestRevision/';
        
        // const response = await httpClient.post(endpoint, payload, {
        //     preloaderMessage: 'Requesting revision...'
        // });
        const response = await httpClient.post<{TransactionId: string}>(`Revision/RequestRevision`, payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error requesting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const updateRevisionRequestStatus = async (transactionId: string, status: number, ApprovedDocument?: any, ApprovalDate?: string, remarks?: string) => {
    try {
        const payload = {
            TransactionId: transactionId,
            Status: status,
            Document: ApprovedDocument,
            ApprovalDate: ApprovalDate,
            Remarks: remarks
        };
        
        console.log('=== Payload being sent ===');
        console.log(JSON.stringify(payload, null, 2));
        
        const response = await httpClient.post(`/Revision/UpdateRevisionStatus/`, payload, {
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

export const fetchRevisionData = async ( ProjectId: string, RevisionHeader: number, RevisionCategory: number, RevisionReason: number ) => {
    try {
        const response = await httpClient.post(`/Revision/ReviseProject/`, { ProjectId, RevisionHeader, RevisionCategory, RevisionReason });
        return response;
    } catch (error) {
        console.error('Rine', error);
        throw error;
    }
}

export const fetchModificationList = async (data: RevisionPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<RevisionLists>>(`/Revision/RevisionRequests/`, data);
        return response;
    } catch (error) {
        console.error('Error fetching modification list:', error);
        throw error;
    }
};

export const fetchReviseProjectDetails = async (transactionId: string) => {
    try {
        const response = await httpClient.post<RevisionProjectPayload>(`/Revision/ViewReviseProject/`, { TransactionId: transactionId });
        return response;
    } catch (error) {
        console.error('Error fetching revise project details:', error);
        throw error;
    }
}

export const ResubmitRevisionRequest = async (
    payload: {
        TransactionId: string;
        ProjectStatus: {
            ConstructionStatus: string;
            PackageStatus: string;
        },
        ProjectDetails: ProjectDetails;
        ComponentCosts: ComponentCost[];
        ComponentCostPerYear: ComponentCostPerYear[];
        MajorItemOfWorks: MajorItemOfWork[];
        MajorItemLocations: MajorItemLocations[];
        FundingProfile: FundingProfile[];
    },
    // userRole?: string
) => {
    try {
        const response = await httpClient.post<{TransactionId: string}>(`Revision/ResubmitRevision`, payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error requesting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};