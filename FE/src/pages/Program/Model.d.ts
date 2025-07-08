export interface Programs {
  Id: number;
  Name: string;
  Description: string;
  Status: string;
  ProgramStage: string;
  ProgramType: string;
  StartYear: number;
  User: string;
  DataSecurity: string;
  dateCreated?: string; // Optional field for creation date
//   startDate: string;
//   endDate: string;
}
export interface ProgramPagination extends PaginationParams {
  filters?: ProgramFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface ProgramFilter {
  name?: string;
}