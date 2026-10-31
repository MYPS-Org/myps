"use-client";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ProjectLists, ProjectFilter, ProjectRevisionList } from '../Model.d'; // Adjust the import path as necessary
import { fetchProject, fetchProjectStagesByProjectId } from '../Service'; // Adjust the import path as necessary
import { usePagination } from '../../../hooks/usePagination';
import { useAuth } from '../../../contexts/AuthContext';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary
import { CollapsibleTable, ExpandToggleButton, ExpandedPanel } from '../../../components/tailwindui/collapsible-table'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import {
    PlusIcon,
    MagnifyingGlassIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary
// import { useToast } from '../../../components/toaster/ToasterContext'; // Adjust the import path as necessary

const Project: React.FC = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const [searchInput, setSearchInput] = useState<string>(''); // Separate state for search input
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // Track expanded rows
    const [revisionLists, setRevisionLists] = useState<Record<string, ProjectRevisionList>>({}); // Store revisions per project ID
    //toaster here
    // const { showToast } = useToast();

    // Shared pagination hook — replaces the hand-rolled ProjectData/ProjectFilters/isLoading
    // state and the Paginate() function, matching the Program page pattern.
    const pagination = usePagination<ProjectFilter, ProjectLists>(fetchProject, {
        initialFilters: { ProjectId: '' },
        limit: 10,
    });

    const handleSearchChange = (value: string) => {
        // Only update the input state, don't trigger API call
        setSearchInput(value);
    };

    const handleSearchSubmit = () => {
        pagination.applyFilters({
            ...(pagination.currentFilters ?? {}),
            ProjectId: searchInput,
        });
    };

    const handleClearSearch = () => {
        setSearchInput('');
        pagination.applyFilters({
            ...(pagination.currentFilters ?? {}),
            ProjectId: '',
        });
    };

    const handleDropDownTable = async (projectPK?: string) => {
        try {
            if (projectPK) {
                // Check if the row is already expanded
                const isCurrentlyExpanded = expandedRows.has(projectPK);
                
                // Toggle the expanded state for this row
                setExpandedRows(prev => {
                    const newExpanded = new Set(prev);
                    if (newExpanded.has(projectPK)) {
                        newExpanded.delete(projectPK);
                    } else {
                        newExpanded.add(projectPK);
                    }
                    return newExpanded;
                });

                // Only fetch data if we're expanding (not collapsing) and data doesn't already exist
                if (!isCurrentlyExpanded && !revisionLists[projectPK]) {
                    const response = await fetchProjectStagesByProjectId(projectPK);
                    setRevisionLists(prev => ({
                        ...prev,
                        [projectPK]: response.Data
                    }));
                }
            }
        } catch (error) {
            console.error('Error toggling project details:', error);
            // showToast({
            //     type: 'error',
            //     message: 'Failed to fetch project stages.'
            // });
        }
    };

    // Helper function to format PHP currency
    // const formatCurrency = (amount: number) => {
    //     return amount.toLocaleString('en-PH');
    // };

    /*  A LUMP SUM PROJECT OPENS IN ITS OWN MODULE. The server marks such rows
        (ProjectLists.IsLumpSum) and their Id is the key /lumpsum/:lumpSumId
        takes, so the list hands them straight to the Lump Sum details page
        rather than to a project form that can only show them read-only. Itemized
        children are ordinary projects and take the ordinary route. The stage
        panel passes its PARENT row, since the stage rows themselves carry no flag. */
    const handleViewDetails = (project: ProjectLists, stageName: string) => {
        try{
            if (project.IsLumpSum) {
                navigate(`/lumpsum/${project.Id}`);
                return;
            }
            if (project.ProjectId && stageName) {
                navigate(`/projects/project-details/${project.ProjectId}:${stageName}`);
            }
        } catch (error) {
            console.error('Error navigating to project details:', error);
        }
    };

    const handleAddProject = () => {
        navigate('/projects/addproject');
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
                                        disabled={pagination.isLoading}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                                        Search
                                    </Button>
                                    {(searchInput || pagination.currentFilters?.ProjectId) && (
                                        <Button
                                            color="zinc"
                                            onClick={handleClearSearch}
                                            disabled={pagination.isLoading}
                                            className="text-xs px-3 py-1.5"
                                        >
                                            <XMarkIcon className="w-4 h-4 mr-1" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                {can('Project', 'AddProject') && (
                                <Button color="blue" onClick={handleAddProject} disabled={pagination.isLoading}>
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {pagination.isLoading ? 'Loading...' : 'Add Project'}
                                </Button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <CollapsibleTable<ProjectLists>
                        className="px-5"
                        data={pagination.data.lists}
                        rowKey={(project, idx) => `${project.Id}-${idx}`}
                        isRowExpanded={(project) => expandedRows.has(project.ProjectPK || '')}
                        onToggleRow={(project) => handleDropDownTable(project.ProjectPK)}
                        columns={[
                            {
                                header: 'Project ID',
                                render: (project, { isExpanded, toggleExpand }) => (
                                    <ExpandToggleButton label={project.ProjectId} isExpanded={isExpanded} onClick={toggleExpand} />
                                )
                            },
                            { header: 'Program Name', render: (project) => project.ProgramName },
                            { header: 'Category', render: (project) => project.CategoryName },
                            { header: 'Updated By', render: (project) => project.LastUpdatedBy ? project.LastUpdatedBy : project.RevisionCreatedBy },
                            { header: 'Created Date', render: (project) => project.RevisionCreatedDate ? project.RevisionCreatedDate.StringToDate() : '' },
                            {
                                header: 'Actions',
                                render: (project) => (
                                    <div className="flex items-center space-x-1">
                                        <Button
                                            color="orange"
                                            onClick={() => project.ProjectId && handleViewDetails(project, project.StageName)}
                                            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                            title={project.IsLumpSum ? 'Opens in the Lump Sum module' : undefined}
                                        >
                                            {project.IsLumpSum ? 'Open Lump Sum' : 'View Details'}
                                        </Button>
                                    </div>
                                )
                            }
                        ]}
                        renderExpandedContent={(project) => (
                            <ExpandedPanel
                                title={`Project Stages for "${project.ProjectId}"`}
                                badge={`${revisionLists[project.ProjectPK || '']?.Stages?.length || 0} stages`}
                            >
                                <Table className="mb-0">
                                    <TableHead>
                                        <TableRow>
                                            <TableHeader justify="center" className="text-xs">Project ID</TableHeader>
                                            <TableHeader justify="center" className="text-xs">Stage Name</TableHeader>
                                            <TableHeader justify="center" className="text-xs">Description</TableHeader>
                                            <TableHeader justify="center" className="text-xs">Category</TableHeader>
                                            <TableHeader justify="center" className="text-xs">SubProgram</TableHeader>
                                            <TableHeader justify="center" className="text-xs">Created By</TableHeader>
                                            <TableHeader justify="center" className="text-xs">Created Date</TableHeader>
                                            <TableHeader justify="center" className="text-xs">Actions</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {revisionLists[project.ProjectPK || '']?.Stages?.map((stage) => (
                                            <TableRow key={stage.Id}>
                                                <TableCell className="font-medium text-sm text-center truncate max-w-32">{stage.ProjectId}</TableCell>
                                                <TableCell className="font-medium text-sm text-center truncate max-w-32">{stage.StageName}</TableCell>
                                                <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.Description}</TableCell>
                                                <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.CategoryName}</TableCell>
                                                <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.ThrustName}</TableCell>
                                                <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.RevisionCreatedBy}</TableCell>
                                                <TableCell className="text-sm text-gray-600 text-center truncate max-w-32">{stage.RevisionCreatedDate ? stage.RevisionCreatedDate.StringToDate() : ''}</TableCell>
                                                <TableCell className='text-center'>
                                                    {/*  Routed through the PARENT row: a stage row carries no
                                                         IsLumpSum flag, and the panel only ever shows one
                                                         project's stages. stage.ProjectId equals project.ProjectId. */}
                                                    <Button
                                                        color="blue"
                                                        className="text-xs px-3 py-1.5 text-center"
                                                        onClick={() => handleViewDetails(project, stage.StageName)}
                                                        title={project.IsLumpSum ? 'Opens in the Lump Sum module' : undefined}
                                                    >
                                                        {project.IsLumpSum ? 'Open Lump Sum' : 'View Details'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) || (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-4 text-gray-500">
                                                    No revisions available for this project
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ExpandedPanel>
                        )}
                    />
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
                                    Showing {pagination.data.limit * (pagination.data.page - 1) + 1} to {Math.min(pagination.data.limit * pagination.data.page, pagination.data.total)} of {pagination.data.total} projects
                                    */}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    
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