'use-client'
import React, { useState } from 'react';

import { Heading } from '../../components/tailwindui/heading';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/16/solid'
import { MagnifyingGlassIcon, UsersIcon, KeyIcon, UserGroupIcon } from '@heroicons/react/20/solid'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/tailwindui/table'
import { Button } from '../../components/tailwindui/button'
import { Badge } from '../../components/tailwindui/badge'

// Interfaces
import { type User, type Permission, type RawUserGroupData, type ConsolidatedUserGroup } from './Model';

// Dialog imports
import { AddUserDialog, AddPermissionDialog, AddGroupDialog } from './dialogs';

// interface User {
// 	Id: number;
// 	EmployeeId?: string;
// 	UserGroup: string;
// 	UserId: string;
// 	Name: string;
// 	Email?: string;
// 	RegCode: string;
// 	PlantillaOffice?: string;
// 	IsActive: boolean;
// }

// interface Permission {
// 	Id: number;
// 	ModuleFunction: string;
// 	CreatedBy: string;
// 	CreatedDate?: string;
// }

// interface RawUserGroupData {
//   Id: number;
//   GroupName: string;
//   Description: string;
//   PermissionName: string;
//   Module?: string;
//   MemberCount?: number;
//   CreatedDate?: string;
// }

// interface ConsolidatedUserGroup {
//   Id: number;
//   GroupName: string;
//   Description: string;
//   PermissionName: string[]; // Array of all permissions
//   Module?: string;
//   MemberCount: number;
//   CreatedDate: string;
// }

