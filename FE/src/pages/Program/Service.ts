// import type { PaginationParams, PaginationResponse } from '../../model/Pagination';
import { httpClient } from '../../services/httpClient';


import type { ProgramModel, ProgramEnums, ProgramPagination, ProgramList, ProgramDetailsEnums, ProgramDetails, ParentProgram, StageList } from './Model';

export const fetchProgramEnums = async () => {
    try {
        const response = await httpClient.post< { Stages: ProgramEnums[]; Types: ProgramEnums[]; Groups: ProgramEnums[] } >(
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

export const fetchProgram = async (data: ProgramPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<ParentProgram>>('/program/showprogram', data, {
            preloaderMessage: 'Loading program...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching program:', error);
        throw error;
    }
};

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

export const nextStage = async (data: { ProgramId: string; Stage: number }) => {
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
