

// #region Pagination Response
export interface InitialDataResponse {
    NumberOfUsers: number;
    NumberOfPermissions: number;
    NumberOfGroups: number;
    Users: Users[];
}

//#region Permissions Models
export interface AddPermission {
    PermissionGroupId: number;
    ModuleFunction: string;
    Description: string;
}

export interface PermissionGroup {
     Id: number;
     Name: string;
     UpdatedBy: string;
     UpdatedDate: string;
     CreatedDate: string;
     CreatedBy: string;
}

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
    filters?: PermissionFilter;
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
    UserGroup?: string;
    IsActive?: boolean; // Use boolean for IsActive filter
}
//#endregion

//#region UserGroup Models
export interface UserGroups {
    Id: number;
    GroupName: string;
    NumberOfUsers: number;
    Description?: string;
    CreatedBy?: string;
    CreatedDate: string;
    PermissionIds: string; // API returns comma-separated string of numeric IDs
    PermissionNames: string; // API returns comma-separated string of permission names
}
export interface UserGroupPagination extends PaginationParams {
    filters?: UserGroupFilter;
    sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
    sortDirection?: 0 | 1;
}
export interface UserGroupFilter {
    GroupName?: string;
    PermissionNames?: string; // Use string for searching permission names
}

export interface AddUserGroups {
	Id?: number; // Optional for create, required for update
	GroupName?: string;
    PermissionIds: number[]; // Dialog works with array of IDs
	Description?: string;
}

//#endregion

export interface Pis {
 EmployeeId?: string;
}