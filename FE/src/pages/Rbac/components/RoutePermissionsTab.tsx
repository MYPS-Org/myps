import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import {
	Pagination,
	PaginationList,
	PaginationNext,
	PaginationPage,
	PaginationPrevious,
} from '../../../components/tailwindui/pagination';
import type { PermissionViews, RoutePermissionPagination } from '../Model.d';

interface RoutePermissionsTabProps {
	data: PaginationResponse<PermissionViews>;
	filter: RoutePermissionPagination;
	sortDirection: 0 | 1 | null;
	onSort: (field: number, direction: 0 | 1 | null) => void;
	onClear: () => void;
	onPaginate: (page: number) => void;
}

export const RoutePermissionsTab: React.FC<RoutePermissionsTabProps> = ({
	data,
	filter,
	sortDirection,
	onSort,
	onClear,
	onPaginate,
}) => {
	const hasActiveFilter = !!(filter.filters?.RoutePath || filter.filters?.Description);

	return (
		<div className="overflow-hidden">
			<div className="px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-medium text-gray-900">Route Permissions</h3>
					<div className="flex items-center space-x-3">
						{hasActiveFilter && (
							<Button color="red" onClick={onClear}>
								Clear Filter
							</Button>
						)}
					</div>
				</div>
			</div>

			<Table className="px-5">
				<TableHead>
					<TableRow>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(1, dir)} className="text-gray-500">
							Route Path
						</TableHeader>
						<TableHeader sortable sortDirection={sortDirection} onSort={(dir) => onSort(2, dir)} className="text-gray-500">
							Description
						</TableHeader>
					</TableRow>
				</TableHead>
				<TableBody>
					{data.lists.map((route, index) => (
						<TableRow
							key={route.Id}
							className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
						>
							<TableCell>
								<div className="font-medium text-gray-900">{route.RoutePath}</div>
							</TableCell>
							<TableCell>
								<div className="text-gray-500">{route.Description ?? '—'}</div>
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
							{Array.from({ length: Math.min(7, data.totalPages) }, (_, i) => {
								const pageNum = Math.max(1, data.page - 3) + i;
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
						{Math.min(data.limit * data.page, data.total)} of {data.total} route permissions
					</p>
				) : (
					<p className="text-sm text-gray-500">No route permissions found</p>
				)}
			</div>
		</div>
	);
};