const Rbac: React.FC = () => {
	const [selectedTab, setSelectedTab] = useState<'users' | 'permissions' | 'userGroups' | 'userRoles'>('users');

	// Consolidation function
	const consolidateUserGroups = (rawData: RawUserGroupData[]): ConsolidatedUserGroup[] => {
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

	// Raw data example (this would come from your database/API)
	const rawUserGroupsData: RawUserGroupData[] = [
		{ Id: 1, GroupName: 'Admin', Description: 'System administrators', PermissionName: 'User Management', MemberCount: 5, CreatedDate: '2024-01-01' },
		{ Id: 2, GroupName: 'Admin', Description: 'System administrators', PermissionName: 'View Reports', MemberCount: 5, CreatedDate: '2024-01-01' },
		{ Id: 3, GroupName: 'Admin', Description: 'System administrators', PermissionName: 'Edit Content', MemberCount: 5, CreatedDate: '2024-01-01' },
		{ Id: 4, GroupName: 'Admin', Description: 'System administrators', PermissionName: 'Delete Records', MemberCount: 5, CreatedDate: '2024-01-01' },
		{ Id: 5, GroupName: 'Manager', Description: 'Project managers', PermissionName: 'View Reports', MemberCount: 3, CreatedDate: '2024-01-02' },
		{ Id: 6, GroupName: 'Manager', Description: 'Project managers', PermissionName: 'Edit Content', MemberCount: 3, CreatedDate: '2024-01-02' },
		{ Id: 7, GroupName: 'Editor', Description: 'Content editors', PermissionName: 'Edit Content', MemberCount: 8, CreatedDate: '2024-01-03' },
		{ Id: 8, GroupName: 'Editor', Description: 'Content editors', PermissionName: 'View Reports', MemberCount: 8, CreatedDate: '2024-01-03' },
		{ Id: 9, GroupName: 'Viewer', Description: 'Read-only access', PermissionName: 'View Reports', MemberCount: 2, CreatedDate: '2024-01-04' },
	];

	const [users, setUsers] = useState<User[]>([
		{ 
			Id: 1, 
			EmployeeId: 'EMP001',
			UserId: 'johndoe123',
			Name: 'John Doe', 
			Email: 'john.doe@company.com',
			RegCode: 'REG12345',
			UserGroup: 'Admin',
			PlantillaOffice: 'Main Office',
			IsActive: true,
		},
		{ 
			Id: 2, 
			EmployeeId: 'EMP002',
			UserId: 'janesmith456',
			Name: 'Jane Smith', 
			Email: 'jane.smith@company.com', 
			RegCode: 'REG12346',
			UserGroup: 'Manager',
			PlantillaOffice: 'Main Office',
			IsActive: true,
		},
		{ 
			Id: 3, 
			EmployeeId: 'EMP003',
			UserId: 'mikejohnson789',
			Name: 'Mike Johnson', 
			Email: 'mike.johnson@company.com', 
			RegCode: 'REG12347',
			UserGroup: 'User',
			PlantillaOffice: 'Main Office',
			IsActive: false,
		},
		{ 
			Id: 4, 
			EmployeeId: 'EMP004',
			UserId: 'sarahwilson012',
			Name: 'Sarah Wilson', 
			Email: 'sarah.wilson@company.com', 
			RegCode: 'REG12348',
			UserGroup: 'Editor',
			PlantillaOffice: 'Main Office',
			IsActive: true,
		}
	]);

	const [permissions, setPermissions] = useState<Permission[]>([
		{ 
			Id: 1, 
			ModuleFunction: 'User Management', 
			CreatedBy: 'Create, read, update, and delete user accounts',
			CreatedDate: 'Users',
		},
		{ 
			Id: 2, 
			ModuleFunction: 'View Reports', 
			CreatedBy: 'Access to view system reports and analytics',
			CreatedDate: 'Reports',
		},
		{ 
			Id: 3, 
			ModuleFunction: 'Edit Content', 
			CreatedBy: 'Ability to modify content and posts',
			CreatedDate: 'Content',
		},
		{ 
			Id: 4, 
			ModuleFunction: 'Delete Records', 
			CreatedBy: 'Permission to permanently delete system records',
			CreatedDate: 'System',
		}
	]);

	// Initialize userGroups with consolidated data from raw data
	const [userGroups, setUserGroups] = useState<ConsolidatedUserGroup[]>(() => consolidateUserGroups(rawUserGroupsData));

	const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
	const [isAddPermissionDialogOpen, setIsAddPermissionDialogOpen] = useState(false);
	const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);

	const getStatusBadge = (status: true | false) => {
		return status === true
			? <Badge color="green">Active</Badge>
			: <Badge color="red">Inactive</Badge>;
	};

	const TabButton = ({ 
		label, 
		value, 
		icon: Icon, 
		count 
	}: { 
		label: string; 
		value: 'users' | 'permissions' | 'userGroups'; 
		icon: React.ComponentType<{ className?: string }>; 
		count: number;
	}) => (
		<button
			onClick={() => setSelectedTab(value)}
			className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
				selectedTab === value
					? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
					: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
			}`}
		>
			<Icon className="w-5 h-5" />
			<span>{label}</span>
			<Badge color="zinc" className="ml-2">{count}</Badge>
		</button>
	);

	return (
		<div className="max-w-7xl mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<Heading level={1} className="text-gray-900 dark:text-white">
						Role-Based Access Control
					</Heading>
					<p className="text-gray-600 dark:text-gray-400 mt-1">
						Manage users, permissions, and user groups
					</p>
				</div>
				<Button color="blue" className="flex items-center space-x-2" onClick={() => setIsAddUserDialogOpen(true)}>
					<PlusIcon className="w-4 h-4" />
					<span>Add New</span>
				</Button>
			</div>

			{/* Tab Navigation */}
			<div className="flex space-x-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
				<TabButton 
					label="Users" 
					value="users" 
					icon={UsersIcon} 
					count={users.length} 
				/>
				<TabButton 
					label="Permissions" 
					value="permissions" 
					icon={KeyIcon} 
					count={permissions.length} 
				/>
				<TabButton 
					label="User Groups" 
					value="userGroups" 
					icon={UserGroupIcon} 
					count={userGroups.length} 
				/>
			</div>
			{/* Content Area */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
				{/* Users Table */}
				{selectedTab === 'users' && (
					<div className="overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium text-gray-900 dark:text-white">Users</h3>
								<div className="flex items-center space-x-3">
									<div className="relative">
										<MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
										<input
											type="text"
											placeholder="Search users..."
											className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>
									<Button color="blue" onClick={() => setIsAddUserDialogOpen(true)}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add User
									</Button>
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead>
								<TableRow>
									<TableHeader>User</TableHeader>
									<TableHeader>Role</TableHeader>
									<TableHeader>Status</TableHeader>
									<TableHeader>Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{users.map((user) => (
									<TableRow key={user.Id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
										<TableCell>
											<div className="flex items-center space-x-3">
												<div>
													<div className="font-medium text-gray-900 dark:text-white">
														{user.Name}
													</div>
													<div className="text-sm text-gray-500 dark:text-gray-400">
														{user.Email}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge color="blue">{user.PlantillaOffice}</Badge>
										</TableCell>
										<TableCell>
											{getStatusBadge(user.IsActive)}
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<Button plain className="p-2">
													<EyeIcon className="w-4 h-4" />
												</Button>
												<Button plain className="p-2">
													<PencilIcon className="w-4 h-4" />
												</Button>
												<Button color="blue" className="p-2">
													<TrashIcon className="w-4 h-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				{/* Permissions Table */}
				{selectedTab === 'permissions' && (
					<div className="overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium text-gray-900 dark:text-white">Permissions</h3>
								<div className="flex items-center space-x-3">
									<div className="relative">
										<MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
										<input
											type="text"
											placeholder="Search permissions..."
											className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>
									<Button color="blue" onClick={() => setIsAddPermissionDialogOpen(true)}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add Permission
									</Button>
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead>
								<TableRow>
									<TableHeader>ID</TableHeader>
									<TableHeader>Module Function</TableHeader>
									<TableHeader>Created By</TableHeader>
									<TableHeader>Created At</TableHeader>
									<TableHeader>Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{permissions.map((permission) => (
									<TableRow key={permission.Id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
										<TableCell>
											<div className="font-medium text-gray-900 dark:text-white">
												{permission.Id}
											</div>
										</TableCell>
										<TableCell>
											<div className="font-medium text-gray-900 dark:text-white">
												{permission.ModuleFunction}
											</div>
										</TableCell>
										<TableCell>
											<Badge color="zinc">{permission.CreatedBy}</Badge>
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400">
											{permission.CreatedDate}
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<Button color="green" className="p-2">
													<EyeIcon className="w-4 h-4" />
												</Button>
												<Button color="yellow" className="p-2">
													<PencilIcon className="w-4 h-4" />
												</Button>
												<Button color="red" className="p-2">
													<TrashIcon className="w-4 h-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				{/* User Groups Table */}
				{selectedTab === 'userGroups' && (
					<div className="overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium text-gray-900 dark:text-white">User Groups</h3>
								<div className="flex items-center space-x-3">
									<div className="relative">
										<MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
										<input
											type="text"
											placeholder="Search groups..."
											className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>
									<Button color="blue" onClick={() => setIsAddGroupDialogOpen(true)}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add Group
									</Button>
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead>
								<TableRow>
									<TableHeader>Group Name</TableHeader>
									<TableHeader>Members</TableHeader>
									<TableHeader>Permissions</TableHeader>
									<TableHeader>Description</TableHeader>
									<TableHeader>Created</TableHeader>
									<TableHeader>Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{userGroups.map((group) => (
									<TableRow key={group.Id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
										<TableCell>
											<div className="font-medium text-gray-900 dark:text-white">
												{group.GroupName}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<UsersIcon className="w-4 h-4 text-gray-400" />
												<span className="text-gray-900 dark:text-white font-medium">
													{/* {group.MemberCount} */}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1">
												{group.PermissionName.slice(0, 2).map((permission: string, index: number) => (
													<Badge key={index} color="blue" className="text-xs">
														{permission}
													</Badge>
												))}
												{group.PermissionName.length > 2 && (
													<Badge color="zinc" className="text-xs">
														+{group.PermissionName.length - 2} more
													</Badge>
												)}
											</div>
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
											{group.Description}
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400">
											{group.CreatedDate}
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<Button color="green" className="p-2">
													<EyeIcon className="w-4 h-4" />
												</Button>
												<Button color="yellow" className="p-2">
													<PencilIcon className="w-4 h-4" />
												</Button>
												<Button color="red" className="p-2">
													<TrashIcon className="w-4 h-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			{/* Add User Dialog */}
			<AddUserDialog 
				isOpen={isAddUserDialogOpen} 
				onClose={() => setIsAddUserDialogOpen(false)} 
				onSubmit={(newUser: any) => {
					setUsers([...users, { ...newUser, id: users.length + 1, lastLogin: 'Never' }]);
				}}
			/>

			{/* Add Permission Dialog */}
			<AddPermissionDialog 
				isOpen={isAddPermissionDialogOpen} 
				onClose={() => setIsAddPermissionDialogOpen(false)} 
				onSubmit={(newPermission: any) => {
					setPermissions([...permissions, { ...newPermission, id: permissions.length + 1, createdAt: new Date().toLocaleDateString() }]);
				}}
			/>

			{/* Add Group Dialog */}
			<AddGroupDialog 
				isOpen={isAddGroupDialogOpen} 
				onClose={() => setIsAddGroupDialogOpen(false)} 
				onSubmit={(newGroup: any) => {
					setUserGroups([...userGroups, { ...newGroup, id: userGroups.length + 1, memberCount: 0, createdAt: new Date().toLocaleDateString() }]);
				}}
			/>
		</div>
	);
};

export default Rbac;