"use-client";
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { Pagination, PaginationPrevious, PaginationNext, PaginationPage, PaginationList } from '../../../components/tailwindui/pagination';
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';
import AddProjectDialog from '../dialogs/AddProjectDialog';
import AdjustProjectDialog from '../dialogs/ModifiyProjectDialog';
import { fetchModificationList } from '../Service';
import type { RevisionPagination, RevisionLists } from '../Model.d';
import { useToast } from '../../../components/toaster/ToasterContext';


interface RevisionState {
    projectId?: string;
    stageName?: string;
    revisionTypeId?: number;
    revisionTypeDescription?: string;
    transactionId?: string;
}

const ModificationList: React.FC = () => {
    const location = useLocation();
    const state = location.state as RevisionState;
    const { projectId, stageName, revisionTypeId, revisionTypeDescription } = state || {};
    const { showToast } = useToast();

    useEffect(() => {
        if(!state) return;
        console.log('Received state:', state);
    }, [projectId, stageName, revisionTypeId, revisionTypeDescription]);

    const [ isLoading, setIsLoading ] = useState<boolean>(false);
    const [ isAddNewDialogOpen, setIsAddNewDialogOpen ] = useState<boolean>(false);
    const [ isAdjustDialogOpen, setIsAdjustDialogOpen ] = useState<boolean>(false);
    const [ searchInput, setSearchInput ] = useState<string>('');

    const navigate = useNavigate();

    const [RevisionFilters, setRevisionFilters] = useState<RevisionPagination>({
        filters: {
            ProjectId: ''
        },
        sortField: '',
        sortDirection: 1,
        page: 1,
        limit: 10
    });

    const [RevisionData, setRevisionData] = useState<PaginationResponse<RevisionLists>>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        lists: []
    });

    useEffect(() => {
        try {
            fetchRequests();
        } catch (error) {
            console.error('Error fetching modification list on mount:', error);
        }
        // setProjects(projectData);
        // setFilteredProjects(projectData);
    }, []);

    const fetchRequests = async (filters?: RevisionPagination) => {
        try {
            setIsLoading(true);
            const filtersToUse = filters || RevisionFilters;
            const response = await fetchModificationList(filtersToUse);
            console.log('API Response:', response.Data);
            setRevisionData(response.Data);
        } catch (error) {
            showToast({
                type: 'error',
                message: 'Failed to fetch revision requests.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (state && state.revisionTypeId === 6) {
            setIsAdjustDialogOpen(true);
        }
    }, [state]);

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    }

    const handleSearchSubmit = async () => {
        const updatedFilters = {
            ...RevisionFilters,
            filters: {
                ...RevisionFilters.filters,
                ProjectId: searchInput
            },
            page: 1
        };
        
        setRevisionFilters(updatedFilters);
        await fetchRequests(updatedFilters);
    }

    const handleClearSearch = async () => {
        setSearchInput('');
        const updatedFilters = {
            ...RevisionFilters,
            filters: {
                ...RevisionFilters.filters,
                ProjectId: ''
            },
            page: 1
        };
        
        setRevisionFilters(updatedFilters);
        await fetchRequests(updatedFilters);
    }

    const Paginate = async (page: number) => {
        try {
            const response = await fetchModificationList({
                ...RevisionFilters,
                page: page
            });
            setRevisionData(response.Data);
        } catch (error) {
            console.error('Error fetching revision requests:', error);
            showToast({
                type: 'error',
                message: 'Failed to fetch revision requests.'
            });
        }
    }

    const handleAddProject = () => {
        setIsAddNewDialogOpen(true);
        console.log("Add Project Clicked");
    }

    const handleViewDetails = (transactionId: string) => {
        console.log("View Details Clicked for Transaction ID:", transactionId);
        navigate ('/modification/details', { state: { transactionId } });
    }

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
                            <h3 className="text-lg font-medium text-gray-900">Revision List</h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                </div>
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
                                    {(searchInput || RevisionFilters.filters?.ProjectId) && (
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
                                <Button color="blue" onClick={() => handleAddProject()} disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Project'}
                                </Button>
                            </div>
                        </div>
                    </div>
                <Table className="px-5" striped>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Revision Type</TableHeader>
                            <TableHeader>Project ID</TableHeader>
                            <TableHeader>Reason</TableHeader>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Revision Type</TableHeader>
                            <TableHeader>Action</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {RevisionData.lists.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                    {isLoading ? 'Loading...' : 'No revision requests found'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            RevisionData.lists.map((revision) => (
                                <TableRow key={revision.Id}>
                                    <TableCell className="font-medium">{revision.RevisionName}</TableCell>
                                    <TableCell>{revision.TransactionId}</TableCell>
                                    <TableCell>{revision.Reason}</TableCell>
                                    <TableCell>{revision.CreatedDate ? new Date(revision.CreatedDate).toLocaleDateString() : '-'}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            revision.IsRegionApproved === 1 ? 'bg-green-100 text-green-800' :
                                            revision.IsCOApproved === 1 ? 'bg-blue-100 text-blue-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {revision.IsRegionApproved === 1 ? 'Region Approved' : revision.IsCOApproved === 1 ? 'CO Approved' : 'Pending'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            onClick={() => {
                                                handleViewDetails(revision.TransactionId);
                                            }} 
                                            disabled={isLoading} 
                                            color="blue" 
                                            className="text-xs px-3 py-1.5"
                                        >
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <Pagination className="my-6">
                    {
                        RevisionData.totalPages > 1 && (
                            <>
                                <PaginationPrevious 
                                    onClick={async () => {
                                        Paginate(1);
                                    }}
                                    disabled={RevisionData.page <= 1}
                                >
                                    First
                                </PaginationPrevious>
                                <PaginationList>
                                    {Array.from({ length: Math.min(7, RevisionData.totalPages) }, (_, index) => {
                                        const pageNum = Math.max(1, RevisionData.page - 3) + index;
                                        if (pageNum > RevisionData.totalPages) return null;

                                        if (pageNum === RevisionData.page) {
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
                                        Paginate(RevisionData.totalPages);
                                    }}
                                    disabled={RevisionData.page >= RevisionData.totalPages}
                                >
                                    Last
                                </PaginationNext>
                            </>
                        )
                    }
                </Pagination>
                <div className='mb-3.5'>
                    {
                        RevisionData.lists.length > 0 ? (
                            <p className="text-sm text-gray-500">
                                Showing {RevisionData.limit * (RevisionData.page - 1) + 1} to {Math.min(RevisionData.limit * RevisionData.page, RevisionData.total)} of {RevisionData.total} revision requests
                            </p>
                        ) : (
                            <p className="text-sm text-gray-500">
                                No revision requests found
                            </p>
                        )
                    }
                </div>
                {/* <Pagination className="my-6">
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
                    <div className='mb-3.5'>
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
                    </div> */}
                </div>
            </div>

            {/* Modify Dialog */}
            {/* {selectedProject && (
                <ReviseProjectDialog
                    isOpen={isReviseDialogOpen}
                    onClose={() => {
                        setIsReviseDialogOpen(false);
                        setSelectedProject(null);
                    }}
                    project={selectedProject}
                />
            )} */}
            {/* Adjust Project Dialog */}
            {state && state.revisionTypeId === 6 && (
                <AdjustProjectDialog
                    isOpen={isAdjustDialogOpen}
                    onClose={() => setIsAdjustDialogOpen(false)}
                    revisionTypeId={state?.revisionTypeId || 0}
                    revisionTypeDescription={state?.revisionTypeDescription || ''}
                    projectId={state?.projectId || ''}
                    stageName={state?.stageName || ''}
                />
            )}
            {/* Delete Program Dialog */}
            {/* {selectedProgram && (
                <DeleteProgramDialog
                    isOpen={isDeleteProgramOpen}
                    onClose={() => setIsDeleteProgramOpen(false)}
                    program={ProgramData.lists?.find((program: any) => program.ProgramId === selectedProgram) as any} // Cast to match expected type
                    onSubmit={(programId: any) => {
                        setProgramData(prev => ({
                            ...prev,
                            lists: prev.lists.filter(program => program.ProgramId !== programId),
                            total: prev.total - 1
                        }));
                    }}
            />
            )} */}
            {/* Add Revise Dialog */}
            {isAddNewDialogOpen && (
                <AddProjectDialog
                    isOpen={isAddNewDialogOpen}
                    onClose={() => setIsAddNewDialogOpen(false)}
                />
            )}
        </div>
    );
};
export default ModificationList;