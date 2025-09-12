"use-client";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ProjectLists, ProjectPagination, ProjectRevisionList } from '../Model.d'; // Adjust the import path as necessary
import { fetchProject, fetchProjectStagesByProjectId } from '../Service'; // Adjust the import path as necessary
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { Pagination, PaginationPrevious, PaginationNext, PaginationPage, PaginationList } from '../../../components/tailwindui/pagination'; // Adjust the import path as necessary
import {
    PlusIcon, 
    MagnifyingGlassIcon,
    XMarkIcon,
    ChevronDownIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary
import { useToast } from '../../../components/toaster/ToasterContext'; // Adjust the import path as necessary

const Project: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [searchInput, setSearchInput] = useState<string>(''); // Separate state for search input
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // Track expanded rows
    const [revisionLists, setRevisionLists] = useState<Record<string, ProjectRevisionList>>({}); // Store revisions per project ID
    // const [projects, setProjects] = useState<ProjectLists>(); // Initialize with an empty array of ProjectDetails
    //toaster here
    const { showToast } = useToast();

    const [ProjectFilters, setProjectFilters] = useState<ProjectPagination>({
        filters: {
            // ProgramId: '',
            ProjectId: ''
        },
        sortField: '',
        sortDirection: 1,
        page: 1,
        limit: 20
    });

    const [ProjectData, setProjectData] = useState<PaginationResponse<ProjectLists>>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        lists: []
    });

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async (filters?: ProjectPagination) => {
        try {
            setIsLoading(true);
            const filtersToUse = filters || ProjectFilters;
            const response = await fetchProject(filtersToUse);
            setProjectData(response.Data);
        } catch (error) {
            showToast({
                type: 'error',
                message: 'Failed to fetch projects.'
            });
            // console.error('Error fetching projects:', error);
            // You might want to show a toast or alert here
            // alert('Failed to fetch projects: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchChange = (value: string) => {
        // Only update the input state, don't trigger API call
        setSearchInput(value);
    };

    const handleSearchSubmit = async () => {
        // Update the filter state and trigger API call
        const updatedFilters = {
            ...ProjectFilters,
            filters: {
                ...ProjectFilters.filters,
                ProjectId: searchInput
            },
            page: 1 // Reset to first page when searching
        };
        
        setProjectFilters(updatedFilters);
        await fetchProjects(updatedFilters);
    };

    const handleClearSearch = async () => {
        setSearchInput('');
        const updatedFilters = {
            ...ProjectFilters,
            filters: {
                ...ProjectFilters.filters,
                ProjectId: ''
            },
            page: 1
        };
        
        setProjectFilters(updatedFilters);
        await fetchProjects(updatedFilters);
    };

    const handleDropDownTable = async (projectId?: string) => {
        try {
            if (projectId) {
                // Check if the row is already expanded
                const isCurrentlyExpanded = expandedRows.has(projectId);
                
                // Toggle the expanded state for this row
                setExpandedRows(prev => {
                    const newExpanded = new Set(prev);
                    if (newExpanded.has(projectId)) {
                        newExpanded.delete(projectId);
                    } else {
                        newExpanded.add(projectId);
                    }
                    return newExpanded;
                });

                // Only fetch data if we're expanding (not collapsing) and data doesn't already exist
                if (!isCurrentlyExpanded && !revisionLists[projectId]) {
                    const response = await fetchProjectStagesByProjectId(projectId);
                    setRevisionLists(prev => ({
                        ...prev,
                        [projectId]: response.Data
                    }));
                }
            }
        } catch (error) {
            console.error('Error toggling project details:', error);
            showToast({
                type: 'error',
                message: 'Failed to fetch project stages.'
            });
        }
    };

    // Helper function to format PHP currency
    // const formatCurrency = (amount: number) => {
    //     return amount.toLocaleString('en-PH');
    // };

    const handleViewDetails = (projectId: string, stageName: string) => {
        try{
            if (projectId && stageName) {
                navigate(`/projects/project-details/${projectId}:${stageName}`);
            }
        } catch (error) {
            console.error('Error navigating to project details:', error);
        }
    };

    const handleAddProject = () => {
        navigate('/projects/addproject');
    };

    const Paginate = async (page: number) => {
        try {
            const response = await fetchProject({
                ...ProjectFilters,
                page: page
            });
            setProjectData(response.Data);
        } catch (error) {
            console.error('Error fetching projects:', error);
            showToast({
                type: 'error',
                message: 'Failed to fetch projects.'
            });
        }
    };

    return (
        <div className="max-w-10xl mx-auto p-6 space-y-6">
            {/* Breadcrumb */}
            <nav className="text-sm text-left text-gray-500 mb-4">
                <span>Project Management</span>
                <span className="mx-2">&gt;</span>
                <span>Projects</span>
                <span className="mx-2">&gt;</span>
            </nav>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Projects</h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by Project ID..."
                                            value={searchInput}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSearchSubmit();
                                                }
                                            }}
                                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <Button 
                                        color="blue" 
                                        onClick={handleSearchSubmit}
                                        disabled={isLoading}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                                        Search
                                    </Button>
                                    {(searchInput || ProjectFilters.filters?.ProjectId) && (
                                        <Button 
                                            color="zinc" 
                                            onClick={handleClearSearch}
                                            disabled={isLoading}
                                            className="text-xs px-3 py-1.5"
                                        >
                                            <XMarkIcon className="w-4 h-4 mr-1" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                <Button color="blue" onClick={handleAddProject} disabled={isLoading}>
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Project'}
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    <Table className="px-5">
                        <TableHead>
                            <TableRow>
                                <TableHeader>Project ID</TableHeader>
                                <TableHeader justify='center'>Program Name</TableHeader>
                                <TableHeader justify='center'>Category</TableHeader>
                                {/* <TableHeader>Total Project Cost (PHP)</TableHeader> */}
                                <TableHeader justify='center'>Created By</TableHeader>
                                <TableHeader justify='center'>Created Date</TableHeader>
                                <TableHeader justify='center'>Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {ProjectData?.lists.map((project, idx) => (
                                <React.Fragment key={`${project.Id}-${idx}`}>
                                    <TableRow>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <button 
                                                    onClick={() => handleDropDownTable(project.ProjectId)}
                                                    className="flex items-center text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
                                                >
                                                    {expandedRows.has(project.ProjectId || '') ? (
                                                        <ChevronDownIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform" />
                                                    ) : (
                                                        <ChevronRightIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform" />
                                                    )}
                                                    {project.ProjectId}
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell>{project.ProgramName}</TableCell>
                                        <TableCell>{project.Category}</TableCell>
                                        {/* <TableCell className="text-right">
                                            {formatCurrency(project.TotalProjectCost)}
                                        </TableCell> */}
                                        <TableCell>{project.CreatedBy}</TableCell>
                                        <TableCell>{project.CreatedDate.StringToDate()}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-1">
                                                <Button 
                                                    color="orange"
                                                    onClick={() => project.ProjectId && handleViewDetails(project.ProjectId, project.StageName)}
                                                    className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                                >
                                                    View Details
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>

                                    {/* Expandable Child Table */}
                                    {expandedRows.has(project.ProjectId || '') && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="p-0 bg-gray-50/50 border-t border-gray-200">
                                                <div className="px-8 py-6">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-sm font-semibold text-gray-900">
                                                            Project Stages for "{project.ProjectId}"
                                                        </h4>
                                                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
                                                            {revisionLists[project.ProjectId || '']?.Stages?.length || 0} stages
                                                        </span>
                                                    </div>
                                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                        <Table className="mb-0">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableHeader justify="center" className="text-xs">Project ID</TableHeader>
                                                                    <TableHeader justify="center" className="text-xs">Description</TableHeader>
                                                                    <TableHeader justify="center" className="text-xs">Category</TableHeader>
                                                                    <TableHeader justify="center" className="text-xs">SubProgram</TableHeader>
                                                                    <TableHeader justify="center" className="text-xs">Created By</TableHeader>
                                                                    <TableHeader justify="center" className="text-xs">Created Date</TableHeader>
                                                                    <TableHeader justify="center" className="text-xs">Actions</TableHeader>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {revisionLists[project.ProjectId || '']?.Stages?.map((stage) => (
                                                                    <TableRow key={stage.Id}>
                                                                        <TableCell className="font-medium text-sm text-center truncate max-w-32">{stage.ProjectId}</TableCell>
                                                                        <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.Description}</TableCell>
                                                                        <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.Category}</TableCell>
                                                                        <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.Thrust}</TableCell>
                                                                        <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.CreatedBy}</TableCell>
                                                                        <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.CreatedDate.StringToDate()}</TableCell>
                                                                        <TableCell className='text-center'>
                                                                            <Button
                                                                                color="blue"
                                                                                className="text-xs px-3 py-1.5 text-center"
                                                                                onClick={() => handleViewDetails(stage.ProjectId, stage.StageName)}
                                                                            >
                                                                                View Details
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )) || (
                                                                    <TableRow>
                                                                        <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                                                                            No revisions available for this project
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                    <Pagination className="my-6">
                        {
                            ProjectData.totalPages > 1 && (
                                <>
                                    <PaginationPrevious 
                                        onClick={async () => {
                                            Paginate(1);
                                        }}
                                        disabled={ProjectData.page <= 1}
                                    >
                                        First
                                    </PaginationPrevious>
                                    <PaginationList>
                                        {Array.from({ length: Math.min(7, ProjectData.totalPages) }, (_, index) => {
                                            const pageNum = Math.max(1, ProjectData.page - 3) + index;
                                            if (pageNum > ProjectData.totalPages) return null;

                                            if (pageNum === ProjectData.page) {
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
                                            Paginate(ProjectData.totalPages);
                                        }}
                                        disabled={ProjectData.page >= ProjectData.totalPages}
                                    >
                                        Last
                                    </PaginationNext>
                                </>
                            )
                        }
                    </Pagination>
                    <div className='mb-3.5'>
                        {
                            ProjectData.lists.length > 0 ? (
                                <p className="text-sm text-gray-500">
                                    Showing {ProjectData.limit * (ProjectData.page - 1) + 1} to {Math.min(ProjectData.limit * ProjectData.page, ProjectData.total)} of {ProjectData.total} projects
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    No projects found
                                </p>
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Project;