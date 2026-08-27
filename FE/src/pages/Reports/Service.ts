import { httpClient } from '../../services/httpClient';
import type {
    ReportOptions,
    FilterProgramsQuery,
    FilterProgramItem,
    GenerateReportRequest,
    GenerateReportResponse,
    ReportStatusEvent,
    DeoOption,
    ImplementingOfficeOption,
} from './Model';

export const fetchReportOptions = async () => {
    try {
        const response = await httpClient.get<ReportOptions>('/reports/options', undefined, {
            preloaderMessage: 'Loading report options...',
        });
        return response.Data;
    } catch (error) {
        console.error('Error fetching report options:', error);
        throw error;
    }
};

export const fetchFilterPrograms = async (query: FilterProgramsQuery) => {
    try {
        const response = await httpClient.get<FilterProgramItem[]>(
            '/reports/filter-programs',
            { YearStart: String(query.YearStart), ProgramStage: query.ProgramStage },
            { preloaderMessage: 'Loading programs...' }
        );
        return response.Data;
    } catch (error) {
        console.error('Error fetching filtered programs:', error);
        throw error;
    }
};

export const queueReportGeneration = async (reportName: string, request: GenerateReportRequest) => {
    try {
        const response = await httpClient.post<GenerateReportResponse>(`/reports/${reportName}`, request, {
            preloaderMessage: 'Queueing report generation...',
        });
        return response.Data;
    } catch (error) {
        console.error('Error queueing report generation:', error);
        throw error;
    }
};

// `regionCode` here is the region's ParticipantId, not its business Code —
// the query param name stays `regionCode` to match the backend, but the
// caller passes the ParticipantId as its value (see Reports.tsx).
export const fetchDeos = async (regionCode: string) => {
    try {
        const response = await httpClient.get<DeoOption[]>(
            '/reports/deos',
            regionCode ? { regionCode } : undefined,
            { preloaderMessage: 'Loading DEOs...' }
        );
        return response.Data;
    } catch (error) {
        console.error('Error fetching DEOs:', error);
        throw error;
    }
};

export const fetchImplementingOffices = async (regionCode: string, deoCode: string) => {
    try {
        const response = await httpClient.get<ImplementingOfficeOption[]>(
            '/reports/implementing-offices',
            {
                ...(regionCode ? { regionCode } : {}),
                ...(deoCode ? { deoCode } : {}),
            },
            { preloaderMessage: 'Loading implementing offices...' }
        );
        return response.Data;
    } catch (error) {
        console.error('Error fetching implementing offices:', error);
        throw error;
    }
};

export const fetchReportJobStatus = async (jobId: string) => {
    try {
        const response = await httpClient.get<ReportStatusEvent>(`/reports/status/${jobId}`, undefined, {
            silent: true,
        });
        return response.Data;
    } catch (error) {
        console.error('Error fetching report job status:', error);
        throw error;
    }
};

export const fetchReportFile = async (fileName: string) => {
    try {
        const response = await httpClient.get<Blob>(
            '/reports/download',
            { fileName },
            { preloaderMessage: 'Downloading report...', responseType: 'blob' }
        );
        return { blob: response.Data, filename: fileName };
    } catch (error) {
        console.error('Error downloading report file:', error);
        throw error;
    }
};
