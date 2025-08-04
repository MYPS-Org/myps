"use-client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProjectGroup } from '../Service'; // Adjust the import path as necessary
import type { ProjectGroupPagination, ProjectGroupsDropDowns } from '../Model.d'; // Adjust the import path as necessary
import { Pagination, PaginationPrevious, PaginationNext, PaginationPage, PaginationList } from '../../../components/tailwindui/pagination'; // Adjust the import path as necessary

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

// #region Import Dialogs
import { AddProjectGroupDialog, DeleteProjectGroupDialog } from '../dialogs';
// #endregion

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { 
    PlusIcon, 
    MagnifyingGlassIcon,
    TrashIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary

const ProjectGroup: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const [isAddProjectGroupOpen, setIsAddProjectGroupOpen] = useState(false);
    const [isDeleteProjectGroupOpen, setIsDeleteProjectGroupOpen] = useState(false);
    const [selectedProjectGroup, setSelectedProjectGroup] = useState<string | null>(); // Initialize with an empty string or a default value

    useEffect(() => {
        const getProjectGroups = async () => {
            setIsLoading(true);
            try {
                const response = await fetchProjectGroup(ProjectGroupData);
                setProjectGroupData(response.Data);
            } catch (error) {
                console.error('Error fetching project groups:', error);
            } finally {
                setIsLoading(false);
            }
        };
        getProjectGroups();
    }, []);

    const [ProjectGroupData, setProjectGroupData] = useState<ProjectGroupsDropDowns>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        lists: [],
        Dropdowns: {
            UserGroups: [],
        }
    });

    const [ProjectGroupFilters, setProjectGroupFilters] = useState<ProjectGroupPagination>({
            filters: {
                Name: '',
            },
            sortField: '',
            sortDirection: 1,
            page: 1,
            limit: 20
        });

    const handleOpenDialog = async () => {
        try {
            setIsLoading(true);
            // const response = await fetchProjectGroupEnums();
            // setProjectGroupData(response.Data); // this will be passed as prop
            setIsAddProjectGroupOpen(true); // this shows the dialog
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching project groups:', error);
            setIsLoading(false);
        }
    };

    // Helper function to render status badge
    const getStatusBadge = (status: string) => {
        const statusColors = {
            'Working': 'bg-orange-100 text-orange-800 border-orange-200',
            'Approved': 'bg-green-100 text-green-800 border-green-200',
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'Rejected': 'bg-red-100 text-red-800 border-red-200',
            'Proposed': 'bg-blue-100 text-blue-800 border-blue-200',
        };
        
        const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';
        
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                {status}
            </span>
        );
    };

    const handleViewDetails = async (id?: number) => {
        try {
            if (id) {
                navigate(`/project-groups/project-details/${id}`);
            }
        } catch (error) {
            console.error('Error navigating to program details:', error);
        }
        
    };

    const Paginate = async (page: number) => {
        setProjectGroupData(prev => ({
            ...prev,
            page: page
        }));
        try {
            const response = await fetchProjectGroup({
                ...ProjectGroupFilters,
                page: page
            });
            setProjectGroupData(response.Data);
        } catch (error) {
            console.error('Error fetching Project Groups:', error);
        }
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
                                    {/* <Button 
                                        color={groupByCreatedDate ? "blue" : "zinc"}
                                        onClick={() => setGroupByCreatedDate(!groupByCreatedDate)}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        {groupByCreatedDate ? "Group by Created Date" : "Group by Start Year"}
                                    </Button>
                                    <Button 
                                        color="zinc"
                                        onClick={expandAllYears}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        Expand All
                                    </Button>
                                    <Button 
                                        color="zinc"
                                        onClick={collapseAllYears}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        Collapse All
                                    </Button> */}
                                </div>
                                <div className="relative">
                                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search Project Groups..."
                                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <Button color="blue" onClick={handleOpenDialog} disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Project Group'}
                                </Button>
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
                    {ProjectGroupData.lists.map((group, idx) => (
                        <TableRow key={`${group.Id}-${idx}`}>
                        <TableCell>
                            <button 
                                onClick={() => handleViewDetails(group.Id)}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            >
                                {group.Name}
                            </button>
                        </TableCell>
                        <TableCell>
                            {getStatusBadge(group.Name || '')}
                        </TableCell>
                        <TableCell>
                            {group.Description}
                        </TableCell>
                        <TableCell>
                            {group.NumberOfProjects || 0}
                        </TableCell>
                        <TableCell>
                            {group.CreatedDate}
                        </TableCell>
                        <TableCell>
                            {group.CreatedBy}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center space-x-1">
                                <Button 
                                    color="orange"
                                    /*onClick={() => handleViewDetails(program.ProgramId)}*/
                                    className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                >
                                    Validate
                                </Button>
                                <Button color="red" onClick={() => {setIsDeleteProjectGroupOpen(true); setSelectedProjectGroup(group.GroupId);}} className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
                                    <TrashIcon stroke='white' className="h-5 w-5 text-gray-900" />
                                </Button>
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                <Pagination className="my-6">
                    {
                        ProjectGroupData.totalPages > 1 && (
                            <>
                                <PaginationPrevious 
                                    onClick={async () => {
                                        Paginate(1);
                                    }}
                                    disabled={ProjectGroupData.page <= 1}
                                >
                                    First
                                </PaginationPrevious>
                                <PaginationList>
                                    {Array.from({ length: Math.min(7, ProjectGroupData.totalPages) }, (_, index) => {
                                        const pageNum = Math.max(1, ProjectGroupData.page - 3) + index;
                                        if (pageNum > ProjectGroupData.totalPages) return null;

                                        if (pageNum === ProjectGroupData.page) {
                                            return (
                                                <PaginationPage
                                                    key={pageNum}
                                                    current
                                                >
                                                    {pageNum}
                                                </PaginationPage>
                                            );
                                        } else {
                                            return (
                                                <PaginationPage
                                                    key={pageNum}
                                                    onClick={() => {
                                                        Paginate(pageNum);
                                                    }}
                                                >
                                                    {pageNum}
                                                </PaginationPage>
                                            );
                                        }
                                    })}
                                </PaginationList>
                                <PaginationNext 
                                    onClick={async () => {
                                        Paginate(ProjectGroupData.totalPages);
                                    }}
                                    disabled={ProjectGroupData.page >= ProjectGroupData.totalPages}
                                >
                                    Last
                                </PaginationNext>
                            </>
                        )
                    }
                </Pagination>
                    <div className='mb-3.5'>
                        {
                            ProjectGroupData.lists.length > 0 ? (
                                <p className="text-sm text-gray-500">
                                    Showing {ProjectGroupData.limit * (ProjectGroupData.page - 1) + 1} to {Math.min(ProjectGroupData.limit * ProjectGroupData.page, ProjectGroupData.total)} of {ProjectGroupData.total} project groups
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
                dropdownData={ProjectGroupData?.Dropdowns}
                onSubmit={(newProjectGroup: any) => {
                    // Handle the new project group submission
                    setProjectGroupData(prev => ({
                        ...prev,
                        lists: [...prev.lists, newProjectGroup],
                        total: prev.total + 1
                    }));
                }}
            />
            {/* Delete Project Group Dialog */}
            {selectedProjectGroup && (
                <DeleteProjectGroupDialog
                    isOpen={isDeleteProjectGroupOpen}
                    onClose={() => setIsDeleteProjectGroupOpen(false)}
                    projectGroup={ProjectGroupData.lists?.find((projectGroup: any) => projectGroup.GroupId === selectedProjectGroup)!} // Pass the selected project group or an empty object
                    onSubmit={(projectGroupId: any) => {
                        setProjectGroupData(prev => ({
                            ...prev,
                            lists: prev.lists.filter(projectGroup => projectGroup.GroupId !== projectGroupId),
                            total: prev.total - 1
                        }));
                    }}
            />
            )}
        </div>
    );
}

export default ProjectGroup;