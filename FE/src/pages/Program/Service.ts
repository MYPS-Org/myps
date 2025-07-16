// import type { PaginationParams, PaginationResponse } from '../../model/Pagination';
import { httpClient, type ErrorResponse } from '../../services/httpClient';


import type { ProgramModel, ProgramEnums, ProgramPagination, ProgramFilter } from './Model';

export const fetchProgramEnums = async () => {
    try {
        const response = await httpClient.post< { Statuses: ProgramEnums[]; Stages: ProgramEnums[]; Types: ProgramEnums[]; Groups: ProgramEnums[] } >(
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

export const fetchProgram = async () => {
    try {
        const response = await httpClient.post<ProgramModel[]>('/Program', null, {
            preloaderMessage: 'Loading program...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching program:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const fetchProgramById = async (programId: number) => {
    try {
        const request = await httpClient.post<ProgramModel>(`/Program/${programId}`, null, {
            preloaderMessage: 'Loading program details...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error fetching program details:', ErrorResponse);
        throw ErrorResponse;
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

export const editProgram = async (program: ProgramModel) => {
    try {
        const request = await httpClient.post<ProgramModel>('/Program/EditProgram', program, {
            preloaderMessage: 'Editing program...'
        });
        return request;
    } catch (ErrorResponse) {
        console.error('Error editing program:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const deleteProgram = async (program: ProgramModel) => {
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
