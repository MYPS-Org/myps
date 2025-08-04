import type { ProjectGroupPagination, AddProjectGroupModel, ProjectGroupDetails, ProjectGroupsDropDowns } from "./Model.d";
import { httpClient, type ErrorResponse } from '../../services/httpClient';

export const fetchProjectGroup = async (data: ProjectGroupPagination) => {
    try {
        const response = await httpClient.post<ProjectGroupsDropDowns>('/api/projectgroup/showprojectgroups', data, {
            preloaderMessage: 'Loading project groups...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching project groups:', error);
        throw error;
    }
};

export const addProjectGroup = async (data: AddProjectGroupModel) => {
    try {
        const response = await httpClient.post<AddProjectGroupModel>('/api/project-groups/add', data, {
            preloaderMessage: 'Adding project group...'
        });
        return response;
    } catch (error) {
        console.error('Error adding project group:', error);
        throw error;
    }
};

export const fetchProjectGroupByName = async (name: string) => {
    try {
        const response = await httpClient.post<ProjectGroupDetails>(`/api/project-groups/${name}`, {
            preloaderMessage: 'Loading project group details...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching project group by name:', error);
        throw error;
    }
}

export const deleteProjectGroup = async (groupId: string) => {
    try {
        const response = await httpClient.post<ErrorResponse>(`/api/project-groups/${groupId}`, {
            preloaderMessage: 'Deleting project group...'
        });
        return response;
    } catch (error) {
        console.error('Error deleting project group:', error);
        throw error;
    }
}

