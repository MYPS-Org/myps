'use-client'
import React, { useEffect, useState } from 'react';

import { Heading } from '../../components/tailwindui/heading';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
//   EyeIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/16/solid'
import { UsersIcon, KeyIcon, UserGroupIcon, AdjustmentsVerticalIcon } from '@heroicons/react/20/solid'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/tailwindui/table'
import { Button } from '../../components/tailwindui/button'
import { Badge } from '../../components/tailwindui/badge'

// Interfaces
import { type Users, type Permissions, type RawUserGroupData, type ConsolidatedUserGroup, type PermissionPagination, type UserPagination } from './Model.d';

// Services
import { consolidateUserGroups, fetchInitialData, fetchPermissions, fetchUsers } from './service';

// Dialog imports
import { AddUserDialog, AddPermissionDialog, AddGroupDialog, ViewUserDialog, UpdateUserDialog, DeleteUserDialog, 
	ViewPermissionDialog, UpdatePermissionDialog, DeletePermissionDialog, ViewGroupDialog, UpdateGroupDialog, DeleteGroupDialog, 
	FilterUserDialog,
	FilterPermissionDialog,
	FilterUserGroupDialog} from './dialogs';

// Pagination
import { 
	Pagination,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
	PaginationPage,
 } from '../../components/tailwindui/pagination';
import type { ErrorResponse } from '../../services/httpClient';


