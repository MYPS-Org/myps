"use-client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProgram, fetchProgramEnums, fetchStagesByProgramId } from '../Service'; // Adjust the import path as necessary
import type { ProgramEnums, ParentProgram, ProgramPagination, StageList } from '../Model.d'; // Adjust the import path as necessary
import { Pagination, PaginationPrevious, PaginationNext, PaginationPage, PaginationList } from '../../../components/tailwindui/pagination'; // Adjust the import path as necessary

// Define local interface for pagination response
interface PaginationResponse<T> {
    lists: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

// #region Import Dialogs
import { AddProgramDialog, DeleteProgramDialog, FilterDialogProgramList } from '../dialogs';
// #endregion

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { 
    PlusIcon, 
    MagnifyingGlassIcon,
    TrashIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    XMarkIcon,
    FunnelIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary
import type { TableEnum } from '../../Project/Model';

const Program: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [programEnums, setProgramEnums] = useState<{
        // Statuses: ProgramEnums[];
        Stages: TableEnum[];
        Types: TableEnum[];
        Groups: ProgramEnums[];
        DataSecurity: ProgramEnums[];
    } | null>(null);

    const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
    const [isDeleteProgramOpen, setIsDeleteProgramOpen] = useState(false);
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<string | null>(); // Initialize with an empty string or a default value
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // Track expanded rows
    const [stageLists, setStageLists] = useState<Record<string, StageList>>({}); // Store stages per program ID
    const [searchInput, setSearchInput] = useState<string>(''); // Separate state for search input

    useEffect(() => {
        const getPrograms = async () => {
            setIsLoading(true);
            try {
                const response = await fetchProgram(ProgramFilters);
                setProgramData(response.Data);
            } catch (error) {
                console.error('Error fetching programs:', error);
            } finally {
                setIsLoading(false);
            }
        };
        getPrograms();
    }, []);

    const [ProgramData, setProgramData] = useState<PaginationResponse<ParentProgram>>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        lists: []
    });

    const [ProgramFilters, setProgramFilters] = useState<ProgramPagination>({
        filters: {
            Name: '',
            YearStart: '',
            GroupName: '',
            StageName: '',
        },
        sortField: '',
        sortDirection: 1,
        page: 1,
        limit: 10
    });

    const handleOpenDialog = async () => {
        try {
            setIsLoading(true);
            const response = await fetchProgramEnums();
            setProgramEnums(response.Data); // this will be passed as prop
            setIsAddProgramOpen(true); // this shows the dialog
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching programs:', error);
            setIsLoading(false);
        }
    };


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

    const handleDropDownTable = async (programId?: string) => {
        try {
            if (programId) {
                // Check if the row is already expanded
                const isCurrentlyExpanded = expandedRows.has(programId);
                
                // Toggle the expanded state for this row
                if (isCurrentlyExpanded) {
                    setExpandedRows(new Set())
                } else {
                    setExpandedRows(new Set([programId]));
                    if (!stageLists[programId]) {
                        const response = await fetchStagesByProgramId(programId);
                        setStageLists(prev => ({
                            ...prev,
                            [programId]: response.Data
                        }));
                    }
                }
                /**
                 * use this code to allow multiple rows expanded at the same time
                 */
                /** setExpandedRows(prev => {
                    const newExpanded = new Set(prev);
                    if (newExpanded.has(programId)) {
                        newExpanded.delete(programId);
                    } else {
                        newExpanded.add(programId);
                    }
                    return newExpanded;
                });

                Only fetch data if we're expanding (not collapsing) and data doesn't already exist
                if (!isCurrentlyExpanded && !stageLists[programId]) {
                    const response = await fetchStagesByProgramId(programId);
                    setStageLists(prev => ({
                        ...prev,
                        [programId]: response.Data
                    }));
                }
                */
            }
        } catch (error) {
            console.error('Error toggling program details:', error);
        }
    };

    const handleViewDetails = async (programId: string, stageName: string) => {
        try {
            if (programId && stageName) {
                const programWithStage = programId + ':' + stageName;
                navigate(`/programs/programdetails/${programWithStage}`);
            }
        } catch (error) {
            console.error('Error navigating to program details:', error);
        }
    };

    const handleSearchChange = (value: string) => {
        // Only update the input state, don't trigger API call
        setSearchInput(value);
    };

    const handleSearchSubmit = async () => {
        // Update the filter state and trigger API call
        const updatedFilters = {
            ...ProgramFilters,
            filters: {
                ...ProgramFilters.filters,
                Name: searchInput
            },
            page: 1 // Reset to first page when searching
        };
        
        setProgramFilters(updatedFilters);

        // Fetch programs with the new filter
        try {
            setIsLoading(true);
            const response = await fetchProgram(updatedFilters);
            setProgramData(response.Data);
        } catch (error) {
            console.error('Error filtering programs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearSearch = async () => {
        setSearchInput('');
        const updatedFilters = {
            ...ProgramFilters,
            filters: {
                ...ProgramFilters.filters,
                Name: ''
            },
            page: 1
        };
        
        setProgramFilters(updatedFilters);

        // Fetch programs with cleared filter
        try {
            setIsLoading(true);
            const response = await fetchProgram(updatedFilters);
            setProgramData(response.Data);
        } catch (error) {
            console.error('Error clearing search:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenFilterDialog = async () => {
        try {
            if (!programEnums) {
                setIsLoading(true);
                const response = await fetchProgramEnums();
                setProgramEnums(response.Data);
                setIsLoading(false);
            }
            setIsFilterDialogOpen(true);
        } catch (error) {
            console.error('Error fetching program enums:', error);
            setIsLoading(false);
        }
    };

    const handleApplyFilters = async (filters: ProgramPagination) => {
        setProgramFilters(filters);
        try {
            setIsLoading(true);
            const response = await fetchProgram(filters);
            setProgramData(response.Data);
        } catch (error) {
            console.error('Error applying filters:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const Paginate = async (page: number) => {
        try {
            const response = await fetchProgram({
                ...ProgramFilters,
                page: page
            });
            setProgramData(response.Data);
        } catch (error) {
            console.error('Error fetching programs:', error);
        }
    };

    return (
        
        <div className="max-w-10xl mx-auto p-6 space-y-6">
            {/* Breadcrumb */}
            {/* <nav className="text-sm text-left text-gray-500 mb-4">
                <span>Program Management</span>
                <span className="mx-2">&gt;</span>
                <span>Programs</span>
                <span className="mx-2">&gt;</span>
            </nav> */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Programs</h3>
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
                                    {(searchInput || ProgramFilters.filters?.Name) && (
                                        <Button 
                                            color="red" 
                                            onClick={handleClearSearch}
                                            disabled={isLoading}
                                            className="text-xs px-3 py-1.5"
                                        >
                                            <XMarkIcon className="w-4 h-4 mr-1" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                <Button 
                                    color="yellow" 
                                    onClick={handleOpenFilterDialog}
                                    disabled={isLoading}
                                    className="text-xs px-3 py-1.5"
                                >
                                    <FunnelIcon className="w-4 h-4 mr-1 text-white" />
                                    Filters
                                    {(ProgramFilters.filters?.YearStart || ProgramFilters.filters?.GroupName || ProgramFilters.filters?.StageName) && (
                                        <span className="ml-1.5 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            {[ProgramFilters.filters?.YearStart, ProgramFilters.filters?.GroupName, ProgramFilters.filters?.StageName].filter(Boolean).length}
                                        </span>
                                    )}
                                </Button>
                                <Button color="blue" onClick={handleOpenDialog} disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Program'}
                                </Button>
                            </div>
                        </div>
                    </div>
                <Table className="px-5" striped>
                    <TableHead>
                    <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Status</TableHeader>
                        {/* <TableHeader>Program Stage</TableHeader> */}
                        <TableHeader>Program Type</TableHeader>
                        <TableHeader>No. of Projects</TableHeader>
                        <TableHeader>Start Year</TableHeader>
                        {/* <TableHeader>End Year</TableHeader> */}
                        <TableHeader>Actions</TableHeader>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {ProgramData.lists.map((program, idx) => (
                        <React.Fragment key={`${program.Id}-${idx}`}>
                            <TableRow>
                                <TableCell>
                                    <div className="flex items-center">
                                        <button 
                                            onClick={() => handleDropDownTable(program.ProgramId)}
                                            className="flex items-center text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
                                        >
                                            {expandedRows.has(program.ProgramId || '') ? (
                                                <ChevronDownIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform" />
                                            ) : (
                                                <ChevronRightIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform" />
                                            )}
                                            {program.Name}
                                        </button>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {program.Status}
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(program.Type || '')}
                                </TableCell>
                                {/* <TableCell>
                                    {program.StageName}
                                </TableCell> */}
                                <TableCell>
                                    {program.NumberOfProjects !== undefined ? program.NumberOfProjects : 'N/A'}
                                </TableCell>
                                <TableCell>
                                    {program.YearStart}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center space-x-1">
                                        <Button 
                                            color="orange"
                                            onClick={() => handleViewDetails(program.ProgramId, program.StageName)}
                                            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                        >
                                            View
                                        </Button>
                                        <Button color="red" onClick={() => {setIsDeleteProgramOpen(true); setSelectedProgram(program.ProgramId);}} className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
                                            <TrashIcon stroke='white' className="h-5 w-5 text-gray-900" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                            
                            {/* Expandable Child Table */}
                            {expandedRows.has(program.ProgramId || '') && (
                                <TableRow>
                                    <TableCell colSpan={7} className="p-0 bg-gray-50/50 border-t border-gray-200">
                                        <div className="px-8 py-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold text-gray-900">
                                                    Program Stages under "{program.Name}"
                                                </h4>
                                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
                                                    {stageLists[program.ProgramId || '']?.Stages?.length || 0} stages
                                                </span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                <Table className="mb-0">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableHeader justify="center" className="text-xs">Stage Name</TableHeader>
                                                            {/* <TableHeader className="text-xs">Status</TableHeader> */}
                                                            <TableHeader justify="center" className="text-xs">Type</TableHeader>
                                                            <TableHeader justify="center" className="text-xs">Start Year</TableHeader>
                                                            <TableHeader justify="center" className="text-xs">Projects</TableHeader>
                                                            <TableHeader justify="center" className="text-xs">Cost</TableHeader>
                                                            <TableHeader justify="center" className="text-xs">Actions</TableHeader>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {stageLists[program.ProgramId || '']?.Stages?.map((stage) => (
                                                            <TableRow key={stage.Id}>
                                                                <TableCell className="font-medium text-sm text-center">{stage.StageName}</TableCell>
                                                                {/* <TableCell>
                                                                    {getStatusBadge(getStatusString(stage.Status || 0))}
                                                                </TableCell> */}
                                                                <TableCell className="text-sm text-gray-600 text-center">{stage.TypeName}</TableCell>
                                                                <TableCell className="text-sm text-gray-600 text-center">{stage.YearStart}</TableCell>
                                                                {/* <TableCell className="text-sm text-gray-600">{stage.YearEnd}</TableCell> */}
                                                                <TableCell className="text-sm font-medium text-center">
                                                                    {stage.NumberOfProjects !== undefined ? stage.NumberOfProjects : 'N/A'}
                                                                </TableCell>
                                                                <TableCell className="text-sm font-medium text-center">
                                                                    {stage.Cost ? `₱${stage.Cost.toLocaleString()}` : 'N/A'}
                                                                </TableCell>
                                                                <TableCell className='text-center'>
                                                                    <Button
                                                                        color="blue"
                                                                        className="text-xs px-3 py-1.5 text-center"
                                                                        onClick={() => handleViewDetails(stage.ProgramId, stage.StageName)}
                                                                    >
                                                                        View Details
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )) || (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                                                                    No stages available for this program
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
                        ProgramData.totalPages > 1 && (
                            <>
                                <PaginationPrevious 
                                    onClick={async () => {
                                        Paginate(1);
                                    }}
                                    disabled={ProgramData.page <= 1}
                                >
                                    First
                                </PaginationPrevious>
                                <PaginationList>
                                    {Array.from({ length: Math.min(7, ProgramData.totalPages) }, (_, index) => {
                                        const pageNum = Math.max(1, ProgramData.page - 3) + index;
                                        if (pageNum > ProgramData.totalPages) return null;

                                        if (pageNum === ProgramData.page) {
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
                                        Paginate(ProgramData.totalPages);
                                    }}
                                    disabled={ProgramData.page >= ProgramData.totalPages}
                                >
                                    Last
                                </PaginationNext>
                            </>
                        )
                    }
                </Pagination>
                    <div className='mb-3.5 text-center'>
                        {
                            ProgramData.lists.length > 0 ? (
                                <p className="text-sm text-gray-500">
                                    Showing {ProgramData.limit * (ProgramData.page - 1) + 1} to {Math.min(ProgramData.limit * ProgramData.page, ProgramData.total)} of {ProgramData.total} programs
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    No programs found
                                </p>
                            )
                        }
                    </div>
                </div>
            </div>

            {/* Add Program Dialog */}
            <AddProgramDialog
                isOpen={isAddProgramOpen}
                onClose={() => setIsAddProgramOpen(false)}
                programEnums={programEnums || undefined}
                onSubmit={(newProgram: any) => {
                    // Handle the new program submission
                    setProgramData(prev => ({
                        ...prev,
                        lists: [...prev.lists, newProgram],
                        total: prev.total + 1
                    }));
                }}
            />
            {/* Delete Program Dialog */}
            {selectedProgram && (
                <DeleteProgramDialog
                    isOpen={isDeleteProgramOpen}
                    onClose={() => {
                        setIsDeleteProgramOpen(false);
                        setSelectedProgram(null);
                    }}
                    program={ProgramData.lists?.find((program: any) => program.ProgramId === selectedProgram) as any}
                    onDeleteSuccess={async () => {
                        // Refresh program list after deletion
                        const response = await fetchProgram(ProgramFilters);
                        setProgramData(response.Data);
                    }}
                />
            )}

            {/* Filter Dialog */}
            <FilterDialogProgramList
                isOpen={isFilterDialogOpen}
                onClose={() => setIsFilterDialogOpen(false)}
                currentFilters={ProgramFilters}
                programEnums={programEnums || undefined}
                onApplyFilters={handleApplyFilters}
            />
        </div>
    );
}

export default Program;