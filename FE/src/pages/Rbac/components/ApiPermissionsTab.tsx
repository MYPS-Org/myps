import React from 'react';
import { ArrowPathIcon, PencilIcon, TrashIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/16/solid';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import {
	Pagination,
	PaginationList,
	PaginationNext,
	PaginationPage,
	PaginationPrevious,
} from '../../../components/tailwindui/pagination';
import type { Permissions, PermissionPagination } from '../Model';

interface PermissionsTableProps {
	data: PaginationResponse<Permissions>;
	filter: PermissionPagination;
	sortDirection: 0 | 1 | null;
	isSyncingPermissions: boolean;
	onSort: (field: number, direction: 0 | 1 | null) => void;
	onClear: () => void;
	onSync: () => void;
	onPaginate: (page: number) => void;
	onOpenFilter: () => void;
	onEdit: (id: number) => void;
	onDelete: (id: number) => void;
}

export const PermissionsTable: React.FC<PermissionsTableProps> = ({
	data,
	filter,
	sortDirection,
	isSyncingPermissions,
	onSort,
	onClear,
	onSync,
	onPaginate,
	onOpenFilter,
	onEdit,
	onDelete,
}) => {
	const hasActiveFilter =
		!!(filter.filters?.Module || filter.filters?.ModuleFunction || filter.filters?.ModuleFunctionDescription);

	const activeFilterCount = [
		filter.filters?.Module,
		filter.filters?.ModuleFunction,
		filter.filters?.ModuleFunctionDescription,
	].filter(Boolean).length;

	return (
		<div className="overflow-hidden">
			<div className="px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-medium text-gray-900">Permissions</h3>
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
							<AdjustmentsHorizontalIcon className="w-4 h-4 mr-1" />
							Filter
							{activeFilterCount > 0 && (
								<span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
									{activeFilterCount}
								</span>
							)}
						</Button>
						<Button color="blue" onClick={onSync} disabled={isSyncingPermissions}>
							<ArrowPathIcon className={`w-4 h-4 mr-1 ${isSyncingPermissions ? 'animate-spin' : ''}`} />
							{isSyncingPermissions ? 'Syncing...' : 'Sync Permissions'}
						</Button>
					</div>
				</div>
			</div>

			<Table className="px-5">
				<TableHead>
					<TableRow>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(1, dir)} className="text-gray-500">
							Controller Name
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(2, dir)} className="text-gray-500">
							Action Name
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(3, dir)} className="text-gray-500">
							Description
						</TableHeader>
						<TableHeader className="text-gray-500">Actions</TableHeader>
					</TableRow>
				</TableHead>
				<TableBody>
					{data.lists.map((permission, index) => (
						<TableRow
							key={permission.Id}
							className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
						>
							<TableCell>
								<div className="font-medium text-gray-900">{permission.ControllerName}</div>
							</TableCell>
							<TableCell>
								<div className="font-medium text-gray-900">{permission.ActionName}</div>
							</TableCell>
							<TableCell>
								<div className="text-gray-500">{permission.ModuleFunctionDescription ?? '—'}</div>
							</TableCell>
							<TableCell>
								<div className="flex items-center space-x-2">
									<Button color="yellow" className="p-2" onClick={() => onEdit(permission.Id)}>
										<PencilIcon className="w-4 h-4" />
									</Button>
									<Button color="red" className="p-2" onClick={() => onDelete(permission.Id)}>
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
						{Math.min(data.limit * data.page, data.total)} of {data.total} permissions
					</p>
				) : (
					<p className="text-sm text-gray-500">No permissions found</p>
				)}
			</div>
		</div>
	);
};
