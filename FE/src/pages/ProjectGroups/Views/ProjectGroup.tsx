"use-client";
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProjectGroup } from '../Service'; // Adjust the import path as necessary
import type { ProjectGroupFilter, ProjectGroupList, ProjectGroupsDropDowns, UserGroups } from '../Model.d'; // Adjust the import path as necessary
import { usePagination } from '../../../hooks/usePagination';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { useAuth } from '../../../contexts/AuthContext';

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

// #region Import Dialogs
import { AddProjectGroupDialog, DeleteProjectGroupDialog } from '../dialogs';
import FilterProjectGroupDialog from '../dialogs/FilterProjectGroupDialog';
// #endregion

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import {
    PlusIcon,
    TrashIcon,
    AdjustmentsVerticalIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary

const ProjectGroup: React.FC = () => {
    const navigate = useNavigate();
    // 2026-10-31: Add and Delete only for the groups that manage project groups (access matrix).
    const { can } = useAuth();

    const [isAddProjectGroupOpen, setIsAddProjectGroupOpen] = useState(false);
    const [isDeleteProjectGroupOpen, setIsDeleteProjectGroupOpen] = useState(false);
    const [isFilterProjectGroupDialogOpen, setIsFilterProjectGroupDialogOpen] = useState(false);
    const [selectedProjectGroup, setSelectedProjectGroup] = useState<string | null>(); // Initialize with an empty string or a default value

    // The list endpoint bundles the UserGroups dropdown alongside every paginated response —
    // stash it here as a side effect of each fetch so AddProjectGroupDialog always has fresh data
    // without a second request (see Program.tsx for the alternate lazy-fetch-on-dialog-open pattern,
    // not needed here since this data already rides along with the list fetch).
    const [userGroupDropdown, setUserGroupDropdown] = useState<UserGroups[]>([]);

    const fetchProjectGroupsPaginated = useCallback(async (params: PaginatedRequest<ProjectGroupFilter>) => {
        const response = await fetchProjectGroup(params);
        setUserGroupDropdown(response.Data.Dropdowns.UserGroups);
        return response as { Data: ProjectGroupsDropDowns };
    }, []);

    // Shared pagination hook — speaks the backend's keyset pagination contract (Navigation/cursor
    // ids). Replaces the old hand-rolled Paginate(page) which silently always re-fetched page 1:
    // the backend only understands Navigation: First/Next/Previous/Page/Last, and the old code
    // never sent Navigation at all, so every request defaulted to First regardless of which page
    // button was clicked.
    const pagination = usePagination<ProjectGroupFilter, ProjectGroupList>(fetchProjectGroupsPaginated, {
        initialFilters: { Name: '', UserGroupName: '' },
        limit: 20,
    });

    const handleOpenDialog = () => {
        setIsAddProjectGroupOpen(true);
    };

    const handleViewDetails = (id: string) => {
        navigate(`/project-groups/${id}`);
    };

    const handleFilterSubmit = (filterData: ProjectGroupFilter) => {
        pagination.applyFilters({
            Name: filterData.Name || '',
            UserGroupName: filterData.UserGroupName || '',
        });
    };

    const handleClear = () => {
        pagination.applyFilters({ Name: '', UserGroupName: '' });
    };

    return (

        <div className="max-w-10xl mx-auto p-6 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Project Groups</h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                    {(pagination.currentFilters?.Name || pagination.currentFilters?.UserGroupName) && (
                                        <Button
                                            color="red"
                                            className="shadow-md text-xs px-3 py-1.5"
                                            onClick={handleClear}
                                            disabled={pagination.isLoading}
                                        >
                                            Clear Filters
                                        </Button>
                                    )}
                                    <Button
                                        color="white"
                                        className={`shadow-md text-xs px-3 py-1.5 ${pagination.currentFilters?.Name || pagination.currentFilters?.UserGroupName ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                                        onClick={() => setIsFilterProjectGroupDialogOpen(true)}
                                        disabled={pagination.isLoading}
                                    >
                                        <AdjustmentsVerticalIcon className="w-4 h-4 mr-1" />
                                        Filter
                                        {(() => {
                                            const activeFilters = [
                                                pagination.currentFilters?.Name,
                                                pagination.currentFilters?.UserGroupName,
                                            ].filter(Boolean).length;

                                            return activeFilters > 0 && (
                                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                                    {activeFilters}
                                                </span>
                                            );
                                        })()}
                                    </Button>
                                </div>
                                {can('ProjectGroup', 'AddProjectGroup') && (
                                <Button color="blue" onClick={handleOpenDialog} disabled={pagination.isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {pagination.isLoading ? 'Loading...' : 'Add Project Group'}
                                </Button>
                                )}
                            </div>
                        </div>
                    </div>
                <Table className="px-5">
                    <TableHead>
                    <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Description</TableHeader>
                        <TableHeader>Number of Projects</TableHeader>
                        <TableHeader>UserGroup</TableHeader>
                        <TableHeader>Created Date</TableHeader>
                        <TableHeader>Created By</TableHeader>
                        <TableHeader>Actions</TableHeader>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {pagination.data.lists.map((group, idx) => (
                        <TableRow key={`${group.Id}-${idx}`}>
                        <TableCell>
                            <button
                                onClick={() => handleViewDetails(group.GroupId)}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            >
                                {group.Name}
                            </button>
                        </TableCell>
                        <TableCell>
                            <span className="block max-w-xs truncate" title={group.Description || ''}>
                                {group.Description || 'N/A'}
                            </span>
                        </TableCell>
                        <TableCell>
                            {group.NumberOfProjects || 0}
                        </TableCell>
                        <TableCell>
                            {group.UserGroupName || 'N/A'}
                        </TableCell>
                        <TableCell>
                            {group.CreatedDate!.StringToDate()}
                        </TableCell>
                        <TableCell>
                            {group.CreatedBy}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center space-x-1">
                                <Button
                                    color="orange"
                                    onClick={() => handleViewDetails(group.GroupId)}
                                    className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                >
                                    View
                                </Button>
                                {can('ProjectGroup', 'DeleteProjectGroup') && (
                                <Button color="red" onClick={() => {setIsDeleteProjectGroupOpen(true); setSelectedProjectGroup(group.GroupId);}} className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
                                    <TrashIcon stroke='white' className="h-5 w-5 text-gray-900" />
                                </Button>
                                )}
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>

                {/* Pagination bar — keyset Next/Previous + plain page-jump First/Last/numbered */}
                <PaginationBar
                    currentPage={pagination.data.page}
                    totalPages={pagination.data.totalPages}
                    hasPrevious={pagination.hasPrevious}
                    hasNext={pagination.hasNext}
                    onGoToPage={pagination.goToPage}
                    onNext={pagination.goNext}
                    onPrevious={pagination.goPrevious}
                    onFirst={pagination.goFirst}
                    onLast={pagination.goLast}
                    isLoading={pagination.isLoading}
                />

                    <div className='mb-3.5 text-center'>
                        {
                            pagination.data.lists.length > 0 ? (
                                <p className="text-sm text-gray-500">
                                    {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
                                    Showing {pagination.data.limit * (pagination.data.page - 1) + 1} to {Math.min(pagination.data.limit * pagination.data.page, pagination.data.total)} of {pagination.data.total} project groups
                                    */}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    No project groups found
                                </p>
                            )
                        }
                    </div>
                </div>
            </div>

            {/* Add Project Group Dialog */}
            <AddProjectGroupDialog
                isOpen={isAddProjectGroupOpen}
                onClose={() => setIsAddProjectGroupOpen(false)}
                dropdownData={{ UserGroups: userGroupDropdown }}
                onSubmit={() => {
                    // Refresh current page so the newly added group appears
                    pagination.refresh();
                }}
            />
            {/* Delete Project Group Dialog */}
            {selectedProjectGroup && (
                <DeleteProjectGroupDialog
                    isOpen={isDeleteProjectGroupOpen}
                    onClose={() => setIsDeleteProjectGroupOpen(false)}
                    projectGroup={pagination.data.lists.find((projectGroup) => projectGroup.GroupId === selectedProjectGroup)!} // Pass the selected project group or an empty object
                    onSubmit={() => {
                        // Re-fetch current page/filters without keyset cursors — safe after delete
                        pagination.refresh();
                    }}
            />
            )}

            {/* Filter Project Group Dialog */}
            <FilterProjectGroupDialog
                isOpen={isFilterProjectGroupDialogOpen}
                onClose={() => setIsFilterProjectGroupDialogOpen(false)}
                onSubmit={handleFilterSubmit}
                onClear={handleClear}
                initialData={pagination.currentFilters}
            />
        </div>
    );
}

export default ProjectGroup;
