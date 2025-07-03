import type { PaginationParams } from '../../types/Pagination';

//#region Permissions Models
export interface Permissions {
	Id: number;
	PermissionGroupId: number;
	PermissionGroupName?: string;
	ModuleFunction: string;
	Description: string;
	CreatedBy: string;
	CreatedDate: string;
}
export interface PermissionPagination extends PaginationParams {
    Filters?: PermissionFilter;
    sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
    sortDirection?: 0 | 1;
}
export interface PermissionFilter {
    PermissionGroupName?: string;
    ModuleFunction?: string;
    Description?: string;
}
//#endregion

//#region Users Models
export interface Users {
	Id: number;
	UserGroups?: string;
	EmployeeId?: string;
	UserId: string;
	Name: string;
	Email?: string;
	RegCode: string;
	PlantillaOffice?: string;
	IsActive: boolean;
}
export interface UserPagination extends PaginationParams {
    filters?: UserFilter;
    sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
    sortDirection?: 0 | 1;
}
export interface UserFilter {
    Name?: string;
}
//#endregion

//#region UserGroup Models
export interface UserGroups {
	Id: number;
	GroupName?: string;
	NumberOfUsers?: number;
	Description?: string;
	CreatedBy?: string;
	CreatedDate?: string;
}
export interface UserGroupPagination extends PaginationParams {
    filters?: UserGroupFilter;
    sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
    sortDirection?: 0 | 1;
}
export interface UserGroupFilter {
    Name?: string;
}
//#endregion

export interface RawUserGroupData {
  Id: number;
  GroupName: string;
  Description: string;
  PermissionName: string;
  Module?: string;
  MemberCount?: number;
  CreatedDate?: string;
}

export interface ConsolidatedUserGroup {
  Id: number;
  GroupName: string;
  Description: string;
  PermissionName: string[]; // Array of all permissions
  Module?: string;
  MemberCount: number;
  CreatedDate: string;
}

export interface Pis {
 EmployeeId?: string;
}