'use-client'
// import React, { use } from 'react';

import { Heading } from '../../components/tailwindui/heading';
import { UsersIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import { Badge } from '../../components/tailwindui/badge';
import { CogIcon } from '@heroicons/react/24/outline';

// State hook
import { useRbac, type DefaultModelKey } from './useRbac';

// Tab components
import { AppModuleTable } from './components/AppModuleTab';
import { UsersTab } from './components/UsersTab';
import { UserGroupsTab } from './components/UserGroupsTab';

// import { useToast } from '../../components/toaster/ToasterContext';

// Interfaces
import type { vUserGroups, UserPagination, UserGroupPagination } from './Model.d';

// Dialog imports
import {
	AddUserDialog, AddGroupDialog,
	ViewUserDialog, UpdateUserDialog, DeleteUserDialog,
	ViewGroupDialog, UpdateGroupDialog, DeleteGroupDialog,
	FilterUserDialog, FilterUserGroupDialog,
} from './dialogs';

const Rbac: React.FC = () => {
	const {
		selectedTab,
		UsersData, setUsersData,
		ModulesData, setModulesData,
		UserGroupsData, setUserGroups,
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
		UserFilter, setUserFilter,
		UserGroupFilter, setUserGroupFilter,
		isLoadingModules,
		userGroupDropdowns,
		userGroupList,
		tabNumbers,
		sortDirection,
		handleClear,
		handleExpand,
		handleAutoRefresh,
		handleSort,
		getTableData,
		Paginate,
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
				<TabButton label="App Modules" value="modules"    icon={CogIcon}       count={tabNumbers.modules} />
				<TabButton label="Users"       value="users"      icon={UsersIcon}     count={tabNumbers.users} />
				<TabButton label="User Groups" value="userGroups" icon={UserGroupIcon} count={tabNumbers.userGroups} />
			</div>

			{/* Content Area */}
			<div className="bg-white rounded-lg shadow-sm border border-gray-200">
{selectedTab === 'modules' && (
				<AppModuleTable
					data={ModulesData}
					isLoading={isLoadingModules}
					onPaginate={Paginate}
					onDataChange={setModulesData}
				/>
			)}

				{selectedTab === 'users' && (
					<UsersTab
						data={UsersData}
						filter={UserFilter}
						sortDirection={sortDirection}
						expandedUserGroups={expandedUserGroups}
						onSort={handleSort}
						onClear={handleClear}
						onPaginate={Paginate}
						onExpand={handleExpand}
						onOpenFilter={() => setIsFilterUserDialogOpen(true)}
						onAddUser={() => setIsAddUserDialogOpen(true)}
						onEdit={(id) => { setSelectedUserId(id); setIsUpdateUserDialogOpen(true); }}
						onDelete={(id) => { setSelectedUserId(id); setIsDeleteUserDialogOpen(true); }}
					/>
				)}

				{selectedTab === 'userGroups' && (
					<UserGroupsTab
						data={UserGroupsData}
						filter={UserGroupFilter}
						sortDirection={sortDirection}
						onSort={handleSort}
						onClear={handleClear}
						onPaginate={Paginate}
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
				onSubmit={(newUser: any) => {
					const newUserWithId = {
						...newUser,
						Id: (UsersData.lists?.length || 0) + 1,
						CreatedDate: new Date().toLocaleDateString(),
					};
					setUsersData(prev => ({
						...prev,
						lists: [newUserWithId, ...(prev.lists || [])],
						total: (prev.total || 0) + 1,
					}));
				}}
			/>

			<AddGroupDialog
				isOpen={isAddGroupDialogOpen}
				onClose={() => setIsAddGroupDialogOpen(false)}
				onSubmit={async (newGroup: any) => {
					try {
						await handleAutoRefresh(UserGroupFilter);
					} catch (error) {
						console.error('Error refreshing user groups:', error);
						const newGroupWithId: vUserGroups = {
							Id: (UserGroupsData.lists?.length || 0) + 1,
							GroupName: newGroup.GroupName,
							Description: newGroup.Description,						ApplyFilter: false,							ModulePermissions: [],
							NumberOfUsers: 0,
							CreatedBy: '',
							CreatedDate: new Date().toISOString(),
						};
						setUserGroups(prev => ({ ...prev, lists: [...prev.lists, newGroupWithId], total: prev.total + 1 }));
					}
				}}
			/>

			{isViewUserDialogOpen && selectedUserId && (
				<ViewUserDialog
					isOpen={isViewUserDialogOpen}
					onClose={() => { setIsViewUserDialogOpen(false); setSelectedUserId(null); }}
					user={UsersData.lists.find(u => u.Id === selectedUserId)!}
				/>
			)}

			{isUpdateUserDialogOpen && selectedUserId && (
				<UpdateUserDialog
					isOpen={isUpdateUserDialogOpen}
					onClose={() => { setIsUpdateUserDialogOpen(false); setSelectedUserId(null); }}
					user={UsersData.lists.find(u => u.Id === selectedUserId)!}
					onSubmit={(updatedUser: any) => {
						setUsersData(prev => ({
							...prev,
							lists: prev.lists?.map(u => u.Id === updatedUser.Id ? updatedUser : u) || [],
						}));
					}}
				/>
			)}

			{isDeleteUserDialogOpen && selectedUserId && (
				<DeleteUserDialog
					isOpen={isDeleteUserDialogOpen}
					onClose={() => { setIsDeleteUserDialogOpen(false); setSelectedUserId(null); }}
					user={UsersData.lists.find(u => u.Id === selectedUserId)!}
					onSubmit={(deletedUserId: number) => {
						setUsersData(prev => ({
							...prev,
							lists: prev.lists?.filter(u => u.Id !== deletedUserId) || [],
							total: Math.max(0, (prev.total || 1) - 1),
						}));
					}}
				/>
			)}

			{isViewGroupDialogOpen && selectedGroupId && (
				<ViewGroupDialog
					isOpen={isViewGroupDialogOpen}
					onClose={() => { setIsViewGroupDialogOpen(false); setSelectedGroupId(null); }}
					group={UserGroupsData.lists.find(g => g.Id === selectedGroupId)!}
				/>
			)}

			{isUpdateGroupDialogOpen && selectedGroupId && (
				<UpdateGroupDialog
					isOpen={isUpdateGroupDialogOpen}
					onClose={() => { setIsUpdateGroupDialogOpen(false); setSelectedGroupId(null); }}
					group={UserGroupsData.lists.find(g => g.Id === selectedGroupId)!}				dropdowns={userGroupDropdowns}					onSubmit={async (updatedGroup: any) => {
						try {
							await handleAutoRefresh(UserGroupFilter);
						} catch (error) {
							console.error('Error refreshing user groups:', error);
							const existing = UserGroupsData.lists.find(g => g.Id === updatedGroup.id);
							const updatedGroupData: vUserGroups = {
								Id: updatedGroup.id,
								GroupName: updatedGroup.groupName,
								Description: updatedGroup.description,							ApplyFilter: existing?.ApplyFilter ?? false,								ModulePermissions: existing?.ModulePermissions || [],
								NumberOfUsers: existing?.NumberOfUsers || 0,
								CreatedBy: existing?.CreatedBy || '',
								CreatedDate: existing?.CreatedDate || new Date().toISOString(),
							};
							setUserGroups(prev => ({
								...prev,
								lists: prev.lists?.map(g => g.Id === updatedGroup.id ? updatedGroupData : g) || [],
							}));
						}
					}}
				/>
			)}

			{isDeleteGroupDialogOpen && selectedGroupId && (
				<DeleteGroupDialog
					isOpen={isDeleteGroupDialogOpen}
					onClose={() => { setIsDeleteGroupDialogOpen(false); setSelectedGroupId(null); }}
					group={UserGroupsData.lists.find(g => g.Id === selectedGroupId)!}
					onSubmit={(deletedGroupId: number) => {
						setUserGroups(prev => ({
							...prev,
							lists: prev.lists?.filter(g => g.Id !== deletedGroupId) || [],
							total: Math.max(0, (prev.total || 1) - 1),
						}));
					}}
				/>
			)}

			{isFilterUserDialogOpen && (
				<FilterUserDialog
					isOpen={isFilterUserDialogOpen}
					onClose={() => setIsFilterUserDialogOpen(false)}				userGroupOptions={userGroupList}					onSubmit={async (filterData) => {
						console.log('User filter data received:', filterData);
						const newFilter: UserPagination = { ...UserFilter, filters: filterData, page: 1 };
						setUserFilter(newFilter);
						try {
							await handleAutoRefresh(newFilter);
						} catch (error) {
							console.error('Error fetching users:', error);
							alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
						}
					}}
					onClear={async () => {
						console.log('Clearing user filters');
						const newFilter: UserPagination = {
							...UserFilter,
							filters: { Name: '', UserGroup: '', IsActive: undefined },
							page: 1,
						};
						setUserFilter(newFilter);
						try {
							await handleAutoRefresh(newFilter);
						} catch (error) {
							console.error('Error fetching users:', error);
							alert('Failed to fetch users: ' + (error instanceof Error ? error.message : 'Unknown error'));
						}
					}}
					initialData={UserFilter.filters}
				/>
			)}

			{isUserGroupFilterDialogOpen && (
				<FilterUserGroupDialog
					isOpen={isUserGroupFilterDialogOpen}
					onClose={() => setIsUserGroupFilterDialogOpen(false)}
					onSubmit={async (filterData) => {
						console.log('Filter data received:', filterData);
						const newFilter: UserGroupPagination = { ...UserGroupFilter, filters: filterData, page: 1 };
						setUserGroupFilter(newFilter);
						try {
							await handleAutoRefresh(newFilter);
						} catch (error) {
							console.error('Error fetching user groups:', error);
							alert('Failed to fetch user groups: ' + (error instanceof Error ? error.message : 'Unknown error'));
						}
					}}
					onClear={async () => {
						console.log('Clearing user group filters');
						const newFilter: UserGroupPagination = {
							...UserGroupFilter,
							filters: { GroupName: '', PermissionNames: '' },
							page: 1,
						};
						try {
							await handleAutoRefresh(newFilter);
						} catch (error) {
							console.error('Error fetching user groups:', error);
							alert('Failed to fetch user groups: ' + (error instanceof Error ? error.message : 'Unknown error'));
						}
					}}
					initialData={UserGroupFilter.filters}
				/>
			)}

		</div>
	);
};

export default Rbac;