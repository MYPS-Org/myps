import { PaginationParams } from '../../../types/PaginationParams';

export interface ProgramModel {
  Id: number,
	Stage: number;
	Status: number;
	Type: number;
	Name: string;
	YearStart: number;
	YearEnd: number;
	UserGroup: number;
}
export interface ProgramEnums {
	Id: number;
	Enum: number;
  GroupName?: string;
	Name: string;
	Description: string;
}

export interface ProgramList {
  Stage: number;
  Status: number;
  Type: number;
  Name: string;
  Cost?: number;
  YearStart: number;
  YearEnd: number;
  UserGroup: number;
  RegionCode: string;
}

export interface ProgramPagination extends PaginationParams {
  filters?: ProgramFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface ProgramFilter {
  name?: string;
  yearStart?: string;
  stage?: number;
  userGroup?: string;
}