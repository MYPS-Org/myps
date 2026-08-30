

// #region Pagination Response
export interface InitialDataResponse {
    NumberOfUsers: number;
    NumberOfAPIPermissions: number;
    NumberOfRoutePermissions: number;
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
     CreatedDate: string | null;
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
    ControllerName?: string;
    ActionName?: string;
    ControllerDescription?: string;
}
//#endregion

//#region Users Models
export interface Users {
	Id: number;
	UserGroupIds: number[];
	UserGroupNames?: string[];
	ApplyFilter?: boolean;
	EmployeeId?: string;
	UserId: string;
	Name: string;
	Email?: string;
	RegCode?: string;
	RegName?: string;
	PlantillaOffice?: string;
	PlantillaOfficeName: string;
	IsActive: boolean;
}
export interface UserPagination extends PaginationParams {
    filters?: UserFilter;
    sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
    sortDirection?: 0 | 1;
}
export interface UserFilter {
    EmployeeId?: string;
    UserId?: string;
    Name?: string;
    Email?: string;
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
    CreatedDate: string | null;
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
    PermissionActionIds?: number[];
    PermissionViewIds?: number[];
}

export interface AddUserGroups {
	Id?: number; // Optional for create, required for update
	GroupName?: string;
    PermissionIds: number[]; // Dialog works with array of IDs
	Description?: string;
	ApplyFilter?: boolean;
}

export interface UpdateUserGroupPayload {
	Id: number;
	GroupName: string;
	Description?: string;
	ApplyFilter: boolean;
	PermissionActionIds: number[];
	PermissionViewIds: number[];
}

//#endregion

export interface Pis {
 EmployeeId?: string;
}

// Mirrors UserGroups.cs backend models
export interface UserGroupViewItem {
    Id: number;
    RouteName: string;
    RoutePath: string;
    IsGranted: boolean;
}
export interface UserGroupActionItem {
    Id: number;
    ActionName: string;
    IsGranted: boolean;
}
export interface UserGroupAPIPermission {
    ControllerName: string;
    Actions: UserGroupActionItem[];
    IsGranted: boolean;
}
export interface ModulePermission {
    ModuleName: string;
    APIPermissions: UserGroupAPIPermission[];
    ViewAccess: UserGroupViewItem[];
}

export interface vUserGroups{
    Id: number;
    GroupName: string;
    ApplyFilter: boolean;
    NumberOfUsers: number;
    Description?: string;
    CreatedBy: string;
    CreatedDate: string | null;
    ModulePermissions: ModulePermission[];
    // kept optional for locally-constructed fallback objects
    PermissionActionIds?: number[];
    PermissionViewIds?: number[];
}
export interface UserGroupDropdowns{
    AppModules: AppModuleDropdown[];
    PermissionControllers: PermissionControllers[];
    PermissionActions: PermissionActions[];
    PermissionViews: PermissionViews[];
}
export interface AppModuleDropdown {
    Id: number;
    ModuleName: string;
    Description?: string;
}
export interface PermissionControllers {
	Id: number;
	ModuleName?: string;
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
	RouteName?: string;
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
