import { useEffect, useState } from 'react';
import type {
	Users,
	UserFilter,
	UserGroupFilter,
	vUserGroups,
	AppModules,
	AppModuleFilter,
	UserGroupDropdowns,
} from './Model.d';
import {
	fetchInitialData,
	fetchUsers,
	fetchUserGroups,
	fetchUserGroupDropdowns,
	getAppModules,
} from './service';
import { usePagination } from '../../hooks/usePagination';

export type DefaultModelKey = 'users' | 'userGroups' | 'modules';

/** What a list tab gets: the shared keyset pager (data, cursors, First/Previous/Next/Last/page). */
export type ListPager<TFilters, TItem> = ReturnType<typeof usePagination<TFilters, TItem>>;

// 2026-10-30: the three lists page through the shared keyset hook, like Program and Lump Sum.
// They used to send only `page`; FilterDataCursor needs a Navigation mode plus its cursor and
// treats a bare page as First, so every page button showed page 1 again. One page size for all
// three: the first Users page came from InitUserManagement (10 rows) while the state said 20.
const PAGE_SIZE = 10;
export const EMPTY_USER_FILTER: UserFilter = { Name: '', UserGroup: '', IsActive: undefined };
export const EMPTY_GROUP_FILTER: UserGroupFilter = { GroupName: '', PermissionNames: '' };
const EMPTY_MODULE_FILTER: AppModuleFilter = { ModuleName: '' };

export function useRbac() {
	const [selectedTab, setSelectedTab] = useState<DefaultModelKey>('users');
	// Users loads on mount; the other two lists on their tab's first visit.
	const [loadedTabs, setLoadedTabs] = useState<Set<DefaultModelKey>>(new Set(['users']));

	const usersPager = usePagination<UserFilter, Users>(fetchUsers, {
		initialFilters: EMPTY_USER_FILTER,
		limit: PAGE_SIZE,
	});
	const userGroupsPager = usePagination<UserGroupFilter, vUserGroups>(fetchUserGroups, {
		initialFilters: EMPTY_GROUP_FILTER,
		limit: PAGE_SIZE,
		enabled: loadedTabs.has('userGroups'),
	});
	const modulesPager = usePagination<AppModuleFilter, AppModules>(getAppModules, {
		initialFilters: EMPTY_MODULE_FILTER,
		limit: PAGE_SIZE,
		enabled: loadedTabs.has('modules'),
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

	const [userGroupDropdowns, setUserGroupDropdowns] = useState<UserGroupDropdowns>({
		AppModules: [], PermissionControllers: [], PermissionActions: [], PermissionViews: [],
	});
	const [tabNumbers, setTabNumbers] = useState({
		users: 0, userGroups: 0,
	});
	const [userGroupList, setUserGroupList] = useState<{ Id: number; GroupName: string }[]>([]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const [initialData, dropdownsRes, groupsRes] = await Promise.all([
					fetchInitialData(),
					fetchUserGroupDropdowns(),
					fetchUserGroups({ page: 1, limit: 1000, sortField: 'GroupName', sortDirection: 0, filters: { GroupName: '' } }),
				]);
				setTabNumbers({
					users: initialData.Data.NumberOfUsers || 0,
					userGroups: initialData.Data.NumberOfGroups || 0,
				});
				if (dropdownsRes.Data) {
					setUserGroupDropdowns(dropdownsRes.Data);
				}
				if (groupsRes.Data?.lists) {
					setUserGroupList(groupsRes.Data.lists.map(g => ({ Id: g.Id, GroupName: g.GroupName })));
				}
			} catch (error) {
				console.error('Error fetching initial data:', error);
			}
		};
		fetchData();
	}, []);

	const handleClear = () => {
		if (selectedTab === 'users') usersPager.applyFilters(EMPTY_USER_FILTER);
		if (selectedTab === 'userGroups') userGroupsPager.applyFilters(EMPTY_GROUP_FILTER);
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

	const getTableData = (tabName: DefaultModelKey) => {
		setSelectedTab(tabName);
		if (!loadedTabs.has(tabName)) {
			// Enabling the tab's pager makes its first fetch.
			setLoadedTabs(prev => new Set(prev).add(tabName));
			return;
		}
		if (tabName === 'users') usersPager.refresh();
		else if (tabName === 'userGroups') userGroupsPager.refresh();
		else modulesPager.refresh();
	};

	return {
		// Tab
		selectedTab, setSelectedTab,
		// Lists
		usersPager,
		userGroupsPager,
		modulesPager,
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
		// Lookup
		userGroupDropdowns,
		userGroupList,
		tabNumbers,
		// Handlers
		handleClear,
		handleExpand,
		getTableData,
	};
}
