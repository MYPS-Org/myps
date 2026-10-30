'use-client'
// import React, { use } from 'react';

import { Heading } from '../../components/tailwindui/heading';
import { UsersIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import { Badge } from '../../components/tailwindui/badge';
import { CogIcon } from '@heroicons/react/24/outline';

// State hook
import { useRbac, EMPTY_USER_FILTER, EMPTY_GROUP_FILTER, type DefaultModelKey, type ListPager } from './useRbac';

// Tab components
import { AppModuleTable } from './components/AppModuleTab';
import { UsersTab } from './components/UsersTab';
import { UserGroupsTab } from './components/UserGroupsTab';

// import { useToast } from '../../components/toaster/ToasterContext';

// Dialog imports
import {
	AddUserDialog, AddGroupDialog,
	ViewUserDialog, UpdateUserDialog, DeleteUserDialog,
	ViewGroupDialog, UpdateGroupDialog, DeleteGroupDialog,
	FilterUserDialog, FilterUserGroupDialog,
} from './dialogs';

// 2026-10-30: after a change the list is fetched again instead of patched locally. A local patch
// gave a newly added user Id = list length + 1 -- another user's Id -- so its Delete deleted them.
// A new row has the highest Id, so it is on page 1 of the newest-first list.
const reloadFirstPage = <F, T>(pager: ListPager<F, T>, empty: F) => pager.applyFilters(pager.currentFilters ?? empty);
// The page the row was deleted from may no longer exist once its last row is gone.
const reloadAfterDelete = <F, T>(pager: ListPager<F, T>) => {
	if (pager.data.lists.length <= 1 && pager.data.page > 1) pager.goPrevious();
	else pager.refresh();
};

const Rbac: React.FC = () => {
	const {
		selectedTab,
		usersPager,
		userGroupsPager,
		modulesPager,
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
		isFilterUserDialogOpen, setIsFilterUserDialogOpen,
		isUserGroupFilterDialogOpen, setIsUserGroupFilterDialogOpen,
		expandedUserGroups,
		userGroupDropdowns,
		userGroupList,
		tabNumbers,
		handleClear,
		handleExpand,
		getTableData,
	} = useRbac();

	// const { showToast } = useToast();

	const TabButton = ({
		label,
		value,
		icon: Icon,
		count,
	}: {
		label: string;
		value: DefaultModelKey | 'modules';
		icon: React.ComponentType<{ className?: string }>;
		count: number;
	}) => (
		<button
			onClick={() => { if (selectedTab !== value) getTableData(value as DefaultModelKey); }}
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
					<Heading level={1}>User Management</Heading>
					<p className="text-gray-600 mt-1">
						Manage users, API permissions, route permissions, and user groups
					</p>
				</div>
			</div>

			{/* Tab Navigation */}
			<div className="flex space-x-2 p-1 bg-white shadow-md rounded-lg">
				<TabButton label="App Modules" value="modules"    icon={CogIcon}       count={modulesPager.data.total} />
				<TabButton label="Users"       value="users"      icon={UsersIcon}     count={tabNumbers.users} />
				<TabButton label="User Groups" value="userGroups" icon={UserGroupIcon} count={tabNumbers.userGroups} />
			</div>

			{/* Content Area */}
			<div className="bg-white rounded-lg shadow-sm border border-gray-200">
{selectedTab === 'modules' && (
				<AppModuleTable
					pager={modulesPager}
				/>
			)}

				{selectedTab === 'users' && (
					<UsersTab
						pager={usersPager}
						expandedUserGroups={expandedUserGroups}
						onClear={handleClear}
						onExpand={handleExpand}
						onOpenFilter={() => setIsFilterUserDialogOpen(true)}
						onAddUser={() => setIsAddUserDialogOpen(true)}
						onEdit={(id) => { setSelectedUserId(id); setIsUpdateUserDialogOpen(true); }}
						onDelete={(id) => { setSelectedUserId(id); setIsDeleteUserDialogOpen(true); }}
					/>
				)}

				{selectedTab === 'userGroups' && (
					<UserGroupsTab
						pager={userGroupsPager}
						onClear={handleClear}
						onOpenFilter={() => setIsUserGroupFilterDialogOpen(true)}
						onAddGroup={() => setIsAddGroupDialogOpen(true)}
						onEdit={(id) => { setSelectedGroupId(id); setIsUpdateGroupDialogOpen(true); }}
						onDelete={(id) => { setSelectedGroupId(id); setIsDeleteGroupDialogOpen(true); }}
					/>
				)}

			</div>

			{/* ===== Dialogs ===== */}

			<AddUserDialog
				isOpen={isAddUserDialogOpen}
				onClose={() => setIsAddUserDialogOpen(false)}
				onSubmit={() => reloadFirstPage(usersPager, EMPTY_USER_FILTER)}
			/>

			<AddGroupDialog
				isOpen={isAddGroupDialogOpen}
				onClose={() => setIsAddGroupDialogOpen(false)}
				onSubmit={() => reloadFirstPage(userGroupsPager, EMPTY_GROUP_FILTER)}
			/>

			{isViewUserDialogOpen && selectedUserId && (
				<ViewUserDialog
					isOpen={isViewUserDialogOpen}
					onClose={() => { setIsViewUserDialogOpen(false); setSelectedUserId(null); }}
					user={usersPager.data.lists.find(u => u.Id === selectedUserId)!}
				/>
			)}

			{isUpdateUserDialogOpen && selectedUserId && (
				<UpdateUserDialog
					isOpen={isUpdateUserDialogOpen}
					onClose={() => { setIsUpdateUserDialogOpen(false); setSelectedUserId(null); }}
					user={usersPager.data.lists.find(u => u.Id === selectedUserId)!}
					onSubmit={() => usersPager.refresh()}
				/>
			)}

			{isDeleteUserDialogOpen && selectedUserId && (
				<DeleteUserDialog
					isOpen={isDeleteUserDialogOpen}
					onClose={() => { setIsDeleteUserDialogOpen(false); setSelectedUserId(null); }}
					user={usersPager.data.lists.find(u => u.Id === selectedUserId)!}
					onSubmit={() => reloadAfterDelete(usersPager)}
				/>
			)}

			{isViewGroupDialogOpen && selectedGroupId && (
				<ViewGroupDialog
					isOpen={isViewGroupDialogOpen}
					onClose={() => { setIsViewGroupDialogOpen(false); setSelectedGroupId(null); }}
					group={userGroupsPager.data.lists.find(g => g.Id === selectedGroupId)!}
				/>
			)}

			{isUpdateGroupDialogOpen && selectedGroupId && (
				<UpdateGroupDialog
					isOpen={isUpdateGroupDialogOpen}
					onClose={() => { setIsUpdateGroupDialogOpen(false); setSelectedGroupId(null); }}
					group={userGroupsPager.data.lists.find(g => g.Id === selectedGroupId)!}				dropdowns={userGroupDropdowns}					onSubmit={() => userGroupsPager.refresh()}
				/>
			)}

			{isDeleteGroupDialogOpen && selectedGroupId && (
				<DeleteGroupDialog
					isOpen={isDeleteGroupDialogOpen}
					onClose={() => { setIsDeleteGroupDialogOpen(false); setSelectedGroupId(null); }}
					group={userGroupsPager.data.lists.find(g => g.Id === selectedGroupId)!}
					onSubmit={() => reloadAfterDelete(userGroupsPager)}
				/>
			)}

			{isFilterUserDialogOpen && (
				<FilterUserDialog
					isOpen={isFilterUserDialogOpen}
					onClose={() => setIsFilterUserDialogOpen(false)}				userGroupOptions={userGroupList}					onSubmit={(filterData) => usersPager.applyFilters(filterData)}
					onClear={() => usersPager.applyFilters(EMPTY_USER_FILTER)}
					initialData={usersPager.currentFilters}
				/>
			)}

			{isUserGroupFilterDialogOpen && (
				<FilterUserGroupDialog
					isOpen={isUserGroupFilterDialogOpen}
					onClose={() => setIsUserGroupFilterDialogOpen(false)}
					onSubmit={(filterData) => userGroupsPager.applyFilters(filterData)}
					// 2026-10-30: Clear used to refetch without clearing the stored filter, so the next
					// page or refresh brought the old filter back.
					onClear={() => userGroupsPager.applyFilters(EMPTY_GROUP_FILTER)}
					initialData={userGroupsPager.currentFilters}
				/>
			)}

		</div>
	);
};

export default Rbac;
