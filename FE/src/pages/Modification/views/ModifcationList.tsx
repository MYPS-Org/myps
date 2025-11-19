"use-client";
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';
import ReviseProjectDialog from '../dialogs/RevisedProjectDialog';
import { getModificationProjects, searchProjects, type ModificationProject } from '../mockData/ProjectData';
import AddProjectDialog from '../dialogs/AddProjectDialog';
import AdjustProjectDialog from '../dialogs/ModifiyProjectDialog';
import { useSignalR } from '../../../hooks/useSignalR';

interface RevisionState {
    projectId?: string;
    stageName?: string;
    revisionTypeId?: number;
    revisionTypeDescription?: string;
}

const ModificationList: React.FC = () => {
    const location = useLocation();
    const state = location.state as RevisionState;
    const { projectId, stageName, revisionTypeId, revisionTypeDescription } = state || {};

    useEffect(() => {
        if(!state) return;
        console.log('Received state:', state);
    }, [projectId, stageName, revisionTypeId, revisionTypeDescription]);

    const [ isLoading ] = useState<boolean>(false);
    const [ isReviseDialogOpen, setIsReviseDialogOpen ] = useState<boolean>(false);
    const [ selectedProject, setSelectedProject ] = useState<ModificationProject | null>(null);
    const [ projects, setProjects ] = useState<ModificationProject[]>([]);
    const [ filteredProjects, setFilteredProjects ] = useState<ModificationProject[]>([]);
    const [ isAddNewDialogOpen, setIsAddNewDialogOpen ] = useState<boolean>(false);
    const [ isAdjustDialogOpen, setIsAdjustDialogOpen ] = useState<boolean>(false);

    const { isConnected, on, off, invoke } = useSignalR();
    const [ searchInput, setSearchInput ] = useState<string>('');
    // Subscribe to SignalR events when connected
    useEffect(() => {
        if (!isConnected) return;

        // Handler when server pushes an updated project
        const handleProjectUpdated = (updated: ModificationProject) => {
            console.log('SignalR ProjectUpdated received', updated);
            setProjects(prev => {
                const exists = prev.some(p => p.id === updated.id);
                if (exists) return prev.map(p => p.id === updated.id ? updated : p);
                return [updated, ...prev];
            });
            setFilteredProjects(prev => {
                const exists = prev.some(p => p.id === updated.id);
                if (exists) return prev.map(p => p.id === updated.id ? updated : p);
                return [updated, ...prev];
            });
        };

        // General notification handler
        const handleNotification = (payload: any) => {
            console.log('SignalR NewNotification:', payload);
        };

        on('ProjectUpdated', handleProjectUpdated);
        on('NewNotification', handleNotification);

        return () => {
            // the `off` implementation in our hook accepts the event name only
            off('ProjectUpdated');
            off('NewNotification');
        };
    }, [isConnected, on, off]);

    // Export / Subscribe action should await the hub invoke and handle errors
    const handleExportClick = async () => {
        try {
            // invoke is provided by useSignalR and should ensure the connection is ready
            const result = await invoke?.('SubscribeToOrder', 'user123');
            console.log('Subscribed to notifications result:', result);
        } catch (err) {
            console.error('SignalR invoke failed:', err);
        }
    };

    useEffect(() => {
        const projectData = getModificationProjects();
        setProjects(projectData);
        setFilteredProjects(projectData);
    }, []);

    useEffect(() => {
        if (state && state.revisionTypeId === 6) {
            setIsAdjustDialogOpen(true);
        }
    }, [state]);

    const handleOpenDialog = (project: ModificationProject) => {
        setSelectedProject(project);
        setIsReviseDialogOpen(true);
    } 

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    }

    const handleSearchSubmit = () => {
        if (searchInput.trim()) {
            const results = searchProjects(searchInput);
            setFilteredProjects(results);
        } else {
            setFilteredProjects(projects);
        }
    }

    const handleClearSearch = () => {
        setSearchInput('');
        setFilteredProjects(projects);
    }

    const handleAddProject = () => {
        setIsAddNewDialogOpen(true);
        console.log("Add Project Clicked");
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
                                    {searchInput && (
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
                            <TableHeader>Program Name</TableHeader>
                            <TableHeader>Project ID</TableHeader>
                            <TableHeader>Description</TableHeader>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Revision Type</TableHeader>
                            <TableHeader>Action</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredProjects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                    No projects found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProjects.map((project) => (
                                <TableRow key={project.id}>
                                    <TableCell className="font-medium">{project.programName}</TableCell>
                                    <TableCell>{project.projectId}</TableCell>
                                    <TableCell>{project.description}</TableCell>
                                    <TableCell>{new Date(project.date).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            project.status === 'Active' ? 'bg-green-100 text-green-800' :
                                            project.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {project.revisionType}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            onClick={() => handleOpenDialog(project)} 
                                            disabled={isLoading} 
                                            color="blue" 
                                            className="text-xs px-3 py-1.5"
                                        >
                                            Modify
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
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