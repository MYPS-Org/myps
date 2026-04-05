

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
	ControllerName: string;
	ActionName: string;
	ModuleFunctionDescription?: string | null;
}
export interface PermissionPagination extends PaginationParams {
    filters?: PermissionFilter;
    sortField?: string;
    sortDirection?: 0 | 1;
}
export interface PermissionFilter {
    Module?: string;
    ModuleFunction?: string;
    ModuleFunctionDescription?: string;
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

export interface UpdateUserGroupPayload {
	Id: number;
	GroupName: string;
	Description?: string;
	PermissionActionIds: number[];
	PermissionViewIds: number[];
}

//#endregion

export interface Pis {
 EmployeeId?: string;
}

export interface vUserGroups{
    Id: number;
    GroupName: string;
    NumberOfUsers: number;
    Description?: string;
    CreatedBy: string;
    CreatedDate: string;
    PermissionActionIds: number[]; // API returns comma-separated string of numeric IDs
    PermissionViewIds : number[]; // API returns comma-separated string of permission names
}
export interface UserGroupDropdowns{
    PermissionControllers: PermissionControllers[];
    PermissionActions: PermissionActions[];
    PermissionViews: PermissionViews[];
}
export interface PermissionControllers {
	Id: number;
	ControllerName: string;
	Description?: string;
}
export interface PermissionActions {
	Id: number;
	ControllerName: string;
	ActionName: string;
	Description?: string;
}
export interface PermissionViews {
	Id: number;
	RoutePath: string;
	Description?: string;
}
export interface RoutePermissionPagination extends PaginationParams {
    filters?: RoutePermissionFilter;
    sortField?: string;
    sortDirection?: 0 | 1;
}
export interface RoutePermissionFilter {
    RoutePath?: string;
    Description?: string;
}

export interface ShowAppModulesPagination extends PaginationParams {
    filters?: AppModuleFilter;
    sortField?: string;
    sortDirection?: 0 | 1;
}

export interface AppModuleFilter {
    ModuleName?: string;
}

export interface AppModules {
	Id: number;
	ModuleName: string;
	Description?: string;
	ControllerCount?: number;
	ViewCount?: number;
	Controllers?: string;
	Views?: string;
}