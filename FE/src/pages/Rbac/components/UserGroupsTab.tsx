import React from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/16/solid';
import { AdjustmentsVerticalIcon, UsersIcon } from '@heroicons/react/20/solid';
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
import type { vUserGroups, UserGroupPagination } from '../Model.d';

interface UserGroupsTabProps {
	data: PaginationResponse<vUserGroups>;
	filter: UserGroupPagination;
	sortDirection: 0 | 1 | null;
	expandedUserGroups: Set<number>;
	permissionViewsLookup: Record<number, string>;
	onSort: (field: number, direction: 0 | 1 | null) => void;
	onClear: () => void;
	onPaginate: (page: number) => void;
	onExpand: (e: React.MouseEvent, id: number) => void;
	onOpenFilter: () => void;
	onAddGroup: () => void;
	onEdit: (id: number) => void;
	onDelete: (id: number) => void;
}

export const UserGroupsTab: React.FC<UserGroupsTabProps> = ({
	data,
	filter,
	sortDirection,
	expandedUserGroups,
	permissionViewsLookup,
	onSort,
	onClear,
	onPaginate,
	onExpand,
	onOpenFilter,
	onAddGroup,
	onEdit,
	onDelete,
}) => {
	const hasActiveFilter = !!(filter.filters?.GroupName || filter.filters?.PermissionNames);

	const activeFilterCount = [filter.filters?.GroupName, filter.filters?.PermissionNames].filter(Boolean).length;

	return (
		<div className="overflow-hidden">
			<div className="px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-medium text-gray-900">User Groups</h3>
					<div className="flex items-center space-x-3">
						{hasActiveFilter && (
							<Button color="red" onClick={onClear}>
								Clear Filter
							</Button>
						)}
						<Button
							color="white"
							className={`shadow-md ${hasActiveFilter ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
							onClick={onOpenFilter}
						>
							<AdjustmentsVerticalIcon className="w-4 h-4 mr-1" />
							Filter Group
							{activeFilterCount > 0 && (
								<span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
									{activeFilterCount}
								</span>
							)}
						</Button>
						<Button color="blue" onClick={onAddGroup}>
							<PlusIcon className="w-4 h-4 mr-1" />
							Add Group
						</Button>
					</div>
				</div>
			</div>

			<Table className="px-5">
				<TableHead className="text-[20px]">
					<TableRow className="text-center">
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(0, dir)} className="text-gray-700">
							Group Name
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(1, dir)} className="text-gray-700">
							Members
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(2, dir)} className="text-gray-700">
							Permissions
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(3, dir)} className="text-gray-700">
							Description
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(4, dir)} className="text-gray-700">
							Created
						</TableHeader>
						<TableHeader className="text-gray-700">Actions</TableHeader>
					</TableRow>
				</TableHead>
				<TableBody>
					{data.lists.map((group, index) => (
						<TableRow
							key={group.Id}
							className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}
						>
							<TableCell>
								<div className="font-medium text-gray-900">{group.GroupName}</div>
							</TableCell>
							<TableCell>
								<div className="flex items-center space-x-2">
									<UsersIcon className="w-4 h-4 text-gray-400" />
									<span className="text-gray-900 font-medium">{group.NumberOfUsers}</span>
								</div>
							</TableCell>
							<TableCell>
								<div className="flex flex-wrap gap-1">
									{(() => {
										const isExpanded = expandedUserGroups.has(group.Id);
										const permIds = group.PermissionViewIds || [];
										const visiblePerms = isExpanded ? permIds : permIds.slice(0, 2);
										if (permIds.length === 0) {
											return <Badge color="zinc" className="text-xs">No permissions</Badge>;
										}
										return (
											<>
												{visiblePerms.map((id: number, i: number) => (
													<Badge key={i} color="blue" className="text-xs" title={`ID: ${id}`}>
														{permissionViewsLookup[id] || `ID: ${id}`}
													</Badge>
												))}
												{permIds.length > 2 && (
													<Badge
														color={isExpanded ? 'red' : 'green'}
														className="text-xs cursor-pointer hover:opacity-75 transition-opacity"
														onClick={(e) => onExpand(e, group.Id)}
													>
														{isExpanded ? 'Show less' : `+${permIds.length - 2} more`}
													</Badge>
												)}
											</>
										);
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
									day: 'numeric',
								})}
							</TableCell>
							<TableCell>
								<div className="flex justify-center space-x-2">
									<Button color="yellow" className="p-2" onClick={() => onEdit(group.Id)}>
										<PencilIcon className="w-4 h-4" />
									</Button>
									<Button color="red" className="p-2" onClick={() => onDelete(group.Id)}>
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
						Showing {data.limit * (data.page - 1) + 1} to{' '}
						{Math.min(data.limit * data.page, data.total)} of {data.total} user groups
					</p>
				) : (
					<p className="text-sm text-gray-500">No user groups found</p>
				)}
			</div>
		</div>
	);
};
