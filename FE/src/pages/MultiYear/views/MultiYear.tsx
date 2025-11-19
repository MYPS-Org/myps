"use-client";

import React from 'react';
import { useState, useEffect } from 'react';
import { TableHeader, TableRow, TableCell, TableHead, TableBody, MultiSelectFilterableTable } from '../../../components/tailwindui/table';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/20/solid'
import { Button } from '../../../components/tailwindui/button';
import { useProgramList } from '../hooks/useProgramList';
import { useAtom } from 'jotai';
import { selectedProgramAtom } from '../state/multiYearState';
import { useNavigate } from 'react-router-dom';

const MultiYear: React.FC = () => {
    const [selectedPrograms, setSelectedPrograms] = React.useState<string[]>([]);
    const [searchInput, setSearchInput] = useState('');
    const navigate = useNavigate();

    // Use the custom hook for program data management
    const { 
        programData, 
        isLoading, 
        initializeData,
        Paginate
    } = useProgramList();

    // Selected program state for navigation
    const [, setSelectedProgram] = useAtom(selectedProgramAtom);

    // Initialize data when component mounts
    useEffect(() => {
        initializeData();
    }, [initializeData]);

    // Get all programs first
    const allPrograms = programData?.lists || [];

    // Filter options for status (now supporting multiple selections)
    const statusOptions = [
        { value: 'RDIP', label: 'RDIP', count: allPrograms.filter((p: any) => p.Status === 'RDIP').length },
        { value: 'PIP', label: 'PIP', count: allPrograms.filter((p: any) => p.Status === 'PIP').length },
        // { value: 'inactive', label: 'Inactive', count: allPrograms.filter((p: any) => p.Status === 'inactive').length },
    ];

    // Filter the programs based on selected statuses
    const filteredPrograms = selectedPrograms.length === 0 
        ? allPrograms
        : allPrograms.filter((program: any) => selectedPrograms.includes(program.StageName));

    // Get current page programs for display
    const currentPage = programData?.page || 1;
    const limit = programData?.limit || 20;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const currentPagePrograms = filteredPrograms.slice(startIndex, endIndex);

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (status) {
            case 'Active':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'Pending':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'Inactive':
                return `${baseClasses} bg-red-100 text-red-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const getCategoryBadge = (category: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (category) {
            case 'technology':
                return `${baseClasses} bg-blue-100 text-blue-800`;
            case 'business':
                return `${baseClasses} bg-purple-100 text-purple-800`;
            case 'marketing':
                return `${baseClasses} bg-pink-100 text-pink-800`;
            case 'design':
                return `${baseClasses} bg-orange-100 text-orange-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    };
    const handleSearchSubmit = () => {
        // Implement search logic here (e.g., filter programs by name)
        console.log('Searching for:', searchInput);
    };

    const handleProgramClick = (program: any) => {
        setSelectedProgram(program);
        // Navigate to the projects page with program ID as parameter
        navigate(`/multiyear/programs/${program.ProgramId}`);
        console.log('Selected program:', program.Name);
    };

    return (
        <div className="space-y-6">
            {/* Results Summary */}
            {/* <div className="bg-gray-50 px-4 py-3 rounded-lg">
                <p className="text-sm text-gray-600">
                    Showing <span className="font-medium">{filteredPrograms.length}</span> of{' '}
                    <span className="font-medium">{samplePrograms.length}</span> programs
                    {selectedStatuses.length > 0 && (
                        <span className="ml-2 text-blue-600 font-medium">
                            ({getFilterDisplayText()})
                        </span>
                    )}
                </p>
            </div> */}

            {/* Multi-select Filterable Table */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden m-4">
                <div className="p-4">
                    <div className="overflow-x-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Multi-Year</h3>
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
                                <div className="flex items-center space-x-2">
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search Programs..."
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
                                    {/* {(searchInput || ProgramFilters.filters?.Name) && (
                                        <Button 
                                            color="red" 
                                            onClick={handleClearSearch}
                                            disabled={isLoading}
                                            className="text-xs px-3 py-1.5"
                                        >
                                            <XMarkIcon className="w-4 h-4 mr-1" />
                                            Clear
                                        </Button>
                                    )} */}
                                </div>
                                <Button color="blue" /*onClick={handleOpenDialog}*/ disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Multi-Year'}
                                </Button>
                            </div>
                        </div>
                    </div>
                        <MultiSelectFilterableTable
                            filterOptions={statusOptions}
                            selectedFilters={selectedPrograms}
                            onFilterChange={setSelectedPrograms}
                            filterVariant="pills"
                            filterSize="md"
                            showClearAll={true}
                            label="Filter"
                            className="min-w-full"
                        >
                        <TableHead>
                            <TableRow>
                                <TableHeader className="min-w-[200px]">Program Name</TableHeader>
                                <TableHeader className="min-w-[100px]">Stage</TableHeader>
                                <TableHeader className="min-w-[100px]">Duration</TableHeader>
                                <TableHeader className="min-w-[100px]">Status</TableHeader>
                                <TableHeader className="min-w-[120px]">Type</TableHeader>
                                <TableHeader className="min-w-[120px]">Start Date</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {currentPagePrograms.length > 0 ? (
                                currentPagePrograms.map(program => (
                                    <TableRow key={program.Id}>
                                        <TableCell className="min-w-[200px]">
                                            <button
                                                onClick={() => handleProgramClick(program)}
                                                className="font-medium text-blue-600 hover:text-blue-800 truncate pr-4 text-left underline"
                                                title={program.Name}
                                            >
                                                {program.Name}
                                            </button>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-gray-900 truncate pr-4" title={program.StageName}>
                                                {program.StageName}
                                            </div>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <span className="text-gray-600 whitespace-nowrap">{program.YearStart} - {program.YearEnd}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <span className={getStatusBadge(program.Status)}>{program.Status}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[120px]">
                                            <span className={getCategoryBadge(program.Type)}>{program.Type}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[120px]">
                                            <span className="text-gray-600 whitespace-nowrap">
                                                {program.YearStart}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="min-w-full">
                                        <div className="text-center py-8 text-gray-500 whitespace-nowrap">
                                            {selectedPrograms.length > 0
                                                ? `No programs found with name: ${selectedPrograms.join(', ')}`
                                                : 'No programs found.'
                                            }
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        </MultiSelectFilterableTable>
                            {/* Pagination */}
                            {programData && programData.totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-gray-200">
                                <div className="flex justify-center">
                                    <div className="flex space-x-1">
                                    <Button
                                        color="white"
                                        onClick={() => Paginate(programData.page - 1)}
                                        disabled={programData.page === 1 || isLoading}
                                    >
                                        Previous
                                    </Button>
                                    
                                    {Array.from({ length: programData.totalPages }, (_, i) => i + 1).map((pageNum) => (
                                        <Button
                                        key={pageNum}
                                        color={pageNum === programData.page ? "blue" : "white"}
                                        onClick={() => Paginate(pageNum)}
                                        disabled={isLoading}
                                        >
                                        {pageNum}
                                        </Button>
                                    ))}
                                    
                                    <Button
                                        color="white"
                                        onClick={() => Paginate(programData.page + 1)}
                                        disabled={programData.page === programData.totalPages || isLoading}
                                    >
                                        Next
                                    </Button>
                                    </div>
                                </div>
                                </div>
                            )}

                            {/* Footer info */}
                            <div className='mb-3.5 px-6 py-4'>
                                {programData && programData.lists.length > 0 ? (
                                <p className="text-sm text-gray-500">
                                    Showing {programData.limit * (programData.page - 1) + 1} to {Math.min(programData.limit * programData.page, programData.total)} of {programData.total} programs
                                </p>
                                ) : (
                                <p className="text-sm text-gray-500">
                                    No programs found
                                </p>
                                )}
                            </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MultiYear;