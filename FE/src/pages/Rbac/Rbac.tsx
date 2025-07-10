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
import type { Users, Permissions, PermissionPagination, UserPagination, UserGroupPagination, UserGroups} from './Model.d';

// Services
import { fetchInitialData, fetchPermissions, fetchUsers, fetchUserGroups } from './service';

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
// import { all } from 'axios';
// import type { ErrorResponse } from '../../services/httpClient';


const Rbac: React.FC = () => {
	const [selectedTab, setSelectedTab] = useState<'users' | 'permissions' | 'userGroups' | 'userRoles'>('users');

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

	const [UserGroupsData, setUserGroups] = useState<PaginationResponse<UserGroups>>({
		lists: [],
		page: 1,
		limit: 10,
		total: 0,
		totalPages: 0
	});

	// Initialize userGroups with consolidated data from raw data
	// const [userGroups, setUserGroups] = useState<ConsolidatedUserGroup[]>(() => consolidateUserGroups(rawUserGroupsData));

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

	// Slice Badge
	const [expandedUserGroups, setExpandedUserGroups] = useState<Set<number>>(new Set());


	const [UserFilter, setUserFilter] = useState<UserPagination>({
		filters: {
			Name: '',
		},
		sortField: '',
		sortDirection: 0,
		page: 1,
		limit: 10
	});
	//UserGroup Filter
	const [UserGroupFilter, setUserGroupFilter] = useState<UserGroupPagination>({
		filters: {
			GroupName: '',
		},
		sortField: '',
		sortDirection: 0,
		page: 1,
		limit: 10
	});
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
	const [isLoadingUserGroups, setIsLoadingUserGroups] = useState(false);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [tabNumbers, setTabNumbers] = useState({
		users: 0,
		permissions: 0,
		userGroups: 0
	});
	// Store all permissions for lookup
	// const [allPermissions, setAllPermissions] = useState<Permissions[]>([]);

	// Function to get permission names by IDs
	// const getPermissionNamesByIds = (permissionIds: number[]): string[] => {
	// 	return permissionIds.map(id => {
	// 		const permission = allPermissions.find(p => p.Id === id);
	// 		return permission ? permission.ModuleFunction : `Permission ${id}`;
			
	// 	});
	// };

	// Function to get permission names by IDs - Updated to handle string format
	// const getPermissionNamesByIds = (permissionIds: number[] | string): string[] => {
	// 	// Handle string format (comma-separated permission names)
	// 	if (typeof permissionIds === 'string') {
	// 		return permissionIds.split(',').map(name => name.trim()).filter(name => name.length > 0);
	// 	}
		
	// 	// Handle array format (numeric IDs) - fallback for backward compatibility
	// 	if (Array.isArray(permissionIds)) {
	// 		return permissionIds.map(id => {
	// 			const permission = allPermissions.find(p => p.Id === id);
	// 			return permission ? permission.ModuleFunction : `Permission ${id}`;
	// 		});
	// 	}
		
	// 	return [];
	// };

	useEffect(() => {
		// Fetch initial data when component mounts
		const fetchData = async () => {
			try {
				const initialData = await fetchInitialData();
				setTabNumbers({
					users: initialData.Data.NumberOfUsers || 0,
					permissions: initialData.Data.NumberOfPermissions || 0,
					userGroups: initialData.Data.NumberOfUserGroups || 0
				});

				if (initialData.Data.Users) {
					setUsersData(
						{
							lists: initialData.Data.Users || [],
							page: 1,
							limit: 10,
							total: initialData.Data.NumberOfUsers,
							totalPages: Math.ceil(initialData.Data.NumberOfUsers / 10) // Assuming 10 items per page
						}
					);
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

	// #region Handlesort
	const handleSort = async (field: number, direction: 0 | 1 | null) => {
		setSortDirection(direction);
		
		// Update filter based on the current tab and sort parameters
		if (selectedTab === 'userGroups') {
			// For user groups, sort the local array
			const newFilter: UserGroupPagination = {
				...UserGroupFilter,
				sortField: field === 0 ? 'GroupName' : '',
				sortDirection: (direction || 0) as 0 | 1,
				page: 1 // Reset to first page when sorting
			};
			setUserGroupFilter(newFilter);

			try {
				setIsLoadingUserGroups(true);
				const res = await fetchUserGroups(newFilter);
				console.log('UserGroups response:', res);
				if(res.Data.lists) {
					console.log('Setting userGroups data:', res);
					setUserGroups(res.Data);
				}
			} catch (error) {
				console.error('Error fetching userGroups:', error);
				// alert('Failed to fetch userGroups: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUserGroups(false);
			}

		} else if (selectedTab === 'users') {
			// Create new filter with updated sort
			const newFilter: UserPagination = {
				...UserFilter,
				sortField: field === 0 ? 'Name' : field === 1 ? 'Email' : field === 2 ? 'Office' : field === 3 ? 'Status' : '', // Assuming field 0 maps to Name for users
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
					// Update the all permissions lookup for UserGroups display
					// setAllPermissions(res.Data.lists);
				}
			} catch (error) {
				console.error('Error fetching permissions:', error);
				alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingPermissions(false);
			}
		}
	};
	//  #endregion

	// #region Render Table Headers
	const getStatusBadge = (status: true | false) => {
		return status === true
			? <Badge color="green">Active</Badge>
			: <Badge color="red">Inactive</Badge>;
	};
	// #endregion

	// #region Function to handle expand/collapse of badges
	const handleExpand = (e: React.MouseEvent, id: number) => {
		e.preventDefault();
		e.stopPropagation();
		setExpandedUserGroups(prev => {
			const newSet = new Set(prev);
			if (newSet.has(id)) {
				newSet.delete(id);
			} else {
				newSet.add(id);
			}
			return newSet;
		});
	};
	// #endregion

	// #region Function to handle auto-refresh after dialog submissions
	const handleAutoRefresh = async (tabType: 'users' | 'permissions' | 'userGroups') => {
		try {
			if (tabType === 'users') {
				setIsLoadingUsers(true);
				console.log('Auto-refreshing users after dialog submission');
				const res = await fetchUsers(UserFilter);
				if (res.Data.lists) {
					console.log('Setting updated users data:', res);
					setUsersData(res.Data);
				}
			} else if (tabType === 'permissions') {
				setIsLoadingPermissions(true);
				console.log('Auto-refreshing permissions after dialog submission');
				const res = await fetchPermissions(PermissionFilter);
				if (res.Data.lists) {
					console.log('Setting updated permissions data:', res);
					setPermissionsData(res.Data);
				}
			} else if (tabType === 'userGroups') {
				setIsLoadingUserGroups(true);
				console.log('Auto-refreshing user groups after dialog submission');
				const res = await fetchUserGroups(UserGroupFilter);
				if (res.Data.lists) {
					console.log('Setting updated userGroups data:', res);
					setUserGroups(res.Data);
				}
			}
		} catch (error) {
			console.error(`Error auto-refreshing ${tabType}:`, error);
			// Don't show alert here, let the calling code handle fallback
			throw error;
		} finally {
			// Reset loading states
			if (tabType === 'users') setIsLoadingUsers(false);
			else if (tabType === 'permissions') setIsLoadingPermissions(false);
			else if (tabType === 'userGroups') setIsLoadingUserGroups(false);
		}
	};
	// #endregion

	// #region Function to handle dialog open/close
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
					// Update the all permissions lookup for UserGroups display
					// setAllPermissions(res.Data.lists);
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
			try {
				// Prevent multiple concurrent requests
				if (isLoadingUserGroups) {
					console.log('Already loading user groups, skipping request');
					return;
				}
				
				setIsLoadingUserGroups(true);
				console.log('Fetching user groups with current filter:', UserGroupFilter);
				const res = await fetchUserGroups(UserGroupFilter);
				console.log('UserGroups response:', res);
				if(res.Data.lists) {
					console.log('Setting userGroups data:', res);
					setUserGroups(res.Data);
				}
			} catch (error) {
				console.error('Error fetching userGroups:', error);
				alert('Failed to fetch userGroups: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUserGroups(false);
			}
		}
	}
	// #endregion

	// #region Function to handle pagination
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
					// Update the all permissions lookup for UserGroups display
					// setAllPermissions(res.Data.lists);
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
		else if (selectedTab == 'userGroups') {
			// Create new filter with updated page
			const newFilter: UserGroupPagination = {
				...UserGroupFilter,
				page: page
			};
			
			// Update state
			setUserGroupFilter(newFilter);
			
			// Fetch data with updated pagination immediately
			try {
				setIsLoadingUserGroups(true);
				console.log('Fetching user groups for page:', page, 'with filter:', newFilter);
				const res = await fetchUserGroups(newFilter);
				console.log('UserGroups response:', res);
				if(res.Data.lists) {
					console.log('Setting userGroups data:', res);
					setUserGroups(res.Data);
				}
			} catch (error) {
				console.error('Error fetching user groups:', error);
				alert('Failed to fetch user groups: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUserGroups(false);
			}
		}
	}
	// #endregion
	
	// #region Render Tab Button
	const TabButton = ({ 
		label, 
		value, 
		icon: Icon, 
		count,
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
	// #endregion

	// #region Render the main component
	return (
		<div className="max-w-10xl mx-auto p-6 space-y-6">
			<div className="flex items-center justify-center">
				<div>
					<Heading level={1} className="">
						User Management
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
					count={tabNumbers.users} 
				/>
				<TabButton 
					label="Permissions" 
					value="permissions" 
					icon={KeyIcon} 
					count={tabNumbers.permissions} 
				/>
				<TabButton 
					label="User Groups" 
					value="userGroups" 
					icon={UserGroupIcon} 
					count={tabNumbers.userGroups} 
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
						
						<Table className='px-5'>
							<TableHead className='text-xl'>
								<TableRow>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(0, direction)} className='text-gray-500'>User</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(1, direction)} className='text-gray-500'>UserGroup</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(2, direction)} className='text-gray-500'>Office</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(3, direction)} className='text-gray-500'>Status</TableHeader>
									<TableHeader className='text-gray-500'>Actions</TableHeader>
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
											<div className='flex flex-wrap gap-1'>
												{(() => {
													const userGroups = user.UserGroups?.split(',').map(group => group.trim()) || [];
													const isExpanded = expandedUserGroups.has(user.Id);
													const visibleGroups = isExpanded ? userGroups : userGroups.slice(0, 3);
													
													return (
														<>
															{visibleGroups.map((group: string, index: number) => (
																<Badge key={index} color="blue" className="text-xs">
																	{group.trim()}
																</Badge>
															))}
															{userGroups.length > 3 && (
																<Badge 
																	color={isExpanded ? "red" : "green"} 
																	className="text-xs cursor-pointer hover:opacity-75 transition-opacity"
																	onClick={(e) => handleExpand(e, user.Id)}
																>
																	{isExpanded ? 'Show less' : `+${userGroups.length - 3} more`}
																</Badge>
															)}
														</>
													);
												})()}
											</div>
										</TableCell>
										<TableCell>
											{
												user.PlantillaOffice && <Badge color="blue">{user.PlantillaOffice}</Badge>
											}
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
												Paginate(1);
											}}
											disabled={UsersData.page <= 1}
										>
											First
										</PaginationPrevious>
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
												Paginate(UsersData.totalPages);
											}}
											disabled={UsersData.page >= UsersData.totalPages}
										>
											Last
										</PaginationNext>
									</>
								)
							}
						</Pagination>
						<div className='mb-3.5'>
							{
								UsersData.lists.length > 0 ? (
									<p className="text-sm text-gray-500">
										Showing {UsersData.limit * (UsersData.page - 1) + 1} to {Math.min(UsersData.limit * UsersData.page, UsersData.total)} of {UsersData.total} users
									</p>
								) : (
									<p className="text-sm text-gray-500">
										No users found
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
									<Button color="blue" onClick={() => setIsAddPermissionDialogOpen(true)}>
										<PlusIcon className="w-4 h-4 mr-1" />
										Add Permission
									</Button>
								</div>
							</div>
						</div>
						
						<Table className='px-5'>
							<TableHead>
								<TableRow>
									{/* <TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(0, direction)} className="text-gray-500">ID</TableHeader> */}
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(1, direction)} className="text-gray-500">Module Function</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(2, direction)} className="text-gray-500">Description</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(3, direction)} className="text-gray-500">Permission Group</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(4, direction)} className="text-gray-500">Created At</TableHeader>
									<TableHeader className="text-gray-500">Actions</TableHeader>
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
											<div className="text-gray-900">
												{permission.Description}
											</div>
										</TableCell>
										<TableCell>
											{permission.PermissionGroupName}
											{/* <Badge color="zinc">{permission.CreatedBy}</Badge> */}
										</TableCell>
										<TableCell className="text-gray-900">
											{new Date(permission.CreatedDate).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'numeric',
												day: 'numeric'
											})}
										</TableCell>
										<TableCell>
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
										</TableCell>
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
												Paginate(1);
											}}
											disabled={PermissionsData.page <= 1}
										>
											First
										</PaginationPrevious>
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
												Paginate(PermissionsData.totalPages);
											}}
											disabled={PermissionsData.page >= PermissionsData.totalPages}
										>
											Last
										</PaginationNext>
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
						
						<Table className='px-5'>
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
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(1, direction)} className="text-gray-700">Members</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(2, direction)} className="text-gray-700">Permissions</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(3, direction)} className="text-gray-700">Description</TableHeader>
									<TableHeader sortable sortDirection={sortDirection} onSort={(direction) => handleSort(4, direction)} className="text-gray-700">Created</TableHeader>
									<TableHeader className="text-gray-700">Actions</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{UserGroupsData.lists.map((group, index) => (
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
													{group.NumberOfUsers}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1">
												{(() => {
													const isExpanded = expandedUserGroups.has(group.Id);
													// Use PermissionNames for display (more readable than IDs)
													if (group.PermissionNames && group.PermissionNames.length > 0) {
														const permissionNames = group.PermissionNames.split(',').map(name => name.trim()).filter(name => name.length > 0);
														const visiblePermissions = isExpanded ? permissionNames : permissionNames.slice(0, 2);
														
														return (
															<>
																{visiblePermissions.map((permissionName: string, index: number) => (
																	<Badge key={index} color="blue" className="text-xs">
																		{permissionName}
																	</Badge>
																))}
																{permissionNames.length > 2 && (
																	<Badge 
																		color={isExpanded ? "red" : "green"} 
																		className="text-xs cursor-pointer hover:opacity-75 transition-opacity"
																		onClick={(e) => handleExpand(e, group.Id)}
																	>
																		{isExpanded ? 'Show less' : `+${permissionNames.length - 2} more`}
																	</Badge>
																)}
															</>
														);
													}
													// Fallback: try PermissionIds if PermissionNames doesn't work
													else if (group.PermissionIds && group.PermissionIds.length > 0) {
														const permissionIds = group.PermissionIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
														const visiblePermissions = isExpanded ? permissionIds : permissionIds.slice(0, 2);
														
														return (
															<>
																{visiblePermissions.map((permissionId: string, index: number) => (
																	<Badge key={index} color="zinc" className="text-xs">
																		ID: {permissionId}
																	</Badge>
																))}
																{permissionIds.length > 2 && (
																	<Badge 
																		color={isExpanded ? "red" : "green"} 
																		className="text-xs cursor-pointer hover:opacity-75 transition-opacity"
																		onClick={(e) => handleExpand(e, group.Id)}
																	>
																		{isExpanded ? 'Show less' : `+${permissionIds.length - 2} more`}
																	</Badge>
																)}
															</>
														);
													} else {
														return (
															<Badge color="zinc" className="text-xs">
																No permissions
															</Badge>
														);
													}
												})()}
											</div>
										</TableCell>
										<TableCell className="text-gray-500 max-w-xs truncate">
											{group.Description}
										</TableCell>
										<TableCell className="text-gray-500">
											{new Date(group.CreatedDate).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'numeric',
												day: 'numeric'
											})}
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
						{/* #region for pagination */}
						<Pagination className="my-6">
							{
								UserGroupsData.totalPages > 1 && (
									<>
										<PaginationPrevious 
											onClick={async () => {
												Paginate(1);
											}}
											disabled={UserGroupsData.page <= 1}
										>
											First
										</PaginationPrevious>
										<PaginationList>
											{Array.from({ length: Math.min(7, UserGroupsData.totalPages) }, (_, index) => {
												const pageNum = Math.max(1, UserGroupsData.page - 3) + index;
												if (pageNum > UserGroupsData.totalPages) return null;

												if (pageNum === UserGroupsData.page) {
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
												Paginate(UserGroupsData.totalPages);
											}}
											disabled={UserGroupsData.page >= UserGroupsData.totalPages}
										>
											Last
										</PaginationNext>
									</>
								)
							}
						</Pagination>
						<div className='mb-3.5'>
							{
								UserGroupsData.lists.length > 0 ? (
									<p className="text-sm text-gray-500">
										Showing {UserGroupsData.limit * (UserGroupsData.page - 1) + 1} to {Math.min(UserGroupsData.limit * UserGroupsData.page, UserGroupsData.total)} of {UserGroupsData.total} user groups
									</p>
								) : (
									<p className="text-sm text-gray-500">
										No user groups found
									</p>
								)
							}
						</div>
						{/* #endregion */}
					</div>
				)}
			</div>

			{/* #region for dialogs */}

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
				onSubmit={async (newPermission: any) => {
					try {
						await handleAutoRefresh('permissions');
					} catch (error) {
						console.error('Error refreshing permissions:', error);
						// Fallback to local update if server refresh fails
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
					}
				}}
			/>

			{/* Add Group Dialog */}
			<AddGroupDialog 
				isOpen={isAddGroupDialogOpen} 
				onClose={() => setIsAddGroupDialogOpen(false)} 
				onSubmit={async (newGroup: any) => {
					try {
						await handleAutoRefresh('userGroups');
					} catch (error) {
						console.error('Error refreshing user groups:', error);
						// Fallback to local update if server refresh fails
						const newGroupWithId: UserGroups = { 
							Id: (UserGroupsData.lists?.length || 0) + 1, 
							GroupName: newGroup.GroupName,
							Description: newGroup.Description,
							PermissionIds: Array.isArray(newGroup.permissionIds) 
								? newGroup.permissionIds.join(',') 
								: (newGroup.permissionIds || ''), // Convert array to comma-separated string of IDs
							PermissionNames: Array.isArray(newGroup.permissionNames) 
								? newGroup.permissionNames.join(',') 
								: (newGroup.permissionNames || ''), // Convert array to comma-separated string of names
							NumberOfUsers: 0, // New group starts with 0 users
							CreatedDate: new Date().toISOString()
						};
						setUserGroups(prev => ({
							...prev,
							lists: [...prev.lists, newGroupWithId],
							total: prev.total + 1
						}));
					}
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
					onSubmit={async (updatedPermission: any) => {
						try {
							await handleAutoRefresh('permissions');
						} catch (error) {
							console.error('Error refreshing permissions:', error);
							// Fallback to local update if server refresh fails
							setPermissionsData(prev => ({
								...prev,
								lists: prev.lists?.map((permission: any) => permission.Id === updatedPermission.Id ? updatedPermission : permission) || []
							}));
						}
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
			
			{/* View Group Dialog */}
			{isViewGroupDialogOpen && selectedGroupId && (
				<ViewGroupDialog
					isOpen={isViewGroupDialogOpen}
					onClose={() => {
						setIsViewGroupDialogOpen(false);
						setSelectedGroupId(null);
					}}
					group={UserGroupsData.lists.find(group => group.Id === selectedGroupId)!}
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
					group={UserGroupsData.lists.find(group => group.Id === selectedGroupId)!}
					onSubmit={async (updatedGroup: any) => {
						try {
							await handleAutoRefresh('userGroups');
						} catch (error) {
							console.error('Error refreshing user groups:', error);
							// Fallback to local update if server refresh fails
							const updatedGroupData: UserGroups = {
								Id: updatedGroup.id,
								GroupName: updatedGroup.groupName,
								Description: updatedGroup.description,
								PermissionIds: updatedGroup.permissionIds, // This is now a comma-separated string of IDs
								PermissionNames: updatedGroup.permissionNames, // This is a comma-separated string of names
								NumberOfUsers: UserGroupsData.lists.find(g => g.Id === updatedGroup.id)?.NumberOfUsers || 0,
								CreatedBy: UserGroupsData.lists.find(g => g.Id === updatedGroup.id)?.CreatedBy,
								CreatedDate: UserGroupsData.lists.find(g => g.Id === updatedGroup.id)?.CreatedDate || new Date().toISOString()
							};
							setUserGroups(prev => ({
								...prev,
								lists: prev.lists?.map(group => group.Id === updatedGroup.id ? updatedGroupData : group) || []
							}));
						}
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
					group={UserGroupsData.lists.find(group => group.Id === selectedGroupId)!}
					onSubmit={(deletedGroupId: number) => {
						setUserGroups(prev => ({
							...prev,
							lists: prev.lists?.filter(group => group.Id !== deletedGroupId) || [],
							total: Math.max(0, (prev.total || 1) - 1)
						}));
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
					
					// Use auto-refresh function
					try {
						await handleAutoRefresh('users');
					} catch (error) {
						console.error('Error fetching users:', error);
						alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
					
					// Use auto-refresh function
					try {
						await handleAutoRefresh('users');
					} catch (error) {
						console.error('Error fetching users:', error);
						alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
					
					// Use auto-refresh function
					try {
						await handleAutoRefresh('permissions');
					} catch (error) {
						console.error('Error fetching permissions:', error);
						alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
					
					// Use auto-refresh function
					try {
						await handleAutoRefresh('permissions');
					} catch (error) {
						console.error('Error fetching permissions:', error);
						alert('Failed to fetch permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

			{/* #endregion */}
		</div>
	);
	// #endregion
};

export default Rbac;