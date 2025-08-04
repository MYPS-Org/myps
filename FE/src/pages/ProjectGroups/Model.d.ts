export interface ProjectGroups {
    Id: number;
	Name: string;
	Description?: string;
	UserGroup: number;
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

export interface ProjectGroupList {
    Id: number;
    Name: string;
    NumberOfProjects?: number;
    Description?: string;
    UserGroup: number;
    CreatedBy?: string;
    CreatedDate?: string;
}