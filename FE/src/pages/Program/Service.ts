// Service for Program Management
import type { Programs, ProgramPagination } from './Model';
import type { PaginationResponse } from '../../types/Pagination';
import { httpClient, type ErrorResponse } from '../../services/httpClient';


export const getPrograms = async () => {
    try {
        const request = await httpClient.post<PaginationResponse<Programs>>('/api/ShowPrograms');
        return request;
    } catch (error) {
        if (error) {
            console.error('Service: Error in getPrograms:');
            throw error;
        } else {
            console.error('Service: Unexpected error in getPrograms:', error);
            throw new Error('An unexpected error occurred while fetching programs.');
        }
    }
}