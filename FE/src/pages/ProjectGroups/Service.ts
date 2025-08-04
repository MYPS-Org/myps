import type { ProjectGroups, ProjectGroupList, ProjectGroupPagination } from "./Model.d";
import { httpClient, type ErrorResponse } from '../../services/httpClient';

export const fetchProjectGroup = async (data: ProjectGroupPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<ProjectGroupList>>('/api/project-groups', data, {
            preloaderMessage: 'Loading project groups...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching project groups:', error);
        throw error;
    }
};

export const fetchProjectGroupEnums = async () => {
    try {
        const response = await httpClient.post('/api/project-groups/enums');
        return response;
    } catch (error) {
        console.error('Error fetching project group enums:', error);
        throw error;
    }
};

