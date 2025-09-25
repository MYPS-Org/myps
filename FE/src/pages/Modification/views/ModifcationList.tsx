"use-client";
import React, { useState, useEffect } from 'react';
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { Pagination, PaginationList, PaginationPage, PaginationPrevious, PaginationNext } from '../../../components/tailwindui/pagination';
import ReviseProjectDialog from '../dialogs/RevisedProjectDialog';


const ModificationList: React.FC = () => {

    const [ isLoading, setIsLoading ] = useState<boolean>(false);
    const [ isReviseDialogOpen, setIsReviseDialogOpen ] = useState<boolean>(false);
    const [ isDeleteProgramOpen, setIsDeleteProgramOpen ] = useState<boolean>(false);

    const [ searchInput, setSearchInput ] = useState<string>('');

    const handleOpenDialog = () => {
        setIsReviseDialogOpen(true);
    } 

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    }

    const handleSearchSubmit = () => {
        console.log('Search submitted with term:', searchInput);
        // Implement search logic here
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
                            <h3 className="text-lg font-medium text-gray-900">Modification List</h3>
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
                                <Button color="blue" onClick={handleOpenDialog} disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Project'}
                                </Button>
                            </div>
                        </div>
                    </div>
                <Table className="px-5" striped>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Program Name</TableHeader>
                            <TableHeader>Project ID</TableHeader>
                            <TableHeader>Description</TableHeader>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Revision Type</TableHeader>
                            <TableHeader>Action</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
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

            {/* Add Revise Dialog */}
            <ReviseProjectDialog
                isOpen={isReviseDialogOpen}
                onClose={() => setIsReviseDialogOpen(false)}
            />
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
        </div>
    );
};
export default ModificationList;