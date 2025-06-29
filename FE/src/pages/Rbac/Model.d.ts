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

export interface Permission {
	Id: number;
	ModuleFunction: string;
	CreatedBy: string;
	CreatedDate?: string;
}

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