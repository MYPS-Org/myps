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

export const consolidateUserGroups = (rawData: RawUserGroupData[]): ConsolidatedUserGroup[] => {
  const groupMap = new Map<string, ConsolidatedUserGroup>();

  rawData.forEach(item => {
    const groupName = item.GroupName;
    
    if (groupMap.has(groupName)) {
      // Group already exists, add permission to existing group
      const existingGroup = groupMap.get(groupName)!;
      
      // Add permission if it doesn't already exist
      if (!existingGroup.PermissionName.includes(item.PermissionName)) {
        existingGroup.PermissionName.push(item.PermissionName);
      }
      
      // Update member count if provided
      if (item.MemberCount && item.MemberCount > existingGroup.MemberCount) {
        existingGroup.MemberCount = item.MemberCount;
      }
    } else {
      // Create new group entry
      groupMap.set(groupName, {
        Id: item.Id,
        GroupName: item.GroupName,
        Description: item.Description,
        PermissionName: [item.PermissionName], // Start with array containing first permission
        Module: item.Module || '',
        MemberCount: item.MemberCount || 0,
        CreatedDate: item.CreatedDate || new Date().toISOString()
      });
    }
  });

  return Array.from(groupMap.values());
};

// Helper function to format permissions as CSV string
// export const formatPermissionsAsCSV = (permissions: string[]): string => {
//   return permissions.join(', ');
// };

// Helper function to get permission count
export const getPermissionCount = (permissions: string[]): number => {
  return permissions.length;
};