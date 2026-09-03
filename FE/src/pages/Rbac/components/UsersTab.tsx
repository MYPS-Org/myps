import React from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/16/solid';
import { AdjustmentsVerticalIcon } from '@heroicons/react/20/solid';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { Badge } from '../../../components/tailwindui/badge';
import {
	Pagination,
	PaginationList,
	PaginationNext,
	PaginationPage,
	PaginationPrevious,
} from '../../../components/tailwindui/pagination';
import type { Users, UserPagination } from '../Model.d';

interface UsersTabProps {
	data: PaginationResponse<Users>;
	filter: UserPagination;
	sortDirection: 0 | 1 | null;
	expandedUserGroups: Set<number>;
	onSort: (field: number, direction: 0 | 1 | null) => void;
	onClear: () => void;
	onPaginate: (page: number) => void;
	onExpand: (e: React.MouseEvent, id: number) => void;
	onOpenFilter: () => void;
	onAddUser: () => void;
	onEdit: (id: number) => void;
	onDelete: (id: number) => void;
}

const getStatusBadge = (status: boolean) =>
	status ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>;

export const UsersTab: React.FC<UsersTabProps> = ({
	data,
	filter,
	sortDirection,
	expandedUserGroups,
	onSort,
	onClear,
	onPaginate,
	onExpand,
	onOpenFilter,
	onAddUser,
	onEdit,
	onDelete,
}) => {
	const hasActiveFilter =
		!!(filter.filters?.Name || filter.filters?.UserGroup || filter.filters?.IsActive !== undefined);

	const activeFilterCount = [
		filter.filters?.Name,
		filter.filters?.UserGroup,
		filter.filters?.IsActive !== undefined ? 'isActive' : null,
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
					<TableRow>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(0, dir)} className="text-gray-500">
							User
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(1, dir)} className="text-gray-500">
							UserGroup
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(2, dir)} className="text-gray-500">
							Region
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(3, dir)} className="text-gray-500">
							Office
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(4, dir)} className="text-gray-500">
							Status
						</TableHeader>
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
									<Button color="red" className="p-2" onClick={() => onDelete(user.Id)}>
										<TrashIcon className="w-4 h-4" />
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<Pagination className="my-6">
				{data.totalPages > 1 && (
					<>
						<PaginationPrevious onClick={() => onPaginate(1)} disabled={data.page <= 1}>
							First
						</PaginationPrevious>
						<PaginationList>
							{Array.from({ length: Math.min(7, data.totalPages) }, (_, index) => {
								const pageNum = Math.max(1, data.page - 3) + index;
								if (pageNum > data.totalPages) return null;
								if (pageNum === data.page) {
									return <PaginationPage key={pageNum} current>{pageNum}</PaginationPage>;
								}
								return (
									<PaginationPage key={pageNum} onClick={() => onPaginate(pageNum)}>
										{pageNum}
									</PaginationPage>
								);
							})}
						</PaginationList>
						<PaginationNext onClick={() => onPaginate(data.totalPages)} disabled={data.page >= data.totalPages}>
							Last
						</PaginationNext>
					</>
				)}
			</Pagination>

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
