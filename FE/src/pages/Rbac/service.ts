// Service functions for RBAC operations
import type { PermissionPagination, Permissions, Users, UserPagination, UserGroups, UserGroupPagination, Pis } from './Model.d';
import type { PaginationResponse } from '../../types/Pagination.d';
import { httpClient, type ErrorResponse } from '../../services/httpClient';
// import type { ErrorResponse } from '';

// Helper function to format permissions as CSV string
export const formatPermissionsAsCSV = (permissions: string[]): string => {
	return permissions.join(', ');
};

// Helper function to get permission count
export const getPermissionCount = (permissions: string[]): number => {
	return permissions.length;
};

//#region  Initial API Request
export const fetchInitialData = async () => {
	try {
		const request = await httpClient.post<PaginationResponse<Permissions>>('/UserProfile/InitUserManagement', null,{preloaderMessage: 'Loading initial data...'});
		return request;
	} catch (error) {
		console.error('Service: Error in fetchInitialData:', error);
		throw error;
	}
}
//#endregion

//#region  Users API functions
export const fetchUsers = async (data: UserPagination) => {
	try {
		const request = await httpClient.post<PaginationResponse<Users>>('/UserProfile/ShowUsers', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const editUser = async (data: Users) => {
	try {
		const request = await httpClient.post<Users>(`/UserProfile/UpdateUser`, data);
		return request;
	} catch (error) {
		throw error;
	}
}
//#endregion

//#region  Permission API functions
export const fetchPermissions = async (data: PermissionPagination) => {
    try {
        const request = await httpClient.post<PaginationResponse<Permissions>>('/UserProfile/ShowPermissions', data);
        return request;
    } catch (error) {
        throw error;
    }
}
//#endregion

//#region  User Groups API functions
export const fetchUserGroups = async (data: UserGroupPagination) => {
    try {
        const request = await httpClient.post<PaginationResponse<UserGroups>>('/UserProfile/ShowUserGroups', data);
        return request;
    } catch (error) {
        throw error;
    }
}
//#endregion

//#region  PIS API functions
export const fetchUserData = async (data: Pis) => {
    try {
        const request = await httpClient.post<Users>('/MockUps/SearchUser', data);
        return request;
	} catch (error : any) {
		const errorResponse: ErrorResponse = {
			Message: error.response.Message,
			Status: error.response.Status,
			Title: error.response.Title,
		};
		throw errorResponse;
	}
}
//#endregion
