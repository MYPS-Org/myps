export interface Programs {
  id: number;
  name: string;
  description: string;
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