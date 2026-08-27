export interface ProjectGroups {
	Id: number;
	GroupId: string;
	Name: string;
	Description?: string;
	UserGroup: number;
	UserGroupName?: string;
	NumberOfProjects?: number;
	CreatedBy?: string;
	CreatedDate?: string;
}

export interface ProjectGroupFilter {
	Name?: string;
	UserGroupName?: string;
	ProjectId?: string;
}

export interface ProjectGroupPagination extends PaginationParams {
    filters?: ProjectGroupFilter;
    sortField?: string;
    sortDirection?: 0 | 1;
}

export interface AddProjectGroupModel {
    NewGroupId?: string;
    Name: string;
    Description: string;
    UserGroup: number;
}

export interface ProjectGroupDetailsModel {
    GroupDetails: ProjectGroups
    Projects: ProjectList[]
    UserGroups: UserGroups[]
}

export interface updateProjectGroupModel {
    GroupDetails: ProjectGroups
    Projects: ProjectList[]
}

export interface ProjectList {
    Id?: number;
	ProgramId?: string;
	ProgramName?: string;
	ProjectId: string;
	RevisionNumber?: number;
	Description?: string;
	Category?: number;
	CategoryName?: string;
	Thrust?: number;
	Origin?: number;
	City?: number;
	LegislativeDistrict?: number;
	OperatingUnit?: string;
	ImplementingOffice?: string;
	DEO?: string;
	Region?: string;
	Agency?: number;
	ProjectCode?: string;
	ImplementationMode?: number;
	EmergencyMode?: boolean;
	Feasibility?: number;
	DetailedDesign?: boolean;
	RowAvailable?: boolean;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ProjectGroupList {
	Id: number;
    GroupId: string;
	Name: string;
	Description?: string;
	UserGroup: number;
    UserGroupName?: string;
	NumberOfProjects?: number;
	CreatedBy?: string;
	CreatedDate?: string;
}

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

export interface ProjectGroupsDropDowns extends PaginationResponse<ProjectGroupList> {
    Dropdowns: { UserGroups: UserGroups[] }
}