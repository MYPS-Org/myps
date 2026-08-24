"use-client";
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { XMarkIcon } from '@heroicons/react/20/solid';
import AdjustProjectDialog from '../dialogs/ModifiyProjectDialog';
import { fetchModificationList } from '../Service';
import type { RevisionFilter, RevisionLists } from '../Model';
import { usePagination } from '../../../hooks/usePagination';
import { getRevisionNavigationPath, parseTransactionId } from '../utils/revisionNavigation';


interface RevisionState {
    projectId?: string;
    stageName?: string;
    revisionTypeId?: number;
    revisionTypeDescription?: string;
    transactionId?: string;
}

const getStatusBadge = (statusName: string): string => {
    const name = (statusName || '').toLowerCase();
    if (name.includes('for correction')) return 'bg-red-100 text-red-500';
    if (name.includes('disapproved')) return 'bg-red-600 text-white';
    if (name.includes('for approval')) return 'bg-yellow-100 text-yellow-800';
    if (name.includes('approved')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
};

const ModificationList: React.FC = () => {
    const location = useLocation();
    const state = location.state as RevisionState;
    const { projectId, stageName, revisionTypeId, revisionTypeDescription } = state || {};

    useEffect(() => {
        if(!state) return;
        console.log('Received state:', state);
    }, [projectId, stageName, revisionTypeId, revisionTypeDescription]);

    const [ isAdjustDialogOpen, setIsAdjustDialogOpen ] = useState<boolean>(false);
    const [ searchInput, setSearchInput ] = useState<string>('');

    const navigate = useNavigate();

    // Shared keyset-pagination hook — matches the pattern used by Project.tsx/Program.tsx.
    const pagination = usePagination<RevisionFilter, RevisionLists>(fetchModificationList, {
        initialFilters: { ProjectId: '' },
        limit: 10,
    });

    useEffect(() => {
        if (state && state.revisionTypeId === 6) {
            setIsAdjustDialogOpen(true);
        }
    }, [state]);

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    }

    const handleSearchSubmit = () => {
        pagination.applyFilters({
            ...(pagination.currentFilters ?? {}),
            ProjectId: searchInput,
        });
    }

    const handleClearSearch = () => {
        setSearchInput('');
        pagination.applyFilters({
            ...(pagination.currentFilters ?? {}),
            ProjectId: '',
        });
    }

    const handleViewDetails = (revision: RevisionLists) => {
        console.log("View Details Clicked for:", revision);
        
        // Parse transaction ID to get project info for the base path
        const { projectId, stageName } = parseTransactionId(revision.TransactionId);
        
        // Get the base navigation path based on RevisionGroupId
        const basePath = getRevisionNavigationPath(
            revision.RevisionGroupId,
            projectId,
            stageName
        );
        
        // Replace the base path pattern with view pattern using transactionId
        // From: /revision/adjustment-details/PROJECT:STAGE
        // To: /revision/view/adjustment-details/TRANSACTIONID
        const pathParts = basePath.split('/');
        const modificationType = pathParts[2]; // e.g., 'adjustment-details'
        const navigationPath = `/revision/view/${modificationType}/${revision.TransactionId}`;
        
        console.log('Navigating to:', navigationPath);
        
        // Use category name if available, otherwise use revision name
        const categoryToSend = revision.CategoryName || revision.RevisionName;
        
        // Navigate with state
        navigate(navigationPath, {
            state: {
                stageName,
                revisionTypeId: revision.RevisionGroupId,
                revisionGroupId: revision.RevisionGroupId,
                revisionTypeDescription: revision.RevisionName,
                categoryDesc: categoryToSend,
                reasonDesc: revision.Reason,
                categoryId: revision.CategoryId || null,
                reasonId: revision.ReasonId,
                transactionId: revision.TransactionId,
                isViewMode: true // Flag to indicate this is view mode
            }
        });
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
                                {/* <Button color="blue" onClick={() => handleAddProject()} disabled={pagination.isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {pagination.isLoading ? 'Loading...' : 'Add Project'}
                                </Button> */}
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
                                <TableHeader>Status</TableHeader>
                                <TableHeader>Action</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pagination.data.lists.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                        {pagination.isLoading ? 'Loading...' : 'No revision requests found'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pagination.data.lists.map((revision) => (
                                    <TableRow key={revision.Id}>
                                        <TableCell className="font-medium">{revision.RevisionType}</TableCell>
                                        <TableCell>{revision.TransactionId}</TableCell>
                                        <TableCell>{revision.RevisionReason}</TableCell>
                                        <TableCell>{revision.RevisionDate ? new Date(revision.RevisionDate).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>
                                            {revision.RevisionStatus && (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(revision.RevisionStatus)}`}>
                                                    {revision.RevisionStatus}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => {
                                                    handleViewDetails(revision);
                                                }}
                                                disabled={pagination.isLoading}
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
                                    Showing {pagination.data.limit * (pagination.data.page - 1) + 1} to {Math.min(pagination.data.limit * pagination.data.page, pagination.data.total)} of {pagination.data.total} revision requests
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    No revision requests found
                                </p>
                            )
                        }
                    </div>
                </div>
            </div>
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
        </div>
    );
};
export default ModificationList;