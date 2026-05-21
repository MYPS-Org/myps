// Service functions for RBAC operations
import type { ShowAppModulesPagination, PermissionPagination, Permissions, AddPermission, PermissionGroup, Users, UserPagination, AddUserGroups, UpdateUserGroupPayload, UserGroupPagination, Pis, InitialDataResponse, UserGroupDropdowns, vUserGroups, PermissionViews, RoutePermissionPagination, AppModules } from './Model.d';
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
		const request = await httpClient.post<InitialDataResponse>('/UserManagement/InitUserManagement', null,{preloaderMessage: 'Loading initial data...'});
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
		const request = await httpClient.post<PaginationResponse<Users>>('/UserManagement/ShowUsers', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const addUser = async (data: Users) => {
	try {
		const request = await httpClient.post<Users>('/UserManagement/AddUser', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const editUser = async (data: Users) => {
	try {
		const request = await httpClient.post<Users>(`/UserManagement/UpdateUser`, data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const deleteUser = async (data: Users) => {
	try {
		const request = await httpClient.post('/UserManagement/DeleteUser', data );
		return request;
		
	} catch (error) {
		throw error;
	}
}
//#endregion

//#region  Permission API functions
export const fetchPermissions = async (data: PermissionPagination) => {
    try {
        const request = await httpClient.post<PaginationResponse<Permissions>>('/UserManagement/ShowPermissions', data);
        return request;
    } catch (error) {
        throw error;
    }
}

export const addPermission = async (data: AddPermission) => {
	try {
		const request = await httpClient.post<AddPermission>('/UserManagement/AddPermission', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const updatePermission = async (data: Permissions) => {
	try {
		const request = await httpClient.post<Permissions>('/UserManagement/UpdatePermission', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const fetchPermissionGroups = async () => {
    try {
        const request = await httpClient.post<PermissionGroup[]>('/UserManagement/ShowPermissionGroups');
        return request;
    } catch (error) {
        throw error;
    }
}

export const deletePermission = async (data: Permissions) => {
	try {
		const request = await httpClient.post('/UserManagement/DeletePermission', data);
		return request;
	} catch (error) {
		throw error;
	}
}
//#endregion

//#region  User Groups API functions


export const fetchUserGroupDropdowns = async() => {
    try {
        const request = await httpClient.post<UserGroupDropdowns>('/UserManagement/ShowUserGroupDropdowns');
        return request;
    } catch (error) {
        throw error;
    }
}
export const fetchUserGroups = async (data: UserGroupPagination) => {
    try {
        const request = await httpClient.post<PaginationResponse<vUserGroups>>('/UserManagement/ShowUserGroups', data);
        return request;
    } catch (error) {
        throw error;
    }
}

export const addUserGroup = async (data: AddUserGroups) => {
	try {
		const request = await httpClient.post('/UserManagement/AddUserGroup', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const editUserGroup = async (data: UpdateUserGroupPayload) => {
	try {
		const request = await httpClient.post('/UserManagement/UpdateUserGroup', data);
		return request;
	} catch (error) {
		throw error;
	}
}

export const deleteUserGroup = async (groupId: number) => {
    try {
        const request = await httpClient.post(`/UserManagement/DeleteUserGroup?id=${groupId}`);
        return request;
    } catch (error) {
        throw error;
    }
}
//#endregion

//#region  PIS API functions
export const getUserInfo = async (data: Users) => {
    try {
        const request = await httpClient.post<Users>('/PIS/GetUserInfo', data);
        return request;
    } catch (error: any) {
        throw error;
    }
}

export const fetchUserData = async (data: Pis) => {
    try {
        const request = await httpClient.post<Users>('/PIS/SearchUser', data);
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

export const getRoutePermissions = async (data: RoutePermissionPagination) => {
	try {
		const response = await httpClient.post<PaginationResponse<PermissionViews>>('/UserManagement/ShowViewPermissions', data);
		return response;
	} catch (error) {
		console.error('Error fetching route permissions:', error);
		throw error;
	}
}

export const callSyncPermissions = async () => {
	try {
		const response = await httpClient.post('/UserManagement/SyncAPIPermissions');
		return response;
	} catch (error) {
		console.error('Error syncing permissions:', error);
		throw error;
	}
}

export const callSyncViewPermissions = async (routes: { RouteName?: string; path: string }[]) => {
	try {
		const response = await httpClient.post('/UserManagement/SyncViewPermissions', { RoutesAvailable: routes });
		return response;
	} catch (error) {
		console.error('Error syncing view permissions:', error);
		throw error;
	}
}

export const getAppModules = async (data: ShowAppModulesPagination) => {
	try {
		const response = await httpClient.post<PaginationResponse<AppModules>>('/UserManagement/ShowAppModules', data);
		return response;
	} catch (error) {
		console.error('Error fetching app modules:', error);
		throw error;
	}
}

export const addAppModule = async (data: AppModules) => {
	try {
		const response = await httpClient.post<AppModules>('/UserManagement/AddAppModule', data);
		return response;
	} catch (error) {
		throw error;
	}
}

export const updateAppModule = async (data: AppModules) => {
	try {
		const response = await httpClient.post<AppModules>('/UserManagement/UpdateAppModule', data);
		return response;
	} catch (error) {
		throw error;
	}
}

export const deleteAppModule = async (data: AppModules) => {
	try {
		const response = await httpClient.post('/UserManagement/DeleteAppModule', data);
		return response;
	} catch (error) {
		throw error;
	}
}