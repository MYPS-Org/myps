"use-client";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProgram, fetchProgramEnums, fetchStagesByProgramId } from '../Service';
import type { ProgramEnums, ProgramLatest, ProgramFilter, StageList } from '../Model.d';
import { usePagination } from '../../../hooks/usePagination';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import { CollapsibleTable, ExpandToggleButton, ExpandedPanel } from '../../../components/tailwindui/collapsible-table';

// #region Import Dialogs
import { AddProgramDialog, DeleteProgramDialog, FilterDialogProgramList } from '../dialogs';
// #endregion

import { Button } from '../../../components/tailwindui/button';
import {
    PlusIcon,
    MagnifyingGlassIcon,
    TrashIcon,
    XMarkIcon,
    FunnelIcon
} from '@heroicons/react/24/outline';
import type { TableEnum } from '../../Project/Model';

const Program: React.FC = () => {
    const navigate = useNavigate();

    // isEnumsLoading is separate from pagination.isLoading — it covers the enum-fetch
    // that happens when the user opens the Add Program dialog or Filter dialog for the first time.
    const [isEnumsLoading, setIsEnumsLoading] = useState(false);

    const [programEnums, setProgramEnums] = useState<{
        Stages: TableEnum[];
        Types: TableEnum[];
        Groups: ProgramEnums[];
        DataSecurity: ProgramEnums[];
    } | null>(null);

    const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
    const [isDeleteProgramOpen, setIsDeleteProgramOpen] = useState(false);
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<string | null>();
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [stageLists, setStageLists] = useState<Record<string, StageList>>({});
    const [searchInput, setSearchInput] = useState<string>('');

    // Shared pagination hook — replaces the hand-rolled ProgramData/ProgramFilters/isLoading
    // state and the Paginate() function. Uses StartYear (renamed from YearStart in ProgramFilter).
    const pagination = usePagination<ProgramFilter, ProgramLatest>(fetchProgram, {
        initialFilters: { Name: '', StartYear: null, Type: '', StageName: '' },
        limit: 10,
    });

    const handleOpenDialog = async () => {
        try {
            setIsEnumsLoading(true);
            const response = await fetchProgramEnums();
            setProgramEnums(response.Data);
            setIsAddProgramOpen(true);
            setIsEnumsLoading(false);
        } catch (error) {
            console.error('Error fetching programs:', error);
            setIsEnumsLoading(false);
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
                const isCurrentlyExpanded = expandedRows.has(programId);

                if (isCurrentlyExpanded) {
                    setExpandedRows(new Set());
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
        setSearchInput(value);
    };

    const handleSearchSubmit = () => {
        pagination.applyFilters({
            ...(pagination.currentFilters ?? {}),
            Name: searchInput,
        });
    };

    const handleClearSearch = () => {
        setSearchInput('');
        pagination.applyFilters({
            ...(pagination.currentFilters ?? {}),
            Name: '',
        });
    };

    const handleOpenFilterDialog = async () => {
        try {
            if (!programEnums) {
                setIsEnumsLoading(true);
                const response = await fetchProgramEnums();
                setProgramEnums(response.Data);
                setIsEnumsLoading(false);
            }
            setIsFilterDialogOpen(true);
        } catch (error) {
            console.error('Error fetching program enums:', error);
            setIsEnumsLoading(false);
        }
    };

    // Receives a ProgramFilter from the dialog; passes straight into the hook
    // which resets page 1 and clears keyset cursors before fetching.
    const handleApplyFilters = (filters: ProgramFilter) => {
        pagination.applyFilters(filters);
    };

    return (
        <div className="max-w-10xl mx-auto p-6 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Programs</h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
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
                                        disabled={pagination.isLoading}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                                        Search
                                    </Button>
                                    {(searchInput || pagination.currentFilters?.Name) && (
                                        <Button
                                            color="red"
                                            onClick={handleClearSearch}
                                            disabled={pagination.isLoading}
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
                                    disabled={isEnumsLoading || pagination.isLoading}
                                    className="text-xs px-3 py-1.5"
                                >
                                    <FunnelIcon className="w-4 h-4 mr-1 text-white" />
                                    Filters
                                    {(pagination.currentFilters?.StartYear || pagination.currentFilters?.Type || pagination.currentFilters?.StageName) && (
                                        <span className="ml-1.5 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            {[pagination.currentFilters?.StartYear, pagination.currentFilters?.Type, pagination.currentFilters?.StageName].filter(Boolean).length}
                                        </span>
                                    )}
                                </Button>
                                <Button color="blue" onClick={handleOpenDialog} disabled={isEnumsLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isEnumsLoading ? 'Loading...' : 'Add Program'}
                                </Button>
                            </div>
                        </div>
                    </div>
                <CollapsibleTable<ProgramLatest>
                    className="px-5"
                    striped
                    data={pagination.data.lists}
                    rowKey={(program, idx) => `${program.Id}-${idx}`}
                    isRowExpanded={(program) => expandedRows.has(program.ProgramPK || '')}
                    onToggleRow={(program) => handleDropDownTable(program.ProgramPK)}
                    columns={[
                        {
                            header: 'Name',
                            render: (program, { isExpanded, toggleExpand }) => (
                                <ExpandToggleButton label={program.Name} isExpanded={isExpanded} onClick={toggleExpand} />
                            )
                        },
                        { header: 'Status', render: (program) => program.Status },
                        { header: 'Program Type', render: (program) => getStatusBadge(program.Type || '') },
                        { header: 'No. of Projects', render: (program) => (program.NumberOfProjects !== undefined ? program.NumberOfProjects : 'N/A') },
                        { header: 'Start Year', render: (program) => program.StartYear },
                        {
                            header: 'Actions',
                            render: (program) => (
                                <div className="flex items-center space-x-1">
                                    <Button
                                        color="orange"
                                        onClick={() => handleViewDetails(program.ProgramPK, program.StageName)}
                                        className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                    >
                                        View
                                    </Button>
                                    <Button color="red" onClick={() => {setIsDeleteProgramOpen(true); setSelectedProgram(program.ProgramPK);}} className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
                                        <TrashIcon stroke='white' className="h-5 w-5 text-gray-900" />
                                    </Button>
                                </div>
                            )
                        }
                    ]}
                    renderExpandedContent={(program) => (
                        <ExpandedPanel
                            title={`Program Stages under "${program.Name}"`}
                            badge={`${stageLists[program.ProgramPK || '']?.Stages?.length || 0} stages`}
                        >
                            <Table className="mb-0">
                                <TableHead>
                                    <TableRow>
                                        <TableHeader justify="center" className="text-xs">Stage Name</TableHeader>
                                        <TableHeader justify="center" className="text-xs">Type</TableHeader>
                                        <TableHeader justify="center" className="text-xs">Start Year</TableHeader>
                                        <TableHeader justify="center" className="text-xs">Projects</TableHeader>
                                        <TableHeader justify="center" className="text-xs">Amount</TableHeader>
                                        <TableHeader justify="center" className="text-xs">Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stageLists[program.ProgramPK || '']?.Stages?.map((stage) => (
                                        <TableRow key={stage.Id}>
                                            <TableCell className="font-medium text-sm text-center">{stage.StageName}</TableCell>
                                            <TableCell className="text-sm text-gray-600 text-center">{stage.ProgramType}</TableCell>
                                            <TableCell className="text-sm text-gray-600 text-center">{stage.StartYear}</TableCell>
                                            <TableCell className="text-sm font-medium text-center">
                                                {stage.ProjectCount !== undefined ? stage.ProjectCount : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-center">
                                                {stage.Cost ? `₱${stage.Cost.toLocaleString()}` : 'N/A'}
                                            </TableCell>
                                            <TableCell className='text-center'>
                                                <Button
                                                    color="blue"
                                                    className="text-xs px-3 py-1.5 text-center"
                                                    onClick={() => handleViewDetails(stage.ProgramId, stage.Description ?? stage.StageName)}
                                                >
                                                    View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) || (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                                                No stages available for this program
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
                />

                <div className='mb-3.5 text-center'>
                    {
                        pagination.data.lists.length > 0 ? (
                            <p className="text-sm text-gray-500">
                                Showing {pagination.data.limit * (pagination.data.page - 1) + 1} to {Math.min(pagination.data.limit * pagination.data.page, pagination.data.total)} of {pagination.data.total} programs
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
                onSubmit={() => {
                    // Refresh current page so the newly added program appears
                    pagination.refresh();
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
                    program={pagination.data.lists?.find((program: any) => program.ProgramPK === selectedProgram) as any}
                    onDeleteSuccess={() => {
                        // Re-fetch current page/filters without keyset cursors — safe after delete
                        pagination.refresh();
                    }}
                />
            )}

            {/* Filter Dialog */}
            <FilterDialogProgramList
                isOpen={isFilterDialogOpen}
                onClose={() => setIsFilterDialogOpen(false)}
                currentFilters={pagination.currentFilters ?? { Name: '', StartYear: null, Type: '', StageName: '' }}
                programEnums={programEnums || undefined}
                onApplyFilters={handleApplyFilters}
            />
        </div>
    );
};

export default Program;
