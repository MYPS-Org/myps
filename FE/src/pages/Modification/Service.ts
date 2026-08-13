import { httpClient } from "../../services/httpClient";
import type { ProjectDetails, ComponentCost, MajorItemOfWork, MajorItemLocations, FundingProfile, ComponentCostPerYear } from "../Project/Model.d";
import type { ApiMessageResult, ApiTransactionResult, EnumRevisionStatus, FileUpload, RevisionLists, RevisionPagination, RevisionProjectPayload } from "./Model";

interface RevisionDetailsRequest {
    CategoryId?: number | null;
    ReasonId: number;
    ApprovalDate: string;
    ApprovedDocument: FileUpload;
}

interface RequestRevisionPayload {
    RevisionDetails: RevisionDetailsRequest;
    ProjectDetails: ProjectDetails;
    ComponentCosts: ComponentCost[];
    ComponentCostPerYear: ComponentCostPerYear[];
    MajorItemOfWorks: MajorItemOfWork[];
    MajorItemLocations: MajorItemLocations[];
    FundingProfile: FundingProfile[];
}

export const submitModificationRequest = async (payload: RequestRevisionPayload) => {
    try {
        const response = await httpClient.post<ApiTransactionResult>('/Revision/RequestRevision', payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error requesting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const updateRevisionRequestStatus = async (
    transactionId: string,
    status: EnumRevisionStatus,
    ApprovedDocument?: FileUpload,
    ApprovalDate?: string,
    remarks?: string
) => {
    try {
        const payload = {
            TransactionId: transactionId,
            Status: status,
            Document: ApprovedDocument,
            ApprovalDate: ApprovalDate,
            Remarks: remarks
        };

        const response = await httpClient.post<ApiMessageResult>('/Revision/UpdateRevisionStatus', payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating revision status:', ErrorResponse);
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

export const fetchRevisionData = async (ProjectId: string, RevisionHeader: number, RevisionCategory: number, RevisionReason: number) => {
    try {
        const response = await httpClient.post<RevisionProjectPayload>('/Revision/ReviseProject', { ProjectId, RevisionHeader, RevisionCategory, RevisionReason });
        return response;
    } catch (error) {
        console.error('Error fetching revision data:', error);
        throw error;
    }
}

export const fetchModificationList = async (data: RevisionPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<RevisionLists>>('/Revision/RevisionRequests', data);
        return response;
    } catch (error) {
        console.error('Error fetching modification list:', error);
        throw error;
    }
};

export const fetchReviseProjectDetails = async (transactionId: string) => {
    try {
        const response = await httpClient.post<RevisionProjectPayload>('/Revision/ViewReviseProject', { TransactionId: transactionId });
        return response;
    } catch (error) {
        console.error('Error fetching revise project details:', error);
        throw error;
    }
}

export const ResubmitRevisionRequest = async (payload: RequestRevisionPayload & { TransactionId: string }) => {
    try {
        const response = await httpClient.post<ApiTransactionResult>('/Revision/ResubmitRevision', payload, {
            preloaderMessage: 'Requesting revision...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error resubmitting revision:', ErrorResponse);
        throw ErrorResponse;
    }
};