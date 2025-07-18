"use-client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProgram, fetchProgramEnums } from '../Service'; // Adjust the import path as necessary
import type { ProgramEnums, ProgramList, ProgramPagination, } from '../Model'; // Adjust the import path as necessary
import { Pagination, PaginationPrevious, PaginationNext, PaginationPage, PaginationList } from '../../../components/tailwindui/pagination'; // Adjust the import path as necessary

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

// #region Import Dialogs
import { AddProgramDialog, DeleteProgramDialog } from '../dialogs';
// #endregion

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { 
    PlusIcon, 
    MagnifyingGlassIcon,
    TrashIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary

const Program: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [programEnums, setProgramEnums] = useState<{
        Statuses: ProgramEnums[];
        Stages: ProgramEnums[];
        Types: ProgramEnums[];
        Groups: ProgramEnums[];
    } | null>(null);

    const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
    const [isDeleteProgramOpen, setIsDeleteProgramOpen] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<string | null>(); // Initialize with an empty string or a default value

    useEffect(() => {
        const getPrograms = async () => {
            setIsLoading(true);
            try {
                const response = await fetchProgram(ProgramData);
                setProgramData(response.Data);
            } catch (error) {
                console.error('Error fetching programs:', error);
            } finally {
                setIsLoading(false);
            }
        };
        getPrograms();
    }, []);

    const [ProgramData, setProgramData] = useState<PaginationResponse<ProgramList>>({
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
                YearEnd: '',
                StageName: '',
                GroupName: '',
                Status: '',
                Type: '',
            },
            sortField: '',
            sortDirection: 1,
            page: 1,
            limit: 20
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

    const handleViewDetails = async (programId?: string) => {
        try {
            if (programId) {
                navigate(`/programs/programdetails/${programId}`);
            }
        } catch (error) {
            console.error('Error navigating to program details:', error);
        }
        
    };

    const Paginate = async (page: number) => {
        setProgramData(prev => ({
            ...prev,
            page: page
        }));
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
            <nav className="text-sm text-left text-gray-500 mb-4">
                <span>Program Management</span>
                <span className="mx-2">&gt;</span>
                <span>Programs</span>
                <span className="mx-2">&gt;</span>
            </nav>
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
                                <div className="relative">
                                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search Programs..."
                                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <Button color="blue" onClick={handleOpenDialog} disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Program'}
                                </Button>
                            </div>
                        </div>
                    </div>
                <Table className="px-5">
                    <TableHead>
                    <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Program Stage</TableHeader>
                        <TableHeader>Program Type</TableHeader>
                        <TableHeader>Start Year</TableHeader>
                        <TableHeader>End Year</TableHeader>
                        <TableHeader>Actions</TableHeader>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {ProgramData.lists.map(program => (
                        <TableRow key={program.Id}>
                        <TableCell>
                            <button 
                                onClick={() => handleViewDetails(program.ProgramId)}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            >
                                {program.Name}
                            </button>
                        </TableCell>
                        <TableCell>
                            {getStatusBadge(program.Status || '')}
                        </TableCell>
                        <TableCell>
                            {program.StageName}
                        </TableCell>
                        <TableCell>
                            {program.Type}
                        </TableCell>
                        <TableCell>
                            {program.YearStart}
                        </TableCell>
                        <TableCell>
                            {program.YearEnd}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center space-x-1">
                                <Button 
                                    color="orange"
                                    onClick={() => handleViewDetails(program.ProgramId)}
                                    className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                >
                                    Validate
                                </Button>
                                <Button color="red" onClick={() => {setIsDeleteProgramOpen(true); setSelectedProgram(program.ProgramId);}} className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
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
                    onClose={() => setIsDeleteProgramOpen(false)}
                    program={ProgramData.lists?.find((program: any) => program.ProgramId === selectedProgram)!} // Pass the selected program or an empty object
                    onSubmit={(programId: any) => {
                        setProgramData(prev => ({
                            ...prev,
                            lists: prev.lists.filter(program => program.ProgramId !== programId),
                            total: prev.total - 1
                        }));
                    }}
            />
            )}
        </div>
    );
}

export default Program;