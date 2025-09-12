import type { ProjectLists } from "../Project/Model";

export interface ProgramModel {
	Id: number;
	Stage: number;
	Status: number;
	Type: number;
	Name: string;
	YearStart: number;
	YearEnd: number;
	UserGroup: number;
	IsSkipped: boolean;
	AllowAutoName: boolean;
	SkipReason: string;
	DataSecurityGroup?: string[];
}
export interface ProgramEnums {
	Id: number;
	Enum: number;
	GroupName?: string;
	Name: string;
	Description: string;
	ParticipantId?: string;
	OrgName?: string;
	OrgType?: string;
}

export interface ParentProgram {
	Id: number;
	RevisionId: number;
	ProgramId: string;
	StageName: string;
	Name: string;
	GroupName?: string;
	RegionCode: string;
	Status?: string;
	Type?: string;
	Cost?: number;
	YearStart: number;
	YearEnd: number;
	CreatedBy: string;
	CreatedDate: string;
	IsPublished: boolean;
	// Stages: ProgramList[];
}

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

export interface StageList {
	Stages: ProgramDetailsWithStages[];
}

export interface ProgramDetailsWithStages {
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
	TypeName: string;
	Cost?: number;
	YearStart: number;
	YearEnd: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ProgramDetailsEnums{
  Details: ProgramDetails;
  Projects: ProjectLists[];
  IsActive: boolean;
  Dropdowns: {
    Stages: ProgramEnums[];
    Statuses: ProgramEnums[];
    Types: ProgramEnums[];
    Groups: ProgramEnums[];
	DataSecurity: ProgramEnums[];
  };
}

export interface ProgramPagination extends PaginationParams {
  filters?: ProgramFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface ProgramFilter {
  Name?: string;
  YearStart?: string;
  YearEnd?: string;
  StageName?: string;
  GroupName?: string;
  Status?: string;
  Type?: string;
}

export interface ProgramList {
	Id: number;
	RevisionId: number;
	ProgramId: string;
	StageName: string;
	Name: string;
	GroupName?: string;
	RegionCode: string;
	Status?: string;
	Type?: string;
	Cost?: number;
	YearStart: number;
	YearEnd: number;
	CreatedBy: string;
	CreatedDate: string;
	IsPublished: boolean;
}