const Rbac: React.FC = () => {
	const [selectedTab, setSelectedTab] = useState<'users' | 'permissions' | 'userGroups' | 'userRoles'>('users');

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

	const [UsersData, setUsersData] = useState<PaginationResponse<Users>>({
		lists: [],
		page: 1,
		limit: 10,
		total: 0,
		totalPages: 0
	})

	const [PermissionsData, setPermissionsData] = useState<PaginationResponse<Permissions>>({
		lists: [],
		page: 1,
		limit: 10,
		total: 0,
		totalPages: 0
	});

	// Initialize userGroups with consolidated data from raw data
	const [userGroups, setUserGroups] = useState<ConsolidatedUserGroup[]>(() => consolidateUserGroups(rawUserGroupsData));

	const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
	const [isAddPermissionDialogOpen, setIsAddPermissionDialogOpen] = useState(false);
	const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
	const [isViewUserDialogOpen, setIsViewUserDialogOpen] = useState(false);
	const [isUpdateUserDialogOpen, setIsUpdateUserDialogOpen] = useState(false);
	const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [isViewPermissionDialogOpen, setIsViewPermissionDialogOpen] = useState(false);
	const [isUpdatePermissionDialogOpen, setIsUpdatePermissionDialogOpen] = useState(false);
	const [selectedPermissionId, setSelectedPermissionId] = useState<number | null>(null);
	const [isDeletePermissionDialogOpen, setIsDeletePermissionDialogOpen] = useState(false);
	// Group dialog states
	const [isViewGroupDialogOpen, setIsViewGroupDialogOpen] = useState(false);
	const [isUpdateGroupDialogOpen, setIsUpdateGroupDialogOpen] = useState(false);
	const [isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen] = useState(false);
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

	//Filter Dialog
	const [isFilterUserDialogOpen, setIsFilterUserDialogOpen] = useState(false);
	const [isPermissionFilterDialogOpen, setIsPermissionFilterDialogOpen] = useState(false);
	const [isUserGroupFilterDialogOpen, setIsUserGroupFilterDialogOpen] = useState(false);

	//Permission Filter
	const [PermissionFilter, setPermissionFilter] = useState<PermissionPagination>({
		Filters: {
			ModuleFunction: '',
			Description: '',
		},
		sortField: '',
		sortDirection: 0,
		page: 1,
		limit: 10
	});
	const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

	//User Group Filter
	// const [UserGroupFilter, setUserGroupFilter] = useState<UserGroupPagination>({
	// 	Filters: {
	// 		ModuleFunction: '',
	// 		Description: '',
	// 	},
	// 	sortField: '',
	// 	sortDirection: 0,
	// 	page: 1,
	// 	limit: 10
	// });

	// User Filter
	const [UserFilter, setUserFilter] = useState<UserPagination>({
		filters: {
			Name: '',
		},
		sortField: '',
		sortDirection: 0,
		page: 1,
		limit: 10
	});

	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	useEffect(() => {
		// Fetch initial data when component mounts
		const fetchData = async () => {
			try {
				const initialData = await fetchInitialData();
				const res = await fetchUsers(UserFilter);
				if(res.Data.lists) {
					console.log('Setting users data:', res);
					setUsersData(res.Data);
				}
				console.log('Initial data fetched:', initialData);
			} catch (error : any) {
				console.error('Error fetching initial data:', error);
				// alert('Failed to fetch initial data: ' + (error instanceof Error ? error.message : 'Unknown error'));
			}
		};
		fetchData();
	},[])
	// Sorting state
	const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);

	const handleSort = async (field: number, direction: 0 | 1 | null) => {
		setSortDirection(direction);
		
		// Update filter based on the current tab and sort parameters
		if (selectedTab === 'userGroups') {
			// For user groups, sort the local array
			if (field === 0) { // GroupName column
				const sortedGroups = [...userGroups].sort((a, b) => {
					const comparison = a.GroupName.localeCompare(b.GroupName);
					return direction === 1 ? comparison : -comparison;
				});
				setUserGroups(sortedGroups);
			}
		} else if (selectedTab === 'users') {
			// Create new filter with updated sort
			const newFilter: UserPagination = {
				...UserFilter,
				sortField: field === 0 ? 'Name' : '', // Assuming field 0 maps to Name for users
				sortDirection: (direction || 0) as 0 | 1,
				page: 1 // Reset to first page when sorting
			};
			
			// Update state
			setUserFilter(newFilter);
			
			// Fetch data with new sort immediately
			try {
				setIsLoadingUsers(true);
				console.log('Fetching users with new sort:', newFilter);
				const res = await fetchUsers(newFilter);
				console.log('Users response:', res);
				if(res.Data.lists) {
					console.log('Setting users data:', res);
					setUsersData(res.Data);
				}
			} catch (error) {
				console.error('Error fetching users:', error);
				// alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUsers(false);
			}
		} else if (selectedTab === 'permissions') {
			// Create new filter with updated sort
			const newFilter: PermissionPagination = {
				...PermissionFilter,
				sortField: field === 0 ? 'Id' : field === 1 ? 'ModuleFunction' : field === 2 ? 'Description' : field === 3 ? 'CreatedBy' : field === 4 ? 'CreatedDate' : '',
				sortDirection: (direction || 0) as 0 | 1,
				page: 1 // Reset to first page when sorting
			};
			
			// Update state
			setPermissionFilter(newFilter);
			
			// Fetch data with new sort immediately
			try {
				setIsLoadingPermissions(true);
				console.log('Fetching permissions with new sort:', newFilter);
				const res = await fetchPermissions(newFilter);
				console.log('Permissions response:', res);
				if(res.Data.lists) {
					console.log('Setting permissions data:', res);
					setPermissionsData(res.Data);
				}
			} catch (error) {
				console.error('Error fetching permissions:', error);
				alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingPermissions(false);
			}
		}
	};

	const getStatusBadge = (status: true | false) => {
		return status === true
			? <Badge color="green">Active</Badge>
			: <Badge color="red">Inactive</Badge>;
	};

	const getTableData = async (tabName: 'users' | 'permissions' | 'userGroups' | 'userRoles') => {
		console.log('Switching to tab:', tabName);
		setSelectedTab(tabName);
		
		if(tabName == 'permissions'){
			// Prevent multiple concurrent requests
			if (isLoadingPermissions) {
				console.log('Already loading permissions, skipping request');
				return;
			}
			
			try {
				setIsLoadingPermissions(true);
				console.log('Fetching permissions with current filter:', PermissionFilter);
				const res = await fetchPermissions(PermissionFilter);
				console.log('Permissions response:', res);
				if(res.Data.lists) {
					console.log('Setting permissions data:', res);
					setPermissionsData(res.Data);
				}
			} catch (error) {
				console.error('Error fetching permissions:', error);
				alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingPermissions(false);
			}
		}
		else if (tabName == 'users'){
			// Prevent multiple concurrent requests
			if (isLoadingUsers) {
				console.log('Already loading users, skipping request');
				return;
			}
			
			try {
				setIsLoadingUsers(true);
				console.log('Fetching users with current filter:', UserFilter);
				const res = await fetchUsers(UserFilter);
				console.log('Users response:', res);
				if(res.Data.lists) {
					console.log('Setting users data:', res);
					setUsersData(res.Data);
				}
			} catch (error) {
				console.error('Error fetching users:', error);
				alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUsers(false);
			}
		}
		else if (tabName == 'userGroups') {
			// User groups are static data, no API call needed
			console.log('User groups tab selected - using static data');
		}
	}
	const Paginate = async (page: number) => {
		if(selectedTab == 'permissions'){
			// Create new filter with updated page
			const newFilter: PermissionPagination = {
				...PermissionFilter,
				page: page
			};
			
			// Update state
			setPermissionFilter(newFilter);
			
			// Fetch data with updated pagination immediately
			try {
				setIsLoadingPermissions(true);
				console.log('Fetching permissions for page:', page, 'with filter:', newFilter);
				const res = await fetchPermissions(newFilter);
				console.log('Permissions response:', res);
				if(res.Data.lists) {
					console.log('Setting permissions data:', res);
					setPermissionsData(res.Data);
				}
			} catch (error) {
				console.error('Error fetching permissions:', error);
				alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingPermissions(false);
			}
		}
		else if (selectedTab == 'users') {
			// Create new filter with updated page
			const newFilter: UserPagination = {
				...UserFilter,
				page: page
			};
			
			// Update state
			setUserFilter(newFilter);
			
			// Fetch data with updated pagination immediately
			try {
				setIsLoadingUsers(true);
				console.log('Fetching users for page:', page, 'with filter:', newFilter);
				const res = await fetchUsers(newFilter);
				console.log('Users response:', res);
				if(res.Data.lists) {
					console.log('Setting users data:', res);
					setUsersData(res.Data);
				}
			} catch (error) {
				console.error('Error fetching users:', error);
				alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUsers(false);
			}
		}
		else {
			// For user groups, just update local state since it's static data
			console.log('User groups pagination not implemented yet');
		}
	}
	
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
			onClick={() => { if(selectedTab != value) getTableData(value); }}
			className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
				selectedTab === value
					? 'bg-primary-100 text-primary-700 border border-primary-200'
					: 'cursor-pointer text-gray-600 hover:text-gray-900 hover:bg-gray-100'
			}`}
		>
			<Icon className="w-5 h-5" />
			<span>{label}</span>
			<Badge color="zinc" className="ml-2">{count}</Badge>
		</button>
	);

	return (
		<div className="max-w-10xl mx-auto p-6 space-y-6">
			<div className="flex items-center justify-center">
				<div>
					<Heading level={1} className="">
						Role-Based Access Control
					</Heading>
					<p className="text-gray-600 mt-1">
						Manage users, permissions, and user groups
					</p>
				</div>
				{/* <Button color="blue" className="flex items-center space-x-2" onClick={() => setIsAddUserDialogOpen(true)}>
					<PlusIcon className="w-4 h-4" />
					<span>Add New</span>
				</Button> */}
			</div>

			{/* Tab Navigation */}
			<div className="flex space-x-2 p-1 bg-white shadow-md rounded-lg">
				<TabButton 
					label="Users" 
					value="users" 
					icon={UsersIcon} 
					count={UsersData.lists.length} 
				/>
				<TabButton 
					label="Permissions" 
					value="permissions" 
					icon={KeyIcon} 
					count={100} 
				/>
				<TabButton 
					label="User Groups" 
					value="userGroups" 
					icon={UserGroupIcon} 
					count={userGroups.length} 
				/>
			</div>
			{/* Content Area */}
			<div className="bg-white rounded-lg shadow-sm border border-gray-200">
				{/* Users Table */}
				{selectedTab === 'users' && (
					<div className="overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium text-gray-900">Users</h3>
								<div className="flex items-center space-x-3">
									<Button 
										color="white" 
										className={`shadow-md ${UserFilter.filters?.Name ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
										onClick={() => setIsFilterUserDialogOpen(true)}
									>
										<AdjustmentsVerticalIcon className="w-4 h-4 mr-1" />
										Filter
										{UserFilter.filters?.Name && (
											<span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
												1
											</span>
										)}
									</Button>
									<Button color="blue" onClick={() => setIsAddUserDialogOpen(true)}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add User
									</Button>
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead className='text-xl'>
								<TableRow>
									<TableHeader sortable className='text-gray-500'>User</TableHeader>
									<TableHeader sortable className='text-gray-500'>UserGroup</TableHeader>
									<TableHeader sortable className='text-gray-500'>Office</TableHeader>
									<TableHeader sortable className='text-gray-500'>Status</TableHeader>
									<TableHeader sortable className='text-gray-500'>Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{UsersData.lists.map((user, index) => (
									<TableRow key={user.Id} className={`hover:bg-gray-50 ${
										index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
									}`}>
										<TableCell>
											<div className="flex items-center space-x-3s">
												<div>
													<div className="font-medium text-gray-900">
														{user.Name}
													</div>
													<div className="text-sm text-gray-500">
														{user.Email}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>
											{user.UserGroups?.split(',').map((group, idx) => (
												<Badge key={idx} color="blue" className="mr-1 mb-1">
													{group.trim()}
												</Badge>
											))}
										</TableCell>
										<TableCell>
											<Badge color="blue">{user.PlantillaOffice}</Badge>
										</TableCell>
										<TableCell>
											{getStatusBadge(user.IsActive ?? false)}
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<Button color='yellow' className="p-2"
												onClick={() => {
													setIsUpdateUserDialogOpen(true);
													setSelectedUserId(user.Id);
												}}>
													<PencilIcon className="w-4 h-4" />
												</Button>
												<Button color="red" className="p-2"
												onClick={() => {
													setIsDeleteUserDialogOpen(true);
													setSelectedUserId(user.Id);
												}}>
													<TrashIcon className="w-4 h-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<Pagination className="my-6">
							{
								UsersData.totalPages > 1 && (
									<>
										<PaginationPrevious 
											onClick={async () => {
												Paginate(UsersData.page-1);
											}}
											disabled={UsersData.page <= 1}
										/>
										<PaginationList>
											{Array.from({ length: Math.min(7, UsersData.totalPages) }, (_, index) => {
												const pageNum = Math.max(1, UsersData.page - 3) + index;
												if (pageNum > UsersData.totalPages) return null;

												if (pageNum === UsersData.page) {
													return (
														<PaginationPage
															key={pageNum}
															current
														>
															{pageNum}
														</PaginationPage>
													);
												} else {
													return (
														<PaginationPage
															key={pageNum}
															onClick={() => {
																Paginate(pageNum);
															}}
														>
															{pageNum}
														</PaginationPage>
													);
												}
											})}
										</PaginationList>
										<PaginationNext 
											onClick={async () => {
												Paginate(UsersData.page+1);
											}}
											disabled={UsersData.page >= UsersData.totalPages}
										/>
									</>
								)
							}
						</Pagination>
						<div className='mb-3.5'>
							{
								UsersData.lists.length > 0 ? (
									<p className="text-sm text-gray-500">
										Showing {UsersData.limit * (UsersData.page - 1) + 1} to {Math.min(UsersData.limit * UsersData.page, UsersData.total)} of {UsersData.total} permissions
									</p>
								) : (
									<p className="text-sm text-gray-500">
										No permissions found
									</p>
								)
							}
						</div>
					</div>
				)}

				{/* Permissions Table */}
				{selectedTab === 'permissions' && (
					<div className="overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium text-gray-900">Permissions</h3>
								<div className="flex items-center space-x-3">
									<Button 
										color="white" 
										className={`shadow-md ${(PermissionFilter.Filters?.ModuleFunction || PermissionFilter.Filters?.Description) ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
										onClick={() => setIsPermissionFilterDialogOpen(true)}
									>
										<AdjustmentsHorizontalIcon className="w-4 h-4 mr-1" />
										Filter
										{(PermissionFilter.Filters?.ModuleFunction || PermissionFilter.Filters?.Description) && (
											<span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
												{[PermissionFilter.Filters?.ModuleFunction, PermissionFilter.Filters?.Description].filter(Boolean).length}
											</span>
										)}
									</Button>
									{/* <Button color="blue" onClick={() => setIsAddPermissionDialogOpen(true)}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add Permission
									</Button> */}
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead>
								<TableRow>
									{/* <TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(0, direction)} className="text-gray-500">ID</TableHeader> */}
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(1, direction)} className="text-gray-500">Module Function</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(2, direction)} className="text-gray-500">Description</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(3, direction)} className="text-gray-500">Created By</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(4, direction)} className="text-gray-500">Created At</TableHeader>
									{/* <TableHeader className="text-gray-500">Actions</TableHeader> */}
								</TableRow>
							</TableHead>
							<TableBody>
								{PermissionsData.lists.map((permission, index) => (
									<TableRow key={permission.Id} className={`hover:bg-gray-50 ${
										index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
									}`}>
										{/* <TableCell>
											<div className="font-medium text-gray-900">
												{permission.Id}
											</div>
										</TableCell> */}
										<TableCell>
											<div className="font-medium text-gray-900">
												{permission.ModuleFunction}
											</div>
										</TableCell>
										<TableCell>
											<div className="font-medium text-gray-900">
												{permission.Description}
											</div>
										</TableCell>
										<TableCell>
											<Badge color="zinc">{permission.CreatedBy}</Badge>
										</TableCell>
										<TableCell className="text-gray-500">
											{permission.CreatedDate}
										</TableCell>
										{/* <TableCell>
											<div className="flex items-center space-x-2">
												<Button color="yellow" className="p-2"
												onClick={() => {
													setIsUpdatePermissionDialogOpen(true);
													setSelectedPermissionId(permission.Id);
												}}>
													<PencilIcon className="w-4 h-4" />
												</Button>
												<Button color="red" className="p-2"
												onClick={() => {
													setIsDeletePermissionDialogOpen(true);
													setSelectedPermissionId(permission.Id);
												}}>
													<TrashIcon className="w-4 h-4" />
												</Button>
											</div>
										</TableCell> */}
									</TableRow>
								))}
							</TableBody>
						</Table>
						<Pagination className="my-6">
							{
								PermissionsData.totalPages > 1 && (
									<>
										<PaginationPrevious 
											onClick={async () => {
												Paginate(PermissionsData.page-1);
											}}
											disabled={PermissionsData.page <= 1}
										/>
										<PaginationList>
											{Array.from({ length: Math.min(7, PermissionsData.totalPages) }, (_, index) => {
												const pageNum = Math.max(1, PermissionsData.page - 3) + index;
												if (pageNum > PermissionsData.totalPages) return null;
												
												if (pageNum === PermissionsData.page) {
													return (
														<PaginationPage
															key={pageNum}
															current
														>
															{pageNum}
														</PaginationPage>
													);
												} else {
													return (
														<PaginationPage
															key={pageNum}
															onClick={() => {
																Paginate(pageNum);
															}}
														>
															{pageNum}
														</PaginationPage>
													);
												}
											})}
										</PaginationList>
										<PaginationNext 
											onClick={async () => {
												Paginate(PermissionsData.page+1);
											}}
											disabled={PermissionsData.page >= PermissionsData.totalPages}
										/>
									</>
								)
							}
						</Pagination>
						<div className='mb-3.5'>
							{
								PermissionsData.lists.length > 0 ? (
									<p className="text-sm text-gray-500">
										Showing {PermissionsData.limit * (PermissionsData.page - 1) + 1} to {Math.min(PermissionsData.limit * PermissionsData.page, PermissionsData.total)} of {PermissionsData.total} permissions
									</p>
								) : (
									<p className="text-sm text-gray-500">
										No permissions found
									</p>
								)
							}
						</div>
					</div>
				)}

				{/* User Groups Table */}
				{selectedTab === 'userGroups' && (
					<div className="overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium text-gray-900">User Groups</h3>
								<div className="flex items-center space-x-3">
									<Button color="white" className='shadow-md' onClick={() => { setIsUserGroupFilterDialogOpen(true) }}>
										<AdjustmentsVerticalIcon className="w-4 h-4 mr-1" />
										Filter Group
									</Button>
									<Button color="blue" onClick={() => { setIsAddGroupDialogOpen(true) }}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add Group
									</Button>
								</div>
							</div>
						</div>
						
						<Table>
							<TableHead className='text-[20px]'>
								<TableRow className="text-center">
									<TableHeader
										sortable
										sortDirection={sortDirection}
										onSort={(direction) => handleSort(0, direction)}
										className="text-gray-700"
									>
										Group Name
									</TableHeader>
									<TableHeader sortable={true} className="text-gray-700">Members</TableHeader>
									<TableHeader className="text-gray-700">Permissions</TableHeader>
									<TableHeader className="text-gray-700">Description</TableHeader>
									<TableHeader className="text-gray-700">Created</TableHeader>
									<TableHeader className="text-gray-700">Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{userGroups.map((group, index) => (
									<TableRow key={group.Id} className={`hover:bg-gray-50 ${
										index % 2 === 0 ? 'bg-white' : 'bg-gray-100'
									}`}>
										<TableCell>
											<div className="font-medium text-gray-900">
												{group.GroupName}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-2">
												<UsersIcon className="w-4 h-4 text-gray-400" />
												<span className="text-gray-900 font-medium">
													{group.MemberCount}
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
										<TableCell className="text-gray-500 max-w-xs truncate">
											{group.Description}
										</TableCell>
										<TableCell className="text-gray-500">
											{group.CreatedDate}
										</TableCell>
										<TableCell>
											<div className="flex justify-center space-x-2">
												<Button 
													color="yellow" 
													className="p-2"
													onClick={() => {
														setSelectedGroupId(group.Id);
														setIsUpdateGroupDialogOpen(true);
													}}
												>
													<PencilIcon className="w-4 h-4" />
												</Button>
												<Button 
													color="red" 
													className="p-2"
													onClick={() => {
														setSelectedGroupId(group.Id);
														setIsDeleteGroupDialogOpen(true);
													}}
												>
													<TrashIcon className="w-4 h-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{/* <Pagination className="my-6">
							{
								userGroups.totalPages > 1 && (
									<>
										<PaginationPrevious 
											onClick={async () => {
												Paginate(userGroups.page-1);
											}}
											disabled={userGroups.page <= 1}
										/>
										<PaginationList>
											{Array.from({ length: Math.min(7, userGroups.totalPages) }, (_, index) => {
												const pageNum = Math.max(1, userGroups.page - 3) + index;
												if (pageNum > userGroups.totalPages) return null;

												if (pageNum === userGroups.page) {
													return (
														<PaginationPage
															key={pageNum}
															current
														>
															{pageNum}
														</PaginationPage>
													);
												} else {
													return (
														<PaginationPage
															key={pageNum}
															onClick={() => {
																Paginate(pageNum);
															}}
														>
															{pageNum}
														</PaginationPage>
													);
												}
											})}
										</PaginationList>
										<PaginationNext 
											onClick={async () => {
												Paginate(UsersData.page+1);
											}}
											disabled={UsersData.page >= UsersData.totalPages}
										/>
									</>
								)
							}
						</Pagination>
						<div className='mb-3.5'>
							{
								userGroups.lists.length > 0 ? (
									<p className="text-sm text-gray-500">
										Showing {userGroups.limit * (userGroups.page - 1) + 1} to {Math.min(userGroups.limit * userGroups.page, userGroups.total)} of {userGroups.total} permissions
									</p>
								) : (
									<p className="text-sm text-gray-500">
										No permissions found
									</p>
								)
							}
						</div> */}
					</div>
				)}
			</div>

			{/* Add User Dialog */}
			<AddUserDialog 
				isOpen={isAddUserDialogOpen} 
				onClose={() => setIsAddUserDialogOpen(false)} 
				onSubmit={(newUser: any) => {
					// Add the new user to the existing data
					const newUserWithId = { 
						...newUser, 
						Id: (UsersData.lists?.length || 0) + 1, 
						CreatedDate: new Date().toLocaleDateString() 
					};
					setUsersData(prev => ({
						...prev,
						lists: [...(prev.lists || []), newUserWithId],
						total: (prev.total || 0) + 1
					}));
				}}
			/>

			{/* Add Permission Dialog */}
			<AddPermissionDialog 
				isOpen={isAddPermissionDialogOpen} 
				onClose={() => setIsAddPermissionDialogOpen(false)} 
				onSubmit={(newPermission: any) => {
					// Add the new permission to the existing data
					const newPermissionWithId = { 
						...newPermission, 
						Id: (PermissionsData.lists?.length || 0) + 1, 
						CreatedDate: new Date().toLocaleDateString() 
					};
					setPermissionsData(prev => ({
						...prev,
						lists: [...(prev.lists || []), newPermissionWithId],
						total: (prev.total || 0) + 1
					}));
				}}
			/>

			{/* Add Group Dialog */}
			<AddGroupDialog 
				isOpen={isAddGroupDialogOpen} 
				onClose={() => setIsAddGroupDialogOpen(false)} 
				onSubmit={(newGroup: any) => {
					const newGroupData: ConsolidatedUserGroup = {
						Id: userGroups.length + 1,
						GroupName: newGroup.groupName,
						Description: newGroup.description,
						PermissionName: newGroup.permissions,
						Module: newGroup.module,
						MemberCount: newGroup.memberCount || 0,
						CreatedDate: new Date().toISOString()
					};
					setUserGroups([...userGroups, newGroupData]);
				}}
			/>
			{/* View User Dialog */}
			{isViewUserDialogOpen && selectedUserId && (
				<ViewUserDialog
					isOpen={isViewUserDialogOpen}
					onClose={() => {
						setIsViewUserDialogOpen(false);
						setSelectedUserId(null);
					}}
					user={UsersData.lists.find(user => user.Id === selectedUserId)!}
					// onSubmit={(updatedUser: any) => {
					// 	setUsers(users.map(user => user.Id === updatedUser.Id ? updatedUser : user));
					// }}
				/>
			)}
			{/* Update User Dialog */}
			{isUpdateUserDialogOpen && selectedUserId && (
				<UpdateUserDialog
					isOpen={isUpdateUserDialogOpen}
					onClose={() => {
						setIsUpdateUserDialogOpen(false);
						setSelectedUserId(null);
					}}
					user={UsersData.lists.find(user => user.Id === selectedUserId)!}
					onSubmit={(updatedUser: any) => {
						setUsersData(prev => ({
							...prev,
							lists: prev.lists?.map(user => user.Id === updatedUser.Id ? updatedUser : user) || []
						}));
					}}
				/>
			)}
			{/* Delete User Dialog */}
			{isDeleteUserDialogOpen && selectedUserId && (
				<DeleteUserDialog
					isOpen={isDeleteUserDialogOpen}
					onClose={() => {
						setIsDeleteUserDialogOpen(false);
						setSelectedUserId(null);
					}}
				user={UsersData.lists.find(user => user.Id === selectedUserId)!}
				onSubmit={(deletedUserId: number) => {
					setUsersData(prev => ({
						...prev,
						lists: prev.lists?.filter(user => user.Id !== deletedUserId) || [],
						total: Math.max(0, (prev.total || 1) - 1)
					}));
					}}
				/>
			)}
			
			{/* Permission CRUD Dialogs */}
			{/* Add Permission Dialog */}
			{/* View Permission Dialog */}
			{isViewPermissionDialogOpen && selectedPermissionId && (
				<ViewPermissionDialog
					isOpen={isViewPermissionDialogOpen}
					onClose={() => {
						setIsViewPermissionDialogOpen(false);
						setSelectedPermissionId(null);
					}}
					permission={PermissionsData.lists?.find((permission: any) => permission.Id === selectedPermissionId)!}
				/>
			)}
			{/* Update Permission Dialog */}
			{isUpdatePermissionDialogOpen && selectedPermissionId && (
				<UpdatePermissionDialog
					isOpen={isUpdatePermissionDialogOpen}
					onClose={() => {
						setIsUpdatePermissionDialogOpen(false);
						setSelectedPermissionId(null);
					}}
					permission={PermissionsData.lists?.find((permission: any) => permission.Id === selectedPermissionId)!}
					onSubmit={(updatedPermission: any) => {
						setPermissionsData(prev => ({
							...prev,
							lists: prev.lists?.map((permission: any) => permission.Id === updatedPermission.Id ? updatedPermission : permission) || []
						}));
					}}
				/>
			)}
			{/* Delete Permission Dialog */}
			{isDeletePermissionDialogOpen && selectedPermissionId && (
				<DeletePermissionDialog
					isOpen={isDeletePermissionDialogOpen}
					onClose={() => {
						setIsDeletePermissionDialogOpen(false);
						setSelectedPermissionId(null);
					}}
					permission={PermissionsData.lists?.find((permission: any) => permission.Id === selectedPermissionId)!}
					onSubmit={(deletedPermissionId: number) => {
						setPermissionsData(prev => ({
							...prev,
							lists: prev.lists?.filter((permission: any) => permission.Id !== deletedPermissionId) || [],
							total: Math.max(0, (prev.total || 1) - 1)
						}));
					}}
				/>
			)}
			
			{/* Group CRUD Dialogs */}
			{/* View Group Dialog */}
			{isViewGroupDialogOpen && selectedGroupId && (
				<ViewGroupDialog
					isOpen={isViewGroupDialogOpen}
					onClose={() => {
						setIsViewGroupDialogOpen(false);
						setSelectedGroupId(null);
					}}
					group={userGroups.find(group => group.Id === selectedGroupId)!}
				/>
			)}
			
			{/* Update Group Dialog */}
			{isUpdateGroupDialogOpen && selectedGroupId && (
				<UpdateGroupDialog
					isOpen={isUpdateGroupDialogOpen}
					onClose={() => {
						setIsUpdateGroupDialogOpen(false);
						setSelectedGroupId(null);
					}}
					group={userGroups.find(group => group.Id === selectedGroupId)!}
					onSubmit={(updatedGroup: any) => {
						const updatedGroupData: ConsolidatedUserGroup = {
							Id: updatedGroup.id,
							GroupName: updatedGroup.groupName,
							Description: updatedGroup.description,
							PermissionName: updatedGroup.permissions,
							Module: updatedGroup.module,
							MemberCount: updatedGroup.memberCount,
							CreatedDate: userGroups.find(g => g.Id === updatedGroup.id)?.CreatedDate || new Date().toISOString()
						};
						setUserGroups(userGroups.map(group => group.Id === updatedGroup.id ? updatedGroupData : group));
					}}
				/>
			)}
			
			{/* Delete Group Dialog */}
			{isDeleteGroupDialogOpen && selectedGroupId && (
				<DeleteGroupDialog
					isOpen={isDeleteGroupDialogOpen}
					onClose={() => {
						setIsDeleteGroupDialogOpen(false);
						setSelectedGroupId(null);
					}}
					group={userGroups.find(group => group.Id === selectedGroupId)!}
					onSubmit={(deletedGroupId: number) => {
						setUserGroups(userGroups.filter(group => group.Id !== deletedGroupId));
					}}
				/>
			)}

			{/* Filter User Dialog */}
			{isFilterUserDialogOpen && (
				<FilterUserDialog 
				isOpen={isFilterUserDialogOpen}
				onClose={() => setIsFilterUserDialogOpen(false)}
				onSubmit={async (filterData) => {
					console.log('User filter data received:', filterData);
					
					// Create new filter object
					const newFilter: UserPagination = {
						...UserFilter,
						filters: filterData,
						page: 1 // Reset to first page when applying filter
					};
					
					// Update state
					setUserFilter(newFilter);
					
					// Fetch data with new filter immediately
					try {
						setIsLoadingUsers(true);
						console.log('Fetching users with new filter:', newFilter);
						const res = await fetchUsers(newFilter);
						console.log('Users response:', res);
						if(res.Data.lists) {
							console.log('Setting users data:', res);
							setUsersData(res.Data);
						}
					} catch (error) {
						console.error('Error fetching users:', error);
						alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
					} finally {
						setIsLoadingUsers(false);
					}
				}}
				onClear={async () => {
					console.log('Clearing user filters');
					
					// Create new filter object with cleared filters
					const newFilter: UserPagination = {
						...UserFilter,
						filters: {
							Name: ''
						},
						page: 1
					};
					
					// Update state
					setUserFilter(newFilter);
					
					// Fetch data without filters immediately
					try {
						setIsLoadingUsers(true);
						console.log('Fetching users without filters:', newFilter);
						const res = await fetchUsers(newFilter);
						console.log('Users response:', res);
						if(res.Data.lists) {
							console.log('Setting users data:', res);
							setUsersData(res.Data);
						}
					} catch (error) {
						console.error('Error fetching users:', error);
						alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
					} finally {
						setIsLoadingUsers(false);
					}
				}}
				initialData={UserFilter.filters}
				/>
			)}

			{/* Filter Permission Dialog */}
			{isPermissionFilterDialogOpen && (
				<FilterPermissionDialog 
				isOpen={isPermissionFilterDialogOpen}
				onClose={() => setIsPermissionFilterDialogOpen(false)}
				onSubmit={async (filterData) => {
					console.log('Filter data received:', filterData);
					
					// Create new filter object
					const newFilter: PermissionPagination = {
						...PermissionFilter,
						Filters: filterData,
						page: 1 // Reset to first page when applying filter
					};
					
					// Update state
					setPermissionFilter(newFilter);
					
					// Fetch data with new filter immediately
					try {
						setIsLoadingPermissions(true);
						console.log('Fetching permissions with new filter:', newFilter);
						const res = await fetchPermissions(newFilter);
						console.log('Permissions response:', res);
						if(res.Data.lists) {
							console.log('Setting permissions data:', res);
							setPermissionsData(res.Data);
						}
					} catch (error) {
						console.error('Error fetching permissions:', error);
						alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
					} finally {
						setIsLoadingPermissions(false);
					}
				}}
				onClear={async () => {
					console.log('Clearing permission filters');
					
					// Create new filter object with cleared filters
					const newFilter: PermissionPagination = {
						...PermissionFilter,
						Filters: {
							ModuleFunction: '',
							Description: ''
						},
						page: 1
					};
					
					// Update state
					setPermissionFilter(newFilter);
					
					// Fetch data without filters immediately
					try {
						setIsLoadingPermissions(true);
						console.log('Fetching permissions without filters:', newFilter);
						const res = await fetchPermissions(newFilter);
						console.log('Permissions response:', res);
						if(res.Data.lists) {
							console.log('Setting permissions data:', res);
							setPermissionsData(res.Data);
						}
					} catch (error) {
						console.error('Error fetching permissions:', error);
						alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
					} finally {
						setIsLoadingPermissions(false);
					}
				}}
				initialData={PermissionFilter.Filters}
				/>
			)}
			{/* Filter UserGroup Dialog */}
			{isUserGroupFilterDialogOpen && (
				<FilterUserGroupDialog 
				isOpen={isUserGroupFilterDialogOpen}
				onClose={() => setIsUserGroupFilterDialogOpen(false)}
				onSubmit={(filterData) => {
					console.log('Filter data received:', filterData);
					setPermissionFilter(prev => ({
						...prev,
						Filters: filterData,
						page: 1 // Reset to first page when applying filter
					}));
					// Refresh the data with new filter
					getTableData('permissions');
				}}
				onClear={() => {
					console.log('Clearing permission filters');
					setPermissionFilter(prev => ({
						...prev,
						Filters: {
							ModuleFunction: '',
							Description: ''
						},
						page: 1
					}));
					// Refresh the data without filters
					getTableData('permissions');
				}}
				initialData={PermissionFilter.Filters}
				/>
			)}
		</div>
	);
};

export default Rbac;