"use-client";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ProjectLists, ProjectPagination } from '../Model.d'; // Adjust the import path as necessary
import { fetchProject } from '../Service'; // Adjust the import path as necessary
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import {
    PlusIcon, 
    MagnifyingGlassIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary

const Project: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [searchInput, setSearchInput] = useState<string>(''); // Separate state for search input
    // const [projects, setProjects] = useState<ProjectLists>(); // Initialize with an empty array of ProjectDetails

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
            console.error('Error fetching projects:', error);
            // You might want to show a toast or alert here
            alert('Failed to fetch projects: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

    // Helper function to format PHP currency
    // const formatCurrency = (amount: number) => {
    //     return amount.toLocaleString('en-PH');
    // };

    const handleViewDetails = (projectId: string) => {
        navigate(`/projects/project-details/${projectId}`);
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
                                <TableHeader>Program Name</TableHeader>
                                <TableHeader>Category</TableHeader>
                                <TableHeader>Total Project Cost (PHP)</TableHeader>
                                <TableHeader>Created By</TableHeader>
                                <TableHeader>Created Date</TableHeader>
                                <TableHeader>Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {ProjectData?.lists.map(project => (
                                <TableRow key={project.Id}>
                                    <TableCell>
                                        <button 
                                            onClick={() => project.ProjectId && handleViewDetails(project.ProjectId)}
                                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                        >
                                            {project.ProjectId}
                                        </button>
                                    </TableCell>
                                    <TableCell>{project.ProgramName}</TableCell>
                                    <TableCell>{project.Category}</TableCell>
                                    {/* <TableCell className="text-right">
                                        {formatCurrency(project.TotalProjectCost)}
                                    </TableCell> */}
                                    <TableCell>{project.CreatedBy}</TableCell>
                                    <TableCell>{project.CreatedDate}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-1">
                                            <Button 
                                                color="orange"
                                                onClick={() => project.ProjectId && handleViewDetails(project.ProjectId)}
                                                className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                            >
                                                View Details
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default Project;