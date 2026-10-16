// import type { PaginationParams, PaginationResponse } from '../../model/Pagination';
import { httpClient } from '../../services/httpClient';
import type { ImportProjectDTO } from '../Project/Model';

import type {TableEnum, ProgramModel, ProgramEnums, ProgramFilter, ProgramList, ProgramDetailsEnums, ProgramDetails, ProgramLatest, StageList, AIPReportParams, AIPReportDropdowns, AIPReportType, ShowProjectsInProgramRequest, ProgramProjectsPaginationResponse, BatchActionResponse, BatchDeletePreview, ImportJobStatus } from './Model';

export const fetchProgramEnums = async () => {
    try {
        const response = await httpClient.post< { Stages: TableEnum[]; Types: TableEnum[]; Groups: ProgramEnums[], DataSecurity: ProgramEnums[] } >(
            '/Program/InitAddProgram',
            null,
            {
                preloaderMessage: 'Loading programs enums ...'
            }
        );
        return response;
    } catch (error) {
        console.error('Error fetching programs enums:', error);
        throw error;
    }
};

export const fetchProgram = async (data: PaginatedRequest<ProgramFilter>) => {
    try {
        const response = await httpClient.post<PaginationResponse<ProgramLatest>>('/program/showprogram', data, {
            preloaderMessage: 'Loading program...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching program:', error);
        throw error;
    }
};

/** The Program list's call: also asks for each program's delete eligibility (CanDelete /
 *  DeleteBlockedReason), which costs an extra query, so other callers use fetchProgram. */
export const fetchProgramList = (data: PaginatedRequest<ProgramFilter>) =>
    fetchProgram({ ...data, IncludeDeleteEligibility: true } as PaginatedRequest<ProgramFilter>);

export const fetchProgramById = async (programId: string, StageName: string) => {
    try {
        const request = await httpClient.post< ProgramDetailsEnums >(`/Program/ProgramDetails`, { ProgramId: programId, StageName: StageName }, {
            preloaderMessage: 'Loading program details...'
        });
        return request;
    } catch (error) {
        console.error('Error fetching program details:', error)
        throw error;
    }
};

export const ShowProjectsInProgram = async (data: ShowProjectsInProgramRequest) => {
    try {
        const request = await httpClient.post<ProgramProjectsPaginationResponse>(`/Program/ShowProjectsInProgram`, data, {
            preloaderMessage: 'Loading program details...'
        });
        return request;
    } catch (error) {
        console.error('Error fetching program details:', error)
        throw error;
    }
};

export const addProgram = async (program: ProgramModel) => {
    try {
        const request = await httpClient.post<ProgramModel>('/Program/AddProgram', program, {
            preloaderMessage: 'Creating program...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error creating program:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const editProgram = async (program: ProgramDetails) => {
    try {
        const request = await httpClient.post<ProgramDetails>('/Program/UpdateProgramDetails', program, {
            preloaderMessage: 'Editing program...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error editing program:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const deleteProgram = async (program: ProgramList) => {
    try {
        const request = await httpClient.post(`/Program/DeleteProgram/`, program, {
            preloaderMessage: 'Deleting program...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error deleting program:', ErrorResponse);
        throw ErrorResponse;
    }
};

// ProgramPK is sent alongside ProgramId for forward-compat with a planned backend change to
// UpdateProgramStageDTO — the current DTO has no ProgramPK property, so the API ignores it
// until that backend work lands.
export const nextStage = async (data: { ProgramId: string; ProgramPK: string; Stage: number, Name: string }) => {
    try {
        const request = await httpClient.post<ProgramDetails>('/Program/updateProgramStage', data, {
            preloaderMessage: 'Proceeding to next stage...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error proceeding to next stage:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const fetchStagesByProgramId = async (programId: string) => {
    try {
        const request = await httpClient.post<StageList>(`/Program/ShowProgramStages`, { ProgramId: programId }, {
            preloaderMessage: 'Loading program stages...'
        });
        return request;
    } catch (error) {
        console.error('Error fetching program stages:', error);
        throw error;
    }
}

export const dowloadTemplate = async () => {
    try {
        const response = await httpClient.post<{link: string}>('/Program/DownloadProgramTemplate', null, {});
        return response;
    } catch (error) {
        console.error('Error downloading template:', error);
        throw error;
    }
}

export const publishToPCMA = async (programId: string) => {
    try {
        const response = await httpClient.post('/PCMA/PublishProgram', { ProgramId: programId }, {});
        return response;
    } catch (error) {
        console.error('Error publishing program to PCMA:', error);
        throw error;
    }
}

export const downloadAIPReport = async (params: AIPReportParams) => {
    const endpoints: Record<AIPReportType, string> = {
        AIP: '/Reporting/RequestReportAIP',
        AIP02: '/Reporting/RequestReportAIP02',
        RBP: '/Reporting/RequestReportRBP',
        RBPComponents: '/Reporting/RequestReportRBPComponents',
        RBPTier: '/Reporting/RequestReportRBPTier',
        RDIP: '/Reporting/RequestReportRDIP',
    };

    const endpoint = endpoints[params.ReportType];
    const isAIPType = params.ReportType === 'AIP' || params.ReportType === 'AIP02';

    const payload = isAIPType
        ? {
            ProgramId: params.ProgramId,
            StageName: params.StageName?.trim() || undefined,
            CategoryName: params.CategoryName?.trim() || undefined,
            RegionName: params.RegionName?.trim() || undefined,
            OperatingUnitName: params.OperatingUnitName?.trim() || undefined,
            DistrictEngineeringOffice: params.DistrictEngineeringOffice?.trim() || undefined,
            ImplementingOfficeName: params.ImplementingOfficeName?.trim() || undefined,
            LegislativeDistrictName: params.LegislativeDistrictName?.trim() || undefined,
        }
        : {
            ProgramId: params.ProgramId,
            RegionName: params.RegionName?.trim() || undefined,
        };

    try {
        const response = await httpClient.post<Blob>(endpoint, payload, {
            preloaderMessage: `Downloading ${params.ReportType} report...`,
            responseType: 'blob'
        });

        const blob = response.Data as Blob;
        const filename = `${params.ReportType}_Report_${params.ProgramId}_${new Date().getTime()}.pdf`;

        return { blob, filename };
    } catch (error) {
        console.error(`Error downloading ${params.ReportType} report:`, error);
        throw error;
    }
};

/** Read-only: what Batch Delete would do with these ids (permanent / at this stage / refused / not found). */
export const previewBatchDelete = async (data: { ProgramId: string; ProjectIds: string }) => {
    try {
        const request = await httpClient.post<BatchDeletePreview>('/Program/PreviewBatchDelete', data, {
            preloaderMessage: 'Checking projects...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error previewing batch delete:', ErrorResponse);
        throw ErrorResponse;
    }
}
export const batchDeleteProjects = async (data: { ProgramId: string; ProjectIds: string  }) => {
    try {
        const request = await httpClient.post<BatchActionResponse>('/Program/BatchDelete', data, {
            preloaderMessage: 'Deleting projects...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error deleting projects:', ErrorResponse);
        throw ErrorResponse;
    }
}
export const batchAllowPublishing = async (data: { ProgramId: string; ProjectIds: string  }) => {
    try {
        const request = await httpClient.post<BatchActionResponse>('/Program/BatchAllowPublish', data, {
            preloaderMessage: 'Allowing publishing of projects...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error allowing publishing of projects:', ErrorResponse);
        throw ErrorResponse;
    }
}
export const batchRestrictPublishing = async (data: { ProgramId: string; ProjectIds: string }) => {
    try {
        const request = await httpClient.post<BatchActionResponse>('/Program/BatchRestrictPublish', data, {
            preloaderMessage: 'Restricting publishing of projects...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error restricting publishing of projects:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const batchRestoreProjects = async (data: { ProgramId: string; ProjectIds: string }) => {
    try {
        const request = await httpClient.post('/Program/BatchAddExistingProject', data, {
            preloaderMessage: 'Restoring projects...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error restoring projects:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const importProjects = async (payload: ImportProjectDTO) => {
    try {
        const response = await httpClient.post(`/Importing/ImportProject/`, payload, {
            preloaderMessage: 'Importing projects...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error importing projects:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const startImportProjectJob = async (data: { ProgramId: string; StageName: string; File: File }) => {
    try {
        const formData = new FormData();
        formData.append('ProgramId', data.ProgramId);
        formData.append('StageName', data.StageName);
        formData.append('File', data.File);

        const response = await httpClient.post<{ JobId: string; HangfireJobId: string; Message: string; Title: string }>('/Importing/ImportProject', formData, {
            // Force off the instance's default JSON Content-Type so axios doesn't
            // JSON.stringify the FormData — the browser fills in the multipart
            // boundary itself once this header is out of the way.
            headers: { 'Content-Type': 'multipart/form-data' },
            preloaderMessage: 'Uploading and queuing import...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error starting import job:', ErrorResponse);
        throw ErrorResponse;
    }
};

// Same job-queue contract as startImportProjectJob, but hits the Update endpoint —
// the backend soft-deletes the existing project set for this Program+Stage before
// re-inserting the file's contents (see ImportProjectJobService.ProcessUpdate).
export const startUpdateProjectJob = async (data: { ProgramId: string; StageName: string; File: File }) => {
    try {
        const formData = new FormData();
        formData.append('ProgramId', data.ProgramId);
        formData.append('StageName', data.StageName);
        formData.append('File', data.File);

        const response = await httpClient.post<{ JobId: string; HangfireJobId: string; Message: string; Title: string }>('/Importing/UpdateProject', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            preloaderMessage: 'Uploading and queuing update...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error starting update job:', ErrorResponse);
        throw ErrorResponse;
    }
};

// Blank starter workbook, built live from the same generator as the error report
// (headers, DB-sourced dropdowns, and macros always match the current schema).
export const downloadImportTemplate = async () => {
    try {
        const response = await httpClient.get<Blob>('/Importing/DownloadTemplate', undefined, {
            preloaderMessage: 'Downloading template...',
            responseType: 'blob'
        });
        const blob = response.Data as Blob;
        return { blob, filename: 'ImportProjectTemplate.xlsm' };
    } catch (ErrorResponse) {
        console.error('Error downloading import template:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const getImportJobStatus = async (jobId: string) => {
    try {
        const response = await httpClient.get<ImportJobStatus>('/Importing/GetImportStatus', { jobId }, {
            silent: true
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching import job status:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const fetchAIPReportDropdownData = async (): Promise<AIPReportDropdowns> => {
    try {
        const response = await httpClient.post<AIPReportDropdowns>('/Reporting/GetAIPReportDropdowns', null, {
            preloaderMessage: 'Loading AIP report dropdown data...'
        });
        return response.Data;
    } catch (ErrorResponse) {
        console.error('Error fetching AIP report dropdown data:', ErrorResponse);
        throw ErrorResponse;
    }
};

// Same job-queue contract as startImportProjectJob/startUpdateProjectJob — the backend now
// builds the export workbook as a Hangfire background job (ImportProjectJobService.ProcessExport)
// instead of streaming it back synchronously, so this only queues the job and returns its JobId.
// The workbook is picked up later via GetImportStatus/DownloadImportFile, same as Import/Update.
export const startExportProjectsJob = async (data: { ProgramId: string; StageName: string }) => {
    try {
        const response = await httpClient.post<{ JobId: string; HangfireJobId: string; Message: string; Title: string }>('/Importing/ExportProjects', data, {
            preloaderMessage: 'Queuing export...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error starting export job:', ErrorResponse);
        throw ErrorResponse;
    }
};