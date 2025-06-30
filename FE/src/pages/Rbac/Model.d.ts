import type { PaginationParams } from '../../types/Pagination';

export interface User {
    Id: number;
    EmployeeId?: string;
    UserGroup: string;
    UserId: string;
    Name: string;
    Email?: string;
    RegCode: string;
    PlantillaOffice?: string;
    IsActive: boolean;
}

//#region Permissions Models
export interface Permissions {
    Id: number;
    ModuleFunction?: string;
    Description?: string;
    CreatedBy?: string;
    CreatedDate?: string;
}
export interface PermissionPagination extends PaginationParams {
    filters?: PermissionFilter;
    sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
    sortDirection?: 0 | 1;
}
export interface PermissionFilter {
    ModuleFunction?: string;
    Description?: string;
}
//#endregion

export interface RawUserGroupData {
  Id: number;
  GroupName: string;
  Description: string;
  PermissionName: string;
  Module?: string;
  MemberCount?: number;
  CreatedDate?: string;
}

export interface ConsolidatedUserGroup {
  Id: number;
  GroupName: string;
  Description: string;
  PermissionName: string[]; // Array of all permissions
  Module?: string;
  MemberCount: number;
  CreatedDate: string;
}