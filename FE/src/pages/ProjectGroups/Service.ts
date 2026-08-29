import type { ProjectGroupFilter, AddProjectGroupModel, ProjectGroupDetailsModel, ProjectGroupsDropDowns, UserGroups, updateProjectGroupModel, ProjectList } from "./Model.d";
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

export const updateProjectGroup = async (data: updateProjectGroupModel) => {
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

export const fetchProjectById = async (projectId: string) => {
    try {
        const response = await httpClient.post<{Project: ProjectList}>(`/projectgroup/searchproject`, { ProjectId: projectId }, {
            preloaderMessage: 'Loading project details...'
        });
        return response;
    } catch (error) {
        console.error('Error fetching project by ID:', error);
        throw error;
    }
}

export const addProjectToGroup = async (data: { ProjectId: string[], GroupId: string }) => {
    try {
        const response = await httpClient.post<ErrorResponse>(`/projectgroup/addproject`, data, {
            preloaderMessage: 'Adding project to group...'
        });
        return response;
    } catch (error) {
        console.error('Error adding project to group:', error);
        throw error;
    }
};

export const deleteProject = async (projectId: string) => {
    try {
        const response = await httpClient.post<ErrorResponse>(`/projectgroup/deleteproject`, { ProjectId: projectId }, {
            preloaderMessage: 'Deleting project...'
        });
        return response;
    } catch (error) {
        console.error('Error deleting project:', error);
        throw error;
    }
}
