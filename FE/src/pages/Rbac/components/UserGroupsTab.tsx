import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/16/solid';
import { AdjustmentsVerticalIcon, UsersIcon } from '@heroicons/react/20/solid';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { Badge } from '../../../components/tailwindui/badge';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import type { vUserGroups, UserGroupFilter } from '../Model.d';
import type { ListPager } from '../useRbac';
import { PROJECT_SCOPES } from '../projectScope';

interface UserGroupsTabProps {
	pager: ListPager<UserGroupFilter, vUserGroups>;
	onClear: () => void;
	onOpenFilter: () => void;
	onAddGroup: () => void;
	onEdit: (id: number) => void;
	onDelete: (id: number) => void;
}

export const UserGroupsTab: React.FC<UserGroupsTabProps> = ({
	pager,
	onClear,
	onOpenFilter,
	onAddGroup,
	onEdit,
	onDelete,
}) => {
	const data = pager.data;
	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

	const toggleRow = (id: number) =>
		setExpandedRows(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});

	const hasActiveFilter = !!(pager.currentFilters?.GroupName || pager.currentFilters?.PermissionNames);

	const activeFilterCount = [pager.currentFilters?.GroupName, pager.currentFilters?.PermissionNames].filter(Boolean).length;

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
					{/* 2026-10-30: no sort arrows -- ShowUserGroups always lists newest first (keyset on Id),
					    so a header click re-fetched the same order. */}
					<TableRow className="text-center">
						<TableHeader className="text-gray-700">Group Name</TableHeader>
						<TableHeader className="text-gray-700">Members</TableHeader>
						<TableHeader className="text-gray-700">Permissions</TableHeader>
						<TableHeader className="text-gray-700">Project visibility</TableHeader>
						<TableHeader className="text-gray-700">Description</TableHeader>
						<TableHeader className="text-gray-700">Created</TableHeader>
						<TableHeader className="text-gray-700">Actions</TableHeader>
					</TableRow>
				</TableHead>
				<TableBody>
					{data.lists.map((group, index) => {
						const isExpanded = expandedRows.has(group.Id);
						const mods = group.ModulePermissions || [];
						const totalApi = mods.reduce((s, m) => s + m.APIPermissions.reduce((ss, api) => ss + api.Actions.filter(a => a.IsGranted).length, 0), 0);
						const totalViews = mods.reduce((s, m) => s + m.ViewAccess.filter(v => v.IsGranted).length, 0);
						const hasPerms = totalApi > 0 || totalViews > 0;

						return (
							<React.Fragment key={group.Id}>
								{/* Main row — click anywhere to expand/collapse */}
								<TableRow
									className={`cursor-pointer select-none transition-colors ${isExpanded ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 hover:bg-gray-200'}`}
									onClick={() => toggleRow(group.Id)}
								>
									<TableCell>
										<div className="flex items-center gap-2">
											{isExpanded
												? <ChevronUpIcon className="w-4 h-4 text-blue-400 shrink-0" />
												: <ChevronDownIcon className="w-4 h-4 text-gray-300 shrink-0" />
											}
											<span className="font-medium text-gray-900">{group.GroupName}</span>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center space-x-2">
											<UsersIcon className="w-4 h-4 text-gray-400" />
											<span className="text-gray-900 font-medium">{group.NumberOfUsers}</span>
										</div>
									</TableCell>
									<TableCell>
										{hasPerms ? (
											<div className="flex items-center gap-1.5">
												{totalApi > 0 && (
													<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
														{totalApi} API
													</span>
												)}
												{totalViews > 0 && (
													<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
														{totalViews} Routes
													</span>
												)}
											</div>
										) : (
											<Badge color="zinc" className="text-xs">No permissions</Badge>
										)}
									</TableCell>
									<TableCell className="text-gray-700 whitespace-nowrap">
										{(PROJECT_SCOPES.find(s => s.value === (group.ProjectScope ?? 0)) ?? PROJECT_SCOPES[0]).label}
									</TableCell>
									<TableCell className="text-gray-500 max-w-xs truncate">
										{group.Description}
									</TableCell>
									<TableCell className="text-gray-500">
										{group.CreatedDate
											? new Date(group.CreatedDate).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'numeric',
												day: 'numeric',
											})
											: '-'}
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
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

								{/* Expanded detail row */}
								{isExpanded && (
									<TableRow className="bg-blue-50/60">
										<TableCell colSpan={7} className="p-0 border-b border-blue-100">
											<div className="px-8 py-4">
												{!hasPerms ? (
													<p className="text-sm text-gray-400 italic">No permissions assigned to this group.</p>
												) : (
													<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
														{mods.map(mod => {
															const grantedActions = mod.APIPermissions.flatMap(api => api.Actions.filter(a => a.IsGranted));
															const grantedViews = mod.ViewAccess.filter(v => v.IsGranted);
															if (grantedActions.length === 0 && grantedViews.length === 0) return null;
															return (
																<div key={mod.ModuleName} className="border border-blue-200 rounded-lg p-3 bg-white shadow-sm">
																	<div className="flex items-center justify-between mb-2">
																		<p className="font-semibold text-sm text-gray-800">{mod.ModuleName}</p>
																		<div className="flex items-center gap-1">
																			{grantedActions.length > 0 && (
																				<span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">
																					{grantedActions.length} API
																				</span>
																			)}
																			{grantedViews.length > 0 && (
																				<span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
																					{grantedViews.length} Routes
																				</span>
																			)}
																		</div>
																	</div>
																	{grantedActions.length > 0 && (
																		<div className="mb-2">
																			<p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">API</p>
																			<div className="flex flex-wrap gap-1">
																				{grantedActions.map(a => (
																					<span key={a.Id} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100">
																						{a.ActionName}
																					</span>
																				))}
																			</div>
																		</div>
																	)}
																	{grantedViews.length > 0 && (
																		<div>
																			<p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Routes</p>
																			<div className="flex flex-wrap gap-1">
																				{grantedViews.map(v => (
																					<span key={v.Id} className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-medium border border-green-100" title={v.RoutePath}>
																						{v.RouteName}
																					</span>
																				))}
																			</div>
																		</div>
																	)}
																</div>
															);
														})}
													</div>
												)}
											</div>
										</TableCell>
									</TableRow>
								)}
							</React.Fragment>
						);
					})}
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
						{Math.min(data.limit * data.page, data.total)} of {data.total} user groups
						*/}
					</p>
				) : (
					<p className="text-sm text-gray-500">No user groups found</p>
				)}
			</div>
		</div>
	);
};
