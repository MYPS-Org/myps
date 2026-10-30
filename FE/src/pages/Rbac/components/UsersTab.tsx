import React from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/16/solid';
import { AdjustmentsVerticalIcon } from '@heroicons/react/20/solid';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { Badge } from '../../../components/tailwindui/badge';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import type { Users, UserFilter } from '../Model.d';
import type { ListPager } from '../useRbac';
import { useAuth } from '../../../contexts/AuthContext';

interface UsersTabProps {
	pager: ListPager<UserFilter, Users>;
	expandedUserGroups: Set<number>;
	onClear: () => void;
	onExpand: (e: React.MouseEvent, id: number) => void;
	onOpenFilter: () => void;
	onAddUser: () => void;
	onEdit: (id: number) => void;
	onDelete: (id: number) => void;
}

const getStatusBadge = (status: boolean) =>
	status ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>;

export const UsersTab: React.FC<UsersTabProps> = ({
	pager,
	expandedUserGroups,
	onClear,
	onExpand,
	onOpenFilter,
	onAddUser,
	onEdit,
	onDelete,
}) => {
	const { user: sessionUser } = useAuth();
	const isOwnRow = (userId?: string | null) =>
		!!sessionUser?.UserId && !!userId && sessionUser.UserId.toLowerCase() === userId.toLowerCase();
	const data = pager.data;
	const filters = pager.currentFilters;
	const hasActiveFilter =
		!!(filters?.Name || filters?.UserGroup || filters?.IsActive !== undefined);

	const activeFilterCount = [
		filters?.Name,
		filters?.UserGroup,
		filters?.IsActive !== undefined ? 'isActive' : null,
	].filter(Boolean).length;

	return (
		<div className="overflow-hidden">
			<div className="px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-medium text-gray-900">Users</h3>
					<div className="flex items-center space-x-3">
						{hasActiveFilter && (
							<Button color="red" className="shadow-md" onClick={onClear}>
								Clear Filters
							</Button>
						)}
						<Button
							color="white"
							className={`shadow-md ${hasActiveFilter ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
							onClick={onOpenFilter}
						>
							<AdjustmentsVerticalIcon className="w-4 h-4 mr-1" />
							Filter
							{activeFilterCount > 0 && (
								<span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
									{activeFilterCount}
								</span>
							)}
						</Button>
						<Button color="blue" onClick={onAddUser}>
							<PlusIcon className="w-4 h-4 mr-1" />
							Add User
						</Button>
					</div>
				</div>
			</div>

			<Table className="px-5">
				<TableHead className="text-xl">
					{/* 2026-10-30: no sort arrows -- ShowUsers always lists newest first (keyset on Id), so
					    a header click re-fetched the same order. */}
					<TableRow>
						<TableHeader className="text-gray-500">User</TableHeader>
						<TableHeader className="text-gray-500">UserGroup</TableHeader>
						<TableHeader className="text-gray-500">Region</TableHeader>
						<TableHeader className="text-gray-500">Office</TableHeader>
						<TableHeader className="text-gray-500">Status</TableHeader>
						<TableHeader className="text-gray-500">Actions</TableHeader>
					</TableRow>
				</TableHead>
				<TableBody>
					{data.lists.map((user, index) => (
						<TableRow
							key={user.Id}
							className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
						>
							<TableCell className="max-w-[180px]">
								<div className="flex items-center space-x-3s">
									<div className="min-w-0">
										<div className="font-medium text-gray-900 truncate" title={user.Name}>{user.Name}</div>
										<div className="text-sm text-gray-500 truncate" title={user.UserId}>{user.UserId}</div>
										{user.Email?.trim() && <div className="text-xs text-gray-400 truncate" title={user.Email.trim()}>{user.Email.trim()}</div>}
									</div>
								</div>
							</TableCell>
							<TableCell className="max-w-[200px]">
								<div className="flex flex-wrap gap-1">
									{(() => {
									const userGroups = user.UserGroupNames || [];
										const isExpanded = expandedUserGroups.has(user.Id);
										const visibleGroups = isExpanded ? userGroups : userGroups.slice(0, 3);
										return (
											<>
												{visibleGroups.map((group: string, i: number) => (
													<Badge key={i} color="blue" className="text-xs max-w-[160px] truncate" title={group.trim()}>{group.trim()}</Badge>
												))}
												{userGroups.length > 3 && (
													<Badge
														color={isExpanded ? 'red' : 'green'}
														className="text-xs cursor-pointer hover:opacity-75 transition-opacity"
														onClick={(e) => onExpand(e, user.Id)}
													>
														{isExpanded ? 'Show less' : `+${userGroups.length - 3} more`}
													</Badge>
												)}
											</>
										);
									})()}
								</div>
							</TableCell>
							<TableCell className="max-w-[140px]">
								{user.RegName?.trim() && <Badge color="zinc" className="max-w-full truncate block" title={user.RegName.trim()}>{user.RegName.trim()}</Badge>}
							</TableCell>
							<TableCell className="max-w-[160px]">
								{user.PlantillaOfficeName?.trim() && <Badge color="blue" className="max-w-full truncate block" title={user.PlantillaOfficeName.trim()}>{user.PlantillaOfficeName.trim()}</Badge>}
							</TableCell>
							<TableCell>
								{getStatusBadge(user.IsActive ?? false)}
							</TableCell>
							<TableCell>
								<div className="flex items-center space-x-2">
									<Button color="yellow" className="p-2" onClick={() => onEdit(user.Id)}>
										<PencilIcon className="w-4 h-4" />
									</Button>
									{/* 2026-10-31: the server refuses deleting the signed-in account. */}
									<Button
										color="red"
										className="p-2"
										onClick={() => onDelete(user.Id)}
										disabled={isOwnRow(user.UserId)}
										title={isOwnRow(user.UserId) ? 'You cannot delete your own account.' : undefined}
									>
										<TrashIcon className="w-4 h-4" />
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<PaginationBar
				currentPage={data.page}
				totalPages={data.totalPages}
				hasPrevious={pager.hasPrevious}
				hasNext={pager.hasNext}
				onGoToPage={pager.goToPage}
				onNext={pager.goNext}
				onPrevious={pager.goPrevious}
				onFirst={pager.goFirst}
				onLast={pager.goLast}
				isLoading={pager.isLoading}
			/>

			<div className="mb-3.5 text-center">
				{data.lists.length > 0 ? (
					<p className="text-sm text-gray-500">
						{/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
						Showing {data.limit * (data.page - 1) + 1} to{' '}
						{Math.min(data.limit * data.page, data.total)} of {data.total} users
						*/}
					</p>
				) : (
					<p className="text-sm text-gray-500">No users found</p>
				)}
			</div>
		</div>
	);
};
