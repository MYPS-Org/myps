// Service functions for RBAC operations
import type { RawUserGroupData, ConsolidatedUserGroup, PermissionPagination, Permissions, Users, UserPagination, UserGroups, UserGroupPagination } from './Model.d';
import type { PaginationResponse } from '../../types/Pagination.d';
import { httpClient } from '../../services/httpClient';

export const consolidateUserGroups = (rawData: RawUserGroupData[]): ConsolidatedUserGroup[] => {
	const groupMap = new Map<string, ConsolidatedUserGroup>();

	rawData.forEach(item => {
		const groupName = item.GroupName;
		
		if (groupMap.has(groupName)) {
			// Group already exists, add permission to existing group
			const existingGroup = groupMap.get(groupName)!;
			
			// Add permission if it doesn't already exist
			if (!existingGroup.PermissionName.includes(item.PermissionName)) {
				existingGroup.PermissionName.push(item.PermissionName);
			}
			
			// Update member count if provided
			if (item.MemberCount && item.MemberCount > existingGroup.MemberCount) {
				existingGroup.MemberCount = item.MemberCount;
			}
		} else {
			// Create new group entry
			groupMap.set(groupName, {
				Id: item.Id,
				GroupName: item.GroupName,
				Description: item.Description,
				PermissionName: [item.PermissionName], // Start with array containing first permission
				Module: item.Module || '',
				MemberCount: item.MemberCount || 0,
				CreatedDate: item.CreatedDate || new Date().toISOString()
			});
		}
	});

	return Array.from(groupMap.values());
};

// Helper function to format permissions as CSV string
export const formatPermissionsAsCSV = (permissions: string[]): string => {
	return permissions.join(', ');
};

// Helper function to get permission count
export const getPermissionCount = (permissions: string[]): number => {
	return permissions.length;
};

// Helper function to validate user group data
export const validateUserGroupData = (groupData: Partial<ConsolidatedUserGroup>): boolean => {
	return !!(groupData.GroupName && groupData.Description);
};

// Helper function to generate unique group ID
export const generateGroupId = (existingGroups: ConsolidatedUserGroup[]): number => {
	const maxId = existingGroups.reduce((max, group) => Math.max(max, group.Id), 0);
	return maxId + 1;
};

//#region  Permission API functions
export const fetchPermissions = async (data: PermissionPagination) => {
    try {
        console.log('Service: Making API call to /UserProfile/ShowPermissions with data:', data);
        const request = await httpClient.post<PaginationResponse<Permissions>>("/UserProfile/ShowPermissions", data);
        console.log('Service: API response received:', request);
        return request;
    } catch (error) {
        console.error('Service: Error in fetchPermissions:', error);
        // Re-throw the error so the calling component can handle it
        throw error;
    }
}
//#endregion
//#region  Permission API functions
export const fetchUsers = async (data: UserPagination) => {
    try {
        console.log('Service: Making API call to /UserProfile/ShowPermissions with data:', data);
        const request = await httpClient.post<PaginationResponse<Users>>("/UserProfile/ShowUsers", data);
        console.log('Service: API response received:', request);
        return request;
    } catch (error) {
        console.error('Service: Error in fetchPermissions:', error);
        // Re-throw the error so the calling component can handle it
        throw error;
    }
}
//#endregion

//#region  Permission API functions
export const fetchUserGroups = async (data: UserGroupPagination) => {
    try {
        console.log('Service: Making API call to /UserProfile/ShowPermissions with data:', data);
        const request = await httpClient.post<PaginationResponse<UserGroups>>("/UserProfile/ShowUserGroups", data);
        console.log('Service: API response received:', request);
        return request;
    } catch (error) {
        console.error('Service: Error in fetchUserGroups:', error);
        // Re-throw the error so the calling component can handle it
        throw error;
    }
}
//#endregion