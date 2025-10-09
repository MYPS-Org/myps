import type { extend } from "leaflet";

export interface ProgramDetails {
	Id: number;
	ProgramId: string;
	RevisionNumber: number;
	Name: string;
	StageId: number;
	StageName: string;
	IsSkipped: boolean;
	SkipReason: string;
	UserGroup: number;
	RegionCode: string;
	Status: number;
	Type: number;
	Cost?: number;
	DataSecurityGroup?: string[];
	YearStart: number;
	YearEnd: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ProgramPagination extends PaginationParams {
    filter?: ProgramFilter;
    sortfield?: string;
    sortDirection?: 0 | 1;
}

export interface ProgramFilter {
    StageName?: string;
    YearStart?: number;
    YearEnd?: number;
    Status?: string;
    Type?: string;
}

export interface ProgramList {
    Id: number;
    ProgramId: string;
    Name: string;
    StageName: string;
    Type: string;
    YearStart: number;
    YearEnd: number;
    Status: string;
    Cost?: number;
}