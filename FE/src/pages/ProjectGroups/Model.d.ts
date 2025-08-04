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

export interface ProjectGroupPagination extends PaginationParams {
    filters?: {
        Name?: string;
    };
    sortField?: string;
    sortDirection?: 0 | 1;
}

export interface AddProjectGroupModel {
    NewGroupId?: string;
    Name: string;
    Description: string;
    UserGroup: number;
}

export interface ProjectGroupDetails {
    GroupDetails: ProjectGroups
    Projects: ProjectList[]
    UserGroups: UserGroups[]
}

export interface ProjectList {
    Id: number;
    Name: string;
    Description?: string;
    Cost?: number;
    UserGroup: number;
    CreatedBy?: string;
    CreatedDate?: string;
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
    CreatedDate: string;
    PermissionIds: string; // API returns comma-separated string of numeric IDs
    PermissionNames: string; // API returns comma-separated string of permission names
}

export interface ProjectGroupsDropDowns extends PaginationResponse<ProjectGroupList> {
    Dropdowns: { UserGroups: UserGroups[] }
}