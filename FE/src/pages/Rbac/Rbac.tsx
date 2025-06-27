'use-client'
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

import { Heading } from '../../components/tailwindui/heading';
import { Avatar } from '../../components/tailwindui/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '../../components/tailwindui/dropdown'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/16/solid'
import { InboxIcon, MagnifyingGlassIcon, UsersIcon, KeyIcon, UserGroupIcon } from '@heroicons/react/20/solid'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/tailwindui/table'
import { Button } from '../../components/tailwindui/button'
import { Badge } from '../../components/tailwindui/badge'

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  avatar?: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
  module: string;
  type: 'read' | 'write' | 'delete' | 'admin';
  createdAt: string;
}

interface UserGroup {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  permissions: string[];
  createdAt: string;
}

const Rbac: React.FC = () => {
	const { theme } = useTheme();
	const [selectedTab, setSelectedTab] = useState<'users' | 'permissions' | 'userGroups'>('users');
	
	const [users, setUsers] = useState<User[]>([
		{ 
			id: 1, 
			name: 'John Doe', 
			email: 'john.doe@company.com', 
			role: 'Administrator',
			status: 'active',
			lastLogin: '2024-01-15 10:30 AM',
			avatar: '/api/placeholder/32/32'
		},
		{ 
			id: 2, 
			name: 'Jane Smith', 
			email: 'jane.smith@company.com', 
			role: 'Manager',
			status: 'active',
			lastLogin: '2024-01-14 2:15 PM'
		},
		{ 
			id: 3, 
			name: 'Mike Johnson', 
			email: 'mike.johnson@company.com', 
			role: 'User',
			status: 'inactive',
			lastLogin: '2024-01-10 9:45 AM'
		},
		{ 
			id: 4, 
			name: 'Sarah Wilson', 
			email: 'sarah.wilson@company.com', 
			role: 'Editor',
			status: 'active',
			lastLogin: '2024-01-15 11:20 AM'
		}
	]);

	const [permissions, setPermissions] = useState<Permission[]>([
		{ 
			id: 1, 
			name: 'User Management', 
			description: 'Create, read, update, and delete user accounts',
			module: 'Users',
			type: 'admin',
			createdAt: '2024-01-01'
		},
		{ 
			id: 2, 
			name: 'View Reports', 
			description: 'Access to view system reports and analytics',
			module: 'Reports',
			type: 'read',
			createdAt: '2024-01-02'
		},
		{ 
			id: 3, 
			name: 'Edit Content', 
			description: 'Ability to modify content and posts',
			module: 'Content',
			type: 'write',
			createdAt: '2024-01-03'
		},
		{ 
			id: 4, 
			name: 'Delete Records', 
			description: 'Permission to permanently delete system records',
			module: 'System',
			type: 'delete',
			createdAt: '2024-01-04'
		}
	]);

	const [userGroups, setUserGroups] = useState<UserGroup[]>([
		{ 
			id: 1, 
			name: 'Administrators', 
			description: 'Full system access with all permissions',
			memberCount: 3,
			permissions: ['User Management', 'View Reports', 'Edit Content', 'Delete Records'],
			createdAt: '2024-01-01'
		},
		{ 
			id: 2, 
			name: 'Managers', 
			description: 'Management level access with limited admin rights',
			memberCount: 8,
			permissions: ['View Reports', 'Edit Content'],
			createdAt: '2024-01-02'
		},
		{ 
			id: 3, 
			name: 'Editors', 
			description: 'Content management and editing permissions',
			memberCount: 12,
			permissions: ['Edit Content', 'View Reports'],
			createdAt: '2024-01-03'
		},
		{ 
			id: 4, 
			name: 'Viewers', 
			description: 'Read-only access to system data',
			memberCount: 25,
			permissions: ['View Reports'],
			createdAt: '2024-01-04'
		}
	]);

	const getStatusBadge = (status: 'active' | 'inactive') => {
		return status === 'active' 
			? <Badge color="green">Active</Badge>
			: <Badge color="red">Inactive</Badge>;
	};

	const getPermissionTypeBadge = (type: Permission['type']) => {
		const colors = {
			read: 'blue',
			write: 'yellow',
			delete: 'red',
			admin: 'purple'
		} as const;
		
		return <Badge color={colors[type]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
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
				<Button color="blue" className="flex items-center space-x-2">
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
									<Button color="blue">
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
									<TableHeader>Last Login</TableHeader>
									<TableHeader>Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{users.map((user) => (
									<TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
										<TableCell>
											<div className="flex items-center space-x-3">
												<Avatar 
													src={user.avatar} 
													initials={user.name.split(' ').map(n => n[0]).join('')}
													className="w-8 h-8"
												/>
												<div>
													<div className="font-medium text-gray-900 dark:text-white">
														{user.name}
													</div>
													<div className="text-sm text-gray-500 dark:text-gray-400">
														{user.email}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge color="blue">{user.role}</Badge>
										</TableCell>
										<TableCell>
											{getStatusBadge(user.status)}
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400">
											{user.lastLogin}
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
									<Button color="blue">
										<PlusIcon className="w-4 h-4 mr-1" />
										Add Permission
									</Button>
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead>
								<TableRow>
									<TableHeader>Permission Name</TableHeader>
									<TableHeader>Module</TableHeader>
									<TableHeader>Type</TableHeader>
									<TableHeader>Description</TableHeader>
									<TableHeader>Created</TableHeader>
									<TableHeader>Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{permissions.map((permission) => (
									<TableRow key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
										<TableCell>
											<div className="font-medium text-gray-900 dark:text-white">
												{permission.name}
											</div>
										</TableCell>
										<TableCell>
											<Badge color="zinc">{permission.module}</Badge>
										</TableCell>
										<TableCell>
											{getPermissionTypeBadge(permission.type)}
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
											{permission.description}
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400">
											{permission.createdAt}
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<Button plain className="p-2">
													<EyeIcon className="w-4 h-4" />
												</Button>
												<Button plain className="p-2">
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
									<Button color="blue">
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
									<TableRow key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
										<TableCell>
											<div className="font-medium text-gray-900 dark:text-white">
												{group.name}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<UsersIcon className="w-4 h-4 text-gray-400" />
												<span className="text-gray-900 dark:text-white font-medium">
													{group.memberCount}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1">
												{group.permissions.slice(0, 2).map((permission, index) => (
													<Badge key={index} color="blue" className="text-xs">
														{permission}
													</Badge>
												))}
												{group.permissions.length > 2 && (
													<Badge color="zinc" className="text-xs">
														+{group.permissions.length - 2} more
													</Badge>
												)}
											</div>
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
											{group.description}
										</TableCell>
										<TableCell className="text-gray-500 dark:text-gray-400">
											{group.createdAt}
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
		</div>
	);
};

export default Rbac;