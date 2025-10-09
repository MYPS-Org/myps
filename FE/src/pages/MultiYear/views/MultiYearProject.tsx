"use-client";
import React from "react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { TableHeader, TableRow, TableCell, TableHead, TableBody, MultiSelectFilterableTable } from '../../../components/tailwindui/table';
import { MagnifyingGlassIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/20/solid';
import { Button } from '../../../components/tailwindui/button';
import { useProjectList } from '../hooks/useProjectList';
import { useProgramList } from '../hooks/useProgramList';
import { useAtom } from 'jotai';
import { multiYearListAtom } from '../state/multiYearState';

const MultiYearProject: React.FC = () => {
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [searchInput, setSearchInput] = useState('');

    // Get program ID from URL parameters
    // Try different possible parameter names based on your route configuration
    const params = useParams();
    // For URL structure like /multiyear/PIP0000170, the parameter might be named differently
    const programId = params.programId || params.id || params['*'] || Object.values(params)[0] as string;
    const navigate = useNavigate();
    
    // Get program data from state
    const [programData] = useAtom(multiYearListAtom);
    
    // Also need access to program initialization
    const { initializeData: initializeProgramData } = useProgramList();
    
    // Find the selected program based on URL parameter
    const selectedProgram = programData?.lists?.find((program: any) => program.ProgramId === programId);
    
    // Debug logging
    console.log('URL params:', params);
    console.log('Extracted programId:', programId);
    console.log('Program data lists:', programData?.lists);
    console.log('Selected program:', selectedProgram);

    const {
        projectData,
        isLoading,
        initializeProjectData,
        PaginateProjects
    } = useProjectList();

    // Initialize project data when component mounts or program changes
    useEffect(() => {
        if (programId) {
            console.log('Initializing project data for programId:', programId);
            initializeProjectData(programId); // Pass the programId directly instead of selectedProgram.Name
        }
    }, [programId, initializeProjectData]);

    // Redirect to programs list if no programId in URL
    useEffect(() => {
        if (!programId) {
            navigate('/multiyear');
        }
    }, [programId, navigate]);

    // Initialize program data if not loaded
    useEffect(() => {
        if (!programData?.lists?.length) {
            initializeProgramData();
        }
    }, [programData?.lists?.length, initializeProgramData]);

    // Get all projects first
    const allProjects = projectData?.lists || [];

    // Filter options for project status
    const statusOptions = [
        { value: 'Active', label: 'Active', count: allProjects.filter((p: any) => p.Status === 'Active').length },
        { value: 'Pending', label: 'Pending', count: allProjects.filter((p: any) => p.Status === 'Pending').length },
        { value: 'Inactive', label: 'Inactive', count: allProjects.filter((p: any) => p.Status === 'Inactive').length },
    ];

    // Filter the projects based on selected statuses
    const filteredProjects = selectedStatuses.length === 0 
        ? allProjects
        : allProjects.filter((project: any) => selectedStatuses.includes(project.Status));

    // Get current page projects for display
    const currentPage = projectData?.page || 1;
    const limit = projectData?.limit || 20;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const currentPageProjects = filteredProjects.slice(startIndex, endIndex);

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (status.toLowerCase()) {
            case 'active':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'pending':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'inactive':
                return `${baseClasses} bg-red-100 text-red-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const getTypeBadge = (type: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (type.toLowerCase()) {
            case 'infrastructure':
                return `${baseClasses} bg-blue-100 text-blue-800`;
            case 'technology':
                return `${baseClasses} bg-purple-100 text-purple-800`;
            case 'healthcare':
                return `${baseClasses} bg-pink-100 text-pink-800`;
            case 'education':
                return `${baseClasses} bg-orange-100 text-orange-800`;
            case 'energy':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'environment':
                return `${baseClasses} bg-green-100 text-green-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    };
    
    const handleSearchSubmit = () => {
        console.log('Searching for:', searchInput);
    };

    const handleBackToPrograms = () => {
        navigate('/multiyear'); // Navigate back to the programs list
    };

    const formatCost = (cost?: number) => {
        if (!cost) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0
        }).format(cost);
    };

    // If no program is found or program data is not loaded, show a message
    if (!selectedProgram || !programData?.lists?.length) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg m-4">
                <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {!programData?.lists?.length ? 'Loading...' : 'Program Not Found'}
                    </h3>
                    <p className="text-gray-600">
                        {!programData?.lists?.length 
                            ? 'Please wait while we load the program data.'
                            : 'The requested program could not be found. Please go back to the Multi-Year list.'
                        }
                    </p>
                    {programData?.lists?.length > 0 && (
                        <Button 
                            color="blue" 
                            onClick={handleBackToPrograms}
                            className="mt-4"
                        >
                            Back to Programs
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Multi-select Filterable Table */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden m-4">
                <div className="p-4">
                    <div className="overflow-x-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Button
                                        color="zinc"
                                        onClick={handleBackToPrograms}
                                        className="flex items-center text-xs px-3 py-1.5"
                                    >
                                        <ArrowLeftIcon className="w-4 h-4 mr-1" />
                                        Back to Programs
                                    </Button>
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">Projects</h3>
                                        <p className="text-sm text-gray-600">Program: {selectedProgram.Name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="flex items-center space-x-2">
                                        <div className="relative">
                                            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search Projects..."
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
                                    </div>
                                    <Button color="blue" disabled={isLoading} className="text-xs px-3 py-1.5">
                                        <PlusIcon className="w-4 h-4 mr-1" />
                                        {isLoading ? 'Loading...' : 'Add Project'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <MultiSelectFilterableTable
                            filterOptions={statusOptions}
                            selectedFilters={selectedStatuses}
                            onFilterChange={setSelectedStatuses}
                            filterVariant="pills"
                            filterSize="md"
                            showClearAll={true}
                            label="Filter"
                            className="min-w-full"
                        >
                            <TableHead>
                                <TableRow>
                                    <TableHeader className="min-w-[200px]">Project Name</TableHeader>
                                    <TableHeader className="min-w-[100px]">Project ID</TableHeader>
                                    <TableHeader className="min-w-[100px]">Status</TableHeader>
                                    <TableHeader className="min-w-[120px]">Type</TableHeader>
                                    <TableHeader className="min-w-[100px]">Region</TableHeader>
                                    <TableHeader className="min-w-[120px]">Cost</TableHeader>
                                    <TableHeader className="min-w-[100px]">Duration</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {currentPageProjects.length > 0 ? (
                                    currentPageProjects.map(project => (
                                        <TableRow key={project.Id}>
                                            <TableCell className="min-w-[200px]">
                                                <div className="font-medium text-gray-900 truncate pr-4" title={project.Name}>
                                                    {project.Name}
                                                </div>
                                                <div className="text-sm text-gray-500 truncate pr-4" title={project.Description}>
                                                    {project.Description}
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[100px]">
                                                <span className="text-gray-600 font-mono text-sm">{project.ProjectId}</span>
                                            </TableCell>
                                            <TableCell className="min-w-[100px]">
                                                <span className={getStatusBadge(project.Status)}>{project.Status}</span>
                                            </TableCell>
                                            <TableCell className="min-w-[120px]">
                                                <span className={getTypeBadge(project.Type)}>{project.Type}</span>
                                            </TableCell>
                                            <TableCell className="min-w-[100px]">
                                                <span className="text-gray-600">{project.RegionCode}</span>
                                            </TableCell>
                                            <TableCell className="min-w-[120px]">
                                                <span className="text-gray-600 font-semibold">{formatCost(project.Cost)}</span>
                                            </TableCell>
                                            <TableCell className="min-w-[100px]">
                                                <span className="text-gray-600 whitespace-nowrap">{project.YearStart} - {project.YearEnd}</span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="min-w-full">
                                            <div className="text-center py-8 text-gray-500 whitespace-nowrap">
                                                {selectedStatuses.length > 0 
                                                    ? `No projects found with status: ${selectedStatuses.join(', ')}`
                                                    : 'No projects found for this program.'
                                                }
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </MultiSelectFilterableTable>
                        
                        {/* Pagination */}
                        {projectData && projectData.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200">
                                <div className="flex justify-center">
                                    <div className="flex space-x-1">
                                        <Button
                                            color="white"
                                            onClick={() => PaginateProjects(projectData.page - 1)}
                                            disabled={projectData.page === 1 || isLoading}
                                        >
                                            Previous
                                        </Button>
                                        
                                        {Array.from({ length: projectData.totalPages }, (_, i) => i + 1).map((pageNum) => (
                                            <Button
                                                key={pageNum}
                                                color={pageNum === projectData.page ? "blue" : "white"}
                                                onClick={() => PaginateProjects(pageNum)}
                                                disabled={isLoading}
                                            >
                                                {pageNum}
                                            </Button>
                                        ))}
                                        
                                        <Button
                                            color="white"
                                            onClick={() => PaginateProjects(projectData.page + 1)}
                                            disabled={projectData.page === projectData.totalPages || isLoading}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer info */}
                        <div className='mb-3.5 px-6 py-4'>
                            {projectData && projectData.lists.length > 0 ? (
                                <p className="text-sm text-gray-500">
                                    Showing {projectData.limit * (projectData.page - 1) + 1} to {Math.min(projectData.limit * projectData.page, projectData.total)} of {projectData.total} projects
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    No projects found
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MultiYearProject;