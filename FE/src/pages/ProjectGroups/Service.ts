import type { ProjectGroupFilter, AddProjectGroupModel, ProjectGroupDetailsModel, ProjectGroupsDropDowns, UserGroups, updateProjectGroupModel, AddProjectsToGroupResult, RemoveProjectsFromGroupResult } from "./Model.d";
import { httpClient, type ErrorResponse } from '../../services/httpClient';

export const fetchProjectGroup = async (data: PaginatedRequest<ProjectGroupFilter>) => {
    try {
        const response = await httpClient.post<ProjectGroupsDropDowns>('/projectgroup/showprojectgroups', data, {
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
        const response = await httpClient.post<AddProjectGroupModel>('/projectgroup/addprojectgroup', data, {
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
        const response = await httpClient.post<ProjectGroupDetailsModel & UserGroups>(`/projectgroup/projectgroupdetails`,{GroupId: name}, {
            preloaderMessage: 'Loading project group details...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching project group by name:', error);
        throw error;
    }
}

export const updateProjectGroup = async (data: Pick<updateProjectGroupModel, 'GroupDetails'>) => {
    try {
        const response = await httpClient.post<ProjectGroupDetailsModel>(`/projectgroup/updateprojectgroupdetails`, data, {
            preloaderMessage: 'Updating project group...'
        });
        return response;
    } catch (error) {
        console.error('Error updating project group:', error);
        throw error;
    }
};

export const deleteProjectGroup = async (groupId: string) => {
    try {
        const response = await httpClient.post<ErrorResponse>(`/projectgroup/deleteprojectgroup`, { GroupId: groupId }, {
            preloaderMessage: 'Deleting project group...'
        });
        return response;
    } catch (error) {
        console.error('Error deleting project group:', error);
        throw error;
    }
}

export const addProjectToGroup = async (data: { ProjectId: string[], GroupId: string }) => {
    try {
        const response = await httpClient.post<AddProjectsToGroupResult>(`/projectgroup/addproject`, data, {
            preloaderMessage: 'Adding projects to group...'
        });
        return response;
    } catch (error) {
        console.error('Error adding projects to group:', error);
        throw error;
    }
};

export const removeProjectsFromGroup = async (data: { GroupId: string, ProjectIds: string[] }) => {
    try {
        const response = await httpClient.post<RemoveProjectsFromGroupResult>(`/projectgroup/deleteproject`, data, {
            preloaderMessage: 'Removing projects from group...'
        });
        return response;
    } catch (error) {
        console.error('Error removing projects from group:', error);
        throw error;
    }
}
