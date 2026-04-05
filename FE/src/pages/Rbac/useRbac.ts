import { useEffect, useState } from 'react';
import type {
	Users,
	UserPagination,
	UserGroupPagination,
	vUserGroups,
	AppModules,
	ShowAppModulesPagination,
	UserGroupDropdowns,
} from './Model.d';
import {
	fetchInitialData,
	fetchUsers,
	fetchUserGroups,
	fetchUserGroupDropdowns,
	getAppModules,
} from './service';

export type DefaultModelKey = 'users' | 'userGroups' | 'modules';

export function useRbac() {
	const [selectedTab, setSelectedTab] = useState<DefaultModelKey>('users');

	const [UsersData, setUsersData] = useState<PaginationResponse<Users>>({
		lists: [], page: 1, limit: 20, total: 0, totalPages: 0,
	});
	const [ModulesData, setModulesData] = useState<PaginationResponse<AppModules>>({
		lists: [], page: 1, limit: 20, total: 0, totalPages: 0,
	});
	const [UserGroupsData, setUserGroups] = useState<PaginationResponse<vUserGroups>>({
		lists: [], page: 1, limit: 20, total: 0, totalPages: 0,
	});

	// Dialog open states
	const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
	const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
	const [isViewUserDialogOpen, setIsViewUserDialogOpen] = useState(false);
	const [isUpdateUserDialogOpen, setIsUpdateUserDialogOpen] = useState(false);
	const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [isViewGroupDialogOpen, setIsViewGroupDialogOpen] = useState(false);
	const [isUpdateGroupDialogOpen, setIsUpdateGroupDialogOpen] = useState(false);
	const [isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen] = useState(false);
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

	// Filter dialog states
	const [isFilterUserDialogOpen, setIsFilterUserDialogOpen] = useState(false);
	const [isUserGroupFilterDialogOpen, setIsUserGroupFilterDialogOpen] = useState(false);

	const [expandedUserGroups, setExpandedUserGroups] = useState<Set<number>>(new Set());

	const [UserFilter, setUserFilter] = useState<UserPagination>({
		filters: { Name: '', UserGroup: '', IsActive: undefined },
		sortField: '', sortDirection: 1, page: 1, limit: 20,
	});
	const [UserGroupFilter, setUserGroupFilter] = useState<UserGroupPagination>({
		filters: { GroupName: '', PermissionNames: '' },
		sortField: '', sortDirection: 1, page: 1, limit: 20,
	});

	const [ShowAppModulesFilter, setShowAppModulesFilter] = useState<ShowAppModulesPagination>({
		filters: { ModuleName: '' },
		sortField: '', sortDirection: 1, page: 1, limit: 20,
	});


	const [isLoadingModules, setIsLoadingModules] = useState(false);
	const [isLoadingUserGroups, setIsLoadingUserGroups] = useState(false);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [permissionViewsLookup, setPermissionViewsLookup] = useState<Record<number, string>>({});
	const [userGroupDropdowns, setUserGroupDropdowns] = useState<UserGroupDropdowns>({
		AppModules: [], PermissionControllers: [], PermissionActions: [], PermissionViews: [],
	});
	const [tabNumbers, setTabNumbers] = useState({
		users: 0, modules: 0, userGroups: 0,
	});
	const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const [initialData, dropdownsRes] = await Promise.all([
					fetchInitialData(),
					fetchUserGroupDropdowns(),
				]);
				setTabNumbers({
					users: initialData.Data.NumberOfUsers || 0,
					modules: 0,
					userGroups: initialData.Data.NumberOfGroups || 0,
				});
				if (initialData.Data.Users) {
					setUsersData({
						lists: initialData.Data.Users || [],
						page: 1,
						limit: 20,
						total: initialData.Data.NumberOfUsers,
						totalPages: Math.ceil(initialData.Data.NumberOfUsers / 10),
					});
				}
				if (dropdownsRes.Data) {
					setUserGroupDropdowns(dropdownsRes.Data);
					if (dropdownsRes.Data.PermissionViews) {
						const lookup: Record<number, string> = {};
						dropdownsRes.Data.PermissionViews.forEach((pv: any) => {
							lookup[pv.Id] = pv.RouteName || pv.Description || pv.RoutePath || `ID: ${pv.Id}`;
						});
						setPermissionViewsLookup(lookup);
					}
				}
				console.log('Initial data fetched:', initialData);
			} catch (error: any) {
				console.error('Error fetching initial data:', error);
			}
		};
		fetchData();
	}, []);

	const handleAutoRefresh = async (
		filterData: UserPagination | UserGroupPagination,
	) => {
		try {
			if (selectedTab === 'users') {
				setIsLoadingUsers(true);
				console.log('Auto-refreshing users after dialog submission');
				const res = await fetchUsers(filterData as UserPagination);
				if (res.Data.lists) { console.log('Setting updated users data:', res); setUsersData(res.Data); }
		} else if (selectedTab === 'userGroups') {
				setIsLoadingUserGroups(true);
				console.log('Auto-refreshing user groups after dialog submission');
				const res = await fetchUserGroups(filterData as UserGroupPagination);
				if (res.Data.lists) { console.log('Setting updated userGroups data:', res); setUserGroups(res.Data); }
			}
		} catch (error) {
			console.error(`Error auto-refreshing ${selectedTab}:`, error);
			throw error;
		} finally {
			if (selectedTab === 'users') setIsLoadingUsers(false);
			else if (selectedTab === 'userGroups') setIsLoadingUserGroups(false);
		}
	};

	const handleClear = () => {
		if (selectedTab === 'users') {
			const newFilter: UserPagination = {
				...UserFilter,
				filters: { ...UserFilter.filters, Name: '', UserGroup: '', IsActive: undefined },
			};
			setUserFilter(newFilter);
			try { handleAutoRefresh(newFilter); } catch (error) { console.error('Error clearing user filter:', error); }
		}
		if (selectedTab === 'userGroups') {
			const newFilter: UserGroupPagination = {
				...UserGroupFilter,
				filters: { ...UserGroupFilter.filters, GroupName: '', PermissionNames: '' },
			};
			setUserGroupFilter(newFilter);
			try { handleAutoRefresh(newFilter); } catch (error) { console.error('Error clearing user group filter:', error); }
		}
	};

	const handleExpand = (e: React.MouseEvent, id: number) => {
		e.preventDefault();
		e.stopPropagation();
		setExpandedUserGroups(prev => {
			const newSet = new Set(prev);
			if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
			return newSet;
		});
	};

	const handleSort = async (field: number, direction: 0 | 1 | null) => {
		setSortDirection(direction);

		if (selectedTab === 'userGroups') {
			const newFilter: UserGroupPagination = {
				...UserGroupFilter,
				sortField: field === 0 ? 'GroupName' : '',
				sortDirection: (direction || 0) as 0 | 1,
				page: 1,
			};
			setUserGroupFilter(newFilter);
			try {
				setIsLoadingUserGroups(true);
				const res = await fetchUserGroups(newFilter);
				console.log('UserGroups response:', res);
				if (res.Data.lists) { console.log('Setting userGroups data:', res); setUserGroups(res.Data); }
			} catch (error) {
				console.error('Error fetching userGroups:', error);
			} finally {
				setIsLoadingUserGroups(false);
			}
		} else if (selectedTab === 'users') {
			const newFilter: UserPagination = {
				...UserFilter,
				sortField: field === 0 ? 'Name' : field === 1 ? 'Email' : field === 2 ? 'Office' : field === 3 ? 'Status' : '',
				sortDirection: (direction || 0) as 0 | 1,
				page: 1,
			};
			setUserFilter(newFilter);
			try {
				setIsLoadingUsers(true);
				console.log('Fetching users with new sort:', newFilter);
				const res = await fetchUsers(newFilter);
				console.log('Users response:', res);
				if (res.Data.lists) { console.log('Setting users data:', res); setUsersData(res.Data); }
			} catch (error) {
				console.error('Error fetching users:', error);
			} finally {
				setIsLoadingUsers(false);
			}
		}
	};

	const getTableData = async (tabName: DefaultModelKey) => {
		console.log('Switching to tab:', tabName);
		setSelectedTab(tabName);

		if (tabName === 'modules') {
			if (isLoadingModules) { console.log('Already loading modules, skipping request'); return; }
			try {
				setIsLoadingModules(true);
				console.log('Fetching app modules');
				const res = await getAppModules(ShowAppModulesFilter);
				console.log('App modules response:', res);
				if (res.Data) { setModulesData(res.Data); setTabNumbers(prev => ({ ...prev, modules: res.Data.total })); }
			} catch (error) {
				console.error('Error fetching modules:', error);
				alert('Failed to fetch modules: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingModules(false);
			}
		} else if (tabName === 'users') {
			if (isLoadingUsers) { console.log('Already loading users, skipping request'); return; }
			try {
				setIsLoadingUsers(true);
				console.log('Fetching users with current filter:', UserFilter);
				const res = await fetchUsers(UserFilter);
				console.log('Users response:', res);
				if (res.Data.lists) { console.log('Setting users data:', res); setUsersData(res.Data); }
			} catch (error) {
				console.error('Error fetching users:', error);
				alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUsers(false);
			}
		} else if (tabName === 'userGroups') {
			if (isLoadingUserGroups) { console.log('Already loading user groups, skipping request'); return; }
			try {
				setIsLoadingUserGroups(true);
				console.log('Fetching user groups with current filter:', UserGroupFilter);
				const res = await fetchUserGroups(UserGroupFilter);
				console.log('UserGroups response:', res);
				if (res.Data.lists) { console.log('Setting userGroups data:', res); setUserGroups(res.Data); }
			} catch (error) {
				console.error('Error fetching userGroups:', error);
				alert('Failed to fetch userGroups: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUserGroups(false);
			}
		}
	};

	const Paginate = async (page: number) => {
		if (selectedTab === 'users') {
			const newFilter: UserPagination = { ...UserFilter, page };
			setUserFilter(newFilter);
			try {
				setIsLoadingUsers(true);
				console.log('Fetching users for page:', page, 'with filter:', newFilter);
				const res = await fetchUsers(newFilter);
				console.log('Users response:', res);
				if (res.Data.lists) { console.log('Setting users data:', res); setUsersData(res.Data); }
			} catch (error) {
				console.error('Error fetching users:', error);
				alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUsers(false);
			}
		} else if (selectedTab === 'userGroups') {
			const newFilter: UserGroupPagination = { ...UserGroupFilter, page };
			setUserGroupFilter(newFilter);
			try {
				setIsLoadingUserGroups(true);
				console.log('Fetching user groups for page:', page, 'with filter:', newFilter);
				const res = await fetchUserGroups(newFilter);
				console.log('UserGroups response:', res);
				if (res.Data.lists) { console.log('Setting userGroups data:', res); setUserGroups(res.Data); }
			} catch (error) {
				console.error('Error fetching user groups:', error);
				alert('Failed to fetch user groups: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingUserGroups(false);
			}
		} else if (selectedTab === 'modules') {
			const newFilter: ShowAppModulesPagination = { ...ShowAppModulesFilter, page };
			setShowAppModulesFilter(newFilter);
			try {
				setIsLoadingModules(true);
				const res = await getAppModules(newFilter);
				if (res.Data.lists) { setModulesData(res.Data); }
			} catch (error) {
				console.error('Error fetching modules:', error);
				alert('Failed to fetch modules: ' + (error instanceof Error ? error.message : 'Unknown error'));
			} finally {
				setIsLoadingModules(false);
			}
		}
	};

	return {
		// Tab
		selectedTab, setSelectedTab,
		// Data
		UsersData, setUsersData,
		ModulesData, setModulesData,
		UserGroupsData, setUserGroups,
		// Dialog states
		isAddUserDialogOpen, setIsAddUserDialogOpen,
		isAddGroupDialogOpen, setIsAddGroupDialogOpen,
		isViewUserDialogOpen, setIsViewUserDialogOpen,
		isUpdateUserDialogOpen, setIsUpdateUserDialogOpen,
		isDeleteUserDialogOpen, setIsDeleteUserDialogOpen,
		selectedUserId, setSelectedUserId,
		isViewGroupDialogOpen, setIsViewGroupDialogOpen,
		isUpdateGroupDialogOpen, setIsUpdateGroupDialogOpen,
		isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen,
		selectedGroupId, setSelectedGroupId,
		// Filter dialog states
		isFilterUserDialogOpen, setIsFilterUserDialogOpen,
		isUserGroupFilterDialogOpen, setIsUserGroupFilterDialogOpen,
		// Expand state
		expandedUserGroups,
		// Filters
		UserFilter, setUserFilter,
		UserGroupFilter, setUserGroupFilter,
		ShowAppModulesFilter, setShowAppModulesFilter,
		// Loading
		isLoadingModules,
		isLoadingUserGroups,
		isLoadingUsers,
		// Lookup
		permissionViewsLookup,
		userGroupDropdowns,
		tabNumbers,
		sortDirection,
		// Handlers
		handleClear,
		handleExpand,
		handleAutoRefresh,
		handleSort,
		getTableData,
		Paginate,
	};
}
